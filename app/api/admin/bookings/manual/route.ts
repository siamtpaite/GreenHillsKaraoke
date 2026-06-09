import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateHourList } from '@/lib/utils/availability';
import { sendWhatsAppNotification } from '@/lib/whatsapp/baileys-send';
import { ApiResponse, Booking } from '@/lib/types';

const HOURLY_RATE = parseInt(process.env.NEXT_PUBLIC_HOURLY_RATE || '1180');

/**
 * POST /api/admin/bookings/manual
 * Create a confirmed booking without payment (walk-in / admin override).
 * Body: { date, startHour, hours, customerName, customerPhone, customerEmail?, amountPaid?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, startHour, hours, customerName, customerPhone, customerEmail, amountPaid, notes } = body;

    if (!date || startHour === undefined || !hours || !customerName || !customerPhone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: date, startHour, hours, customerName, customerPhone' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (hours < 1 || hours > 8) {
      return NextResponse.json(
        { success: false, error: 'Booking must be between 1 and 8 hours' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    const hourList = generateHourList(startHour, hours);
    const totalAmount = HOURLY_RATE * hours;
    const paid = amountPaid !== undefined ? Number(amountPaid) : totalAmount;
    const amountDue = Math.max(0, totalAmount - paid);
    const bookingId = adminDb.collection('bookings').doc().id;

    await adminDb.runTransaction(async (tx) => {
      // Check all slots are available
      for (const hour of hourList) {
        const slotRef = adminDb.doc(`availability/${date}/slots/${hour}`);
        const slotSnap = await tx.get(slotRef);
        if (slotSnap.exists && slotSnap.data()?.status !== 'available') {
          throw new Error(`Slot ${hour}:00 is already booked or unavailable`);
        }
      }

      // Lock all slots
      for (const hour of hourList) {
        const slotRef = adminDb.doc(`availability/${date}/slots/${hour}`);
        tx.set(slotRef, { status: 'booked', bookingId, bookedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      // Create booking record as confirmed
      const bookingRef = adminDb.collection('bookings').doc(bookingId);
      tx.set(bookingRef, {
        id: bookingId,
        customerName,
        customerEmail: customerEmail || '',
        customerPhone,
        date,
        hours,
        startHour,
        hourList,
        depositPaid: paid,
        totalAmount,
        amountDue,
        status: 'confirmed',
        notes: notes || '',
        createdAt: FieldValue.serverTimestamp(),
        createdBy: 'admin',
      });
    });

    // Admin group notification
    sendWhatsAppNotification({
      bookingId,
      customerName,
      date,
      hours,
      totalAmount,
      eventType: 'booking_confirmed',
    }).catch((err) => console.error('[Manual Booking] Admin WA failed:', err));

    // Customer notification — format phone as WhatsApp JID (Indian +91 prefix)
    const customerJid = `91${customerPhone.replace(/[^\d]/g, '')}@s.whatsapp.net`;
    sendWhatsAppNotification(
      { bookingId, customerName, date, hours, totalAmount, amountDue, eventType: 'customer_booking_confirmed' },
      customerJid
    ).catch((err) => console.error('[Manual Booking] Customer WA failed:', err));

    return NextResponse.json(
      { success: true, message: 'Booking created', data: { bookingId } } as ApiResponse<{ bookingId: string }>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Manual booking error:', error);
    if (error instanceof Error && error.message.includes('already booked')) {
      return NextResponse.json(
        { success: false, error: error.message } as ApiResponse<null>,
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to create booking' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/bookings/manual
 * Edit an existing booking. If date/time changes, old slots are released and new ones locked.
 * Body: { bookingId, date?, startHour?, hours?, customerName?, customerPhone?, customerEmail?, amountPaid?, notes? }
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, date, startHour, hours, customerName, customerPhone, customerEmail, amountPaid, notes } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: 'bookingId is required' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (hours !== undefined && (hours < 1 || hours > 8)) {
      return NextResponse.json(
        { success: false, error: 'Booking must be between 1 and 8 hours' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    const bookingRef = adminDb.collection('bookings').doc(bookingId);

    await adminDb.runTransaction(async (tx) => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) {
        throw new Error('Booking not found');
      }

      const existing = bookingSnap.data() as Booking & { startHour?: number };
      const newDate = date ?? existing.date;
      const newStartHour = startHour ?? existing.startHour ?? Number(existing.hourList[0]);
      const newHours = hours ?? existing.hours;
      const newHourList = generateHourList(newStartHour, newHours);

      const timeChanged =
        newDate !== existing.date ||
        newStartHour !== (existing.startHour ?? Number(existing.hourList[0])) ||
        newHours !== existing.hours;

      if (timeChanged) {
        // Release old slots
        for (const hour of existing.hourList) {
          const slotRef = adminDb.doc(`availability/${existing.date}/slots/${hour}`);
          tx.set(slotRef, { status: 'available', bookingId: null, bookedAt: null }, { merge: true });
        }

        // Check new slots are available
        for (const hour of newHourList) {
          const slotRef = adminDb.doc(`availability/${newDate}/slots/${hour}`);
          const slotSnap = await tx.get(slotRef);
          if (slotSnap.exists && slotSnap.data()?.status !== 'available') {
            throw new Error(`Slot ${hour}:00 on ${newDate} is already booked or unavailable`);
          }
        }

        // Lock new slots
        for (const hour of newHourList) {
          const slotRef = adminDb.doc(`availability/${newDate}/slots/${hour}`);
          tx.set(slotRef, { status: 'booked', bookingId, bookedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
      }

      const totalAmount = HOURLY_RATE * newHours;
      const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

      if (timeChanged) {
        updates.date = newDate;
        updates.startHour = newStartHour;
        updates.hours = newHours;
        updates.hourList = newHourList;
        updates.totalAmount = totalAmount;
      }
      if (amountPaid !== undefined) {
        const paid = Number(amountPaid);
        updates.depositPaid = paid;
        updates.amountDue = Math.max(0, (timeChanged ? totalAmount : (existing.totalAmount ?? totalAmount)) - paid);
      } else if (timeChanged) {
        updates.amountDue = Math.max(0, totalAmount - (existing.depositPaid ?? 0));
      }
      if (customerName !== undefined) updates.customerName = customerName;
      if (customerPhone !== undefined) updates.customerPhone = customerPhone;
      if (customerEmail !== undefined) updates.customerEmail = customerEmail;
      if (notes !== undefined) updates.notes = notes;

      tx.update(bookingRef, updates);
    });

    return NextResponse.json(
      { success: true, message: 'Booking updated', data: { bookingId } } as ApiResponse<{ bookingId: string }>
    );
  } catch (error) {
    console.error('Booking edit error:', error);
    if (error instanceof Error) {
      if (error.message === 'Booking not found') {
        return NextResponse.json(
          { success: false, error: 'Booking not found' } as ApiResponse<null>,
          { status: 404 }
        );
      }
      if (error.message.includes('already booked')) {
        return NextResponse.json(
          { success: false, error: error.message } as ApiResponse<null>,
          { status: 409 }
        );
      }
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update booking' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
