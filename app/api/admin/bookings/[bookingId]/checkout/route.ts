import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendWhatsAppNotification } from '@/lib/whatsapp/baileys-send';

export async function POST(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const { bookingId } = params;
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

    if (booking.status !== 'checked_in') {
      return NextResponse.json(
        { success: false, error: 'Can only check out checked-in bookings' },
        { status: 400 }
      );
    }

    await bookingRef.update({
      status: 'completed',
      checkOutTime: now,
    });

    await sendWhatsAppNotification({
      bookingId,
      customerName: booking.customerName,
      date: booking.date,
      hours: booking.hours,
      totalAmount: booking.totalAmount,
      eventType: 'checked_out',
    });

    return NextResponse.json({ success: true, data: { status: 'completed', checkOutTime: now } });
  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json(
      { success: false, error: 'Check-out failed' },
      { status: 500 }
    );
  }
}
