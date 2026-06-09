import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendWhatsAppNotification, formatCustomerJid } from '@/lib/whatsapp/baileys-send';

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

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

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

    const waPayload = {
      bookingId,
      customerName: booking.customerName,
      date: booking.date,
      hours: booking.hours,
      totalAmount: booking.totalAmount,
    };

    await sendWhatsAppNotification({ ...waPayload, eventType: 'checked_in' });

    sendWhatsAppNotification(
      { ...waPayload, eventType: 'customer_checked_in' },
      formatCustomerJid(booking.customerPhone)
    ).catch((err) => console.error('[Check-in] Customer WA failed:', err));

    return NextResponse.json({ success: true, data: { status: 'checked_in', checkInTime: now } });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { success: false, error: 'Check-in failed' },
      { status: 500 }
    );
  }
}
