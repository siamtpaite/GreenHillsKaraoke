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

    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { success: false, error: 'Can only check in confirmed bookings' },
        { status: 400 }
      );
    }

    await bookingRef.update({
      status: 'checked_in',
      checkInTime: now,
    });

    await sendWhatsAppNotification({
      bookingId,
      customerName: booking.customerName,
      date: booking.date,
      hours: booking.hours,
      totalAmount: booking.totalAmount,
      eventType: 'checked_in',
    });

    return NextResponse.json({ success: true, data: { status: 'checked_in', checkInTime: now } });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { success: false, error: 'Check-in failed' },
      { status: 500 }
    );
  }
}
