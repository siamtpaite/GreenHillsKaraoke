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

    const waPayload = {
      bookingId,
      customerName: booking.customerName,
      date: booking.date,
      hours: booking.hours,
      totalAmount: booking.totalAmount,
    };

    await sendWhatsAppNotification({ ...waPayload, eventType: 'checked_out' });

    sendWhatsAppNotification(
      { ...waPayload, eventType: 'customer_checked_out' },
      formatCustomerJid(booking.customerPhone)
    ).catch((err) => console.error('[Check-out] Customer WA failed:', err));

    return NextResponse.json({ success: true, data: { status: 'completed', checkOutTime: now } });
  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json(
      { success: false, error: 'Check-out failed' },
      { status: 500 }
    );
  }
}
