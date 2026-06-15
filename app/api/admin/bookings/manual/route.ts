import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isTimeRangeAvailable } from '@/lib/utils/availability';
import { sendAdminBookingAlert, sendCustomerConfirmation } from '@/lib/whatsapp/baileys-send';
import { ApiResponse, Booking } from '@/lib/types';

const HOURLY_RATE = parseInt(process.env.NEXT_PUBLIC_HOURLY_RATE || '50');
const DEPOSIT_AMOUNT = parseInt(process.env.DEPOSIT_AMOUNT || '50');

// Admin sessions run 10 AM – midnight (600–1440 min)
const ADMIN_START = 600;
const ADMIN_END = 1440;

/**
 * POST /api/admin/bookings/manual
 * Create a confirmed booking without payment (walk-in / admin override).
 * Body: { date, startTime, duration, customerName, customerPhone, customerEmail?, amountPaid?, paymentType?, notes? }
 * startTime: minutes from midnight. duration: minutes.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, startTime: rawStartTime, duration: rawDuration, customerName, customerPhone, customerEmail, amountPaid, paymentType, notes } = body;

    const startTime = rawStartTime !== undefined ? Number(rawStartTime) : undefined;
    const duration = rawDuration !== undefined ? Number(rawDuration) : undefined;

    if (!date || startTime === undefined || !duration || !customerName || !customerPhone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: date, startTime, duration, customerName, customerPhone' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (startTime < ADMIN_START || (startTime + duration) > ADMIN_END) {
      return NextResponse.json(
        { success: false, error: `Admin bookings must fall within 10:00 AM – 12:00 AM` } as ApiResponse<null>,
        { status: 400 }
      );
    }

    const bookingId = adminDb.collection('bookings').doc().id;
    const endTime = startTime + duration;
    const totalAmount = Math.ceil(duration / 60) * HOURLY_RATE;
    const paidAmount = amountPaid !== undefined ? Number(amountPaid) : totalAmount;
    const balanceDue = Math.max(0, totalAmount - paidAmount);
    const resolvedPaymentType: 'full' | 'deposit' =
      paymentType === 'full' || paymentType === 'deposit'
        ? paymentType
        : paidAmount >= totalAmount ? 'full' : 'deposit';

    await adminDb.runTransaction(async (tx) => {
      const existingSnap = await tx.get(
        adminDb.collection('bookings')
          .where('date', '==', date)
          .where('status', 'in', ['confirmed', 'checked_in'])
      );

      for (const doc of existingSnap.docs) {
        const b = doc.data();
        const bStart = b.startTime ?? b.startMinute ?? (b.startHour ?? 12) * 60;
        const bDur = b.duration ?? (b.hours ?? 1) * 60;
        const bEnd = b.endTime ?? bStart + bDur;
        if (startTime < bEnd && endTime > bStart) {
          throw new Error(`Time conflict: overlaps booking ${doc.id}`);
        }
      }

      const bookingRef = adminDb.collection('bookings').doc(bookingId);
      tx.set(bookingRef, {
        id: bookingId,
        customerName,
        customerEmail: customerEmail || '',
        customerPhone,
        date,
        startTime,
        duration,
        endTime,
        paymentType: resolvedPaymentType,
        totalAmount,
        paidAmount,
        balanceDue,
        depositPaid: paidAmount,
        amountDue: balanceDue,
        status: 'confirmed',
        notes: notes || '',
        createdAt: FieldValue.serverTimestamp(),
        createdBy: 'admin',
      });
    });

    sendAdminBookingAlert({ guestName: customerName, date, duration, balanceDue, bookingId, paymentType: resolvedPaymentType })
      .catch((err) => console.error('[Manual Booking] Admin WA failed:', err));
    sendCustomerConfirmation(customerPhone, { date, duration, balanceDue, bookingId, paymentType: resolvedPaymentType })
      .catch((err) => console.error('[Manual Booking] Customer WA failed:', err));

    return NextResponse.json(
      { success: true, message: 'Booking created', data: { bookingId } } as ApiResponse<{ bookingId: string }>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Manual booking error:', error);
    if (error instanceof Error && error.message.includes('conflict')) {
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
 * Edit an existing booking. If date/time changes, checks for conflicts.
 * Body: { bookingId, date?, startTime?, duration?, customerName?, customerPhone?, customerEmail?, amountPaid?, notes? }
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, date, startTime: rawStartTime, duration: rawDuration, customerName, customerPhone, customerEmail, amountPaid, notes } = body;

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

    const incomingStartTime = rawStartTime !== undefined ? Number(rawStartTime) : undefined;
    const incomingDuration = rawDuration !== undefined ? Number(rawDuration) : undefined;

    const bookingRef = adminDb.collection('bookings').doc(bookingId);

    await adminDb.runTransaction(async (tx) => {
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) throw new Error('Booking not found');

      const existing = bookingSnap.data() as Booking;
      const existingStart = existing.startTime ?? existing.startMinute ?? (existing.startHour ?? 12) * 60;
      const existingDuration = existing.duration ?? (existing.hours ?? 1) * 60;

      const newDate = date ?? existing.date;
      const newStart = incomingStartTime ?? existingStart;
      const newDuration = incomingDuration ?? existingDuration;
      const newEnd = newStart + newDuration;

      const timeChanged =
        newDate !== existing.date || newStart !== existingStart || newDuration !== existingDuration;

      if (timeChanged) {
        const existingSnap = await tx.get(
          adminDb.collection('bookings')
            .where('date', '==', newDate)
            .where('status', 'in', ['confirmed', 'checked_in'])
        );

        for (const doc of existingSnap.docs) {
          if (doc.id === bookingId) continue;
          const b = doc.data();
          const bStart = b.startTime ?? b.startMinute ?? (b.startHour ?? 12) * 60;
          const bDur = b.duration ?? (b.hours ?? 1) * 60;
          const bEnd = b.endTime ?? bStart + bDur;
          if (newStart < bEnd && newEnd > bStart) {
            throw new Error(`Time conflict: overlaps booking ${doc.id}`);
          }
        }
      }

      const totalAmount = Math.ceil(newDuration / 60) * HOURLY_RATE;
      const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

      if (timeChanged) {
        updates.date = newDate;
        updates.startTime = newStart;
        updates.duration = newDuration;
        updates.endTime = newEnd;
        updates.totalAmount = totalAmount;
      }
      if (amountPaid !== undefined) {
        const base = timeChanged ? totalAmount : (existing.totalAmount ?? totalAmount);
        const newPaid = Number(amountPaid);
        const newBalance = Math.max(0, base - newPaid);
        updates.paidAmount = newPaid;
        updates.balanceDue = newBalance;
        updates.depositPaid = newPaid;
        updates.amountDue = newBalance;
        updates.paymentType = newPaid >= base ? 'full' : 'deposit';
      } else if (timeChanged) {
        const newBalance = Math.max(0, totalAmount - (existing.paidAmount ?? existing.depositPaid ?? 0));
        updates.balanceDue = newBalance;
        updates.amountDue = newBalance;
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
      if (error.message.includes('conflict')) {
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
