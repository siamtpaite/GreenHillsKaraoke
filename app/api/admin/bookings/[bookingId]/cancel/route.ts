import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendWhatsAppNotification } from '@/lib/whatsapp/baileys-send';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const now = new Date().toISOString();

    const bookingRef = adminDb.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    const booking = bookingSnap.data();

    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      return NextResponse.json(
        { success: false, error: 'Can only cancel active bookings' },
        { status: 400 }
      );
    }

    const date = booking.date;
    const hourList = booking.hourList || [];

    const batch = adminDb.batch();

    batch.update(bookingRef, {
      status: 'cancelled',
      cancelledAt: now,
    });

    for (const hour of hourList) {
      const slotRef = adminDb.collection('availability').doc(date).collection('slots').doc(String(hour));
      batch.update(slotRef, { status: 'available', bookingId: null, bookedAt: null });
    }

    await batch.commit();

    await sendWhatsAppNotification({
      bookingId,
      customerName: booking.customerName,
      date: booking.date,
      hours: booking.hours,
      totalAmount: booking.totalAmount,
      eventType: 'cancelled',
    });

    return NextResponse.json({ success: true, data: { status: 'cancelled', cancelledAt: now } });
  } catch (error) {
    console.error('Cancellation error:', error);
    return NextResponse.json(
      { success: false, error: 'Cancellation failed' },
      { status: 500 }
    );
  }
}
