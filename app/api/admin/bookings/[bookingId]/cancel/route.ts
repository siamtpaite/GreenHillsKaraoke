import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendAdminCancellationAlert, sendCustomerCancellationAlert } from '@/lib/whatsapp/baileys-send';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;

    const bookingRef = adminDb.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const booking = bookingSnap.data()!;

    if (!['confirmed', 'checked_in'].includes(booking.status)) {
      return NextResponse.json(
        { success: false, error: 'Can only cancel active bookings' },
        { status: 400 }
      );
    }

    await bookingRef.update({
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
    });

    const [customerResult, adminResult] = await Promise.allSettled([
      sendCustomerCancellationAlert(booking.customerPhone, { date: booking.date, startTime: booking.startTime, duration: booking.duration, bookingId }),
      sendAdminCancellationAlert({ guestName: booking.customerName, customerPhone: booking.customerPhone, date: booking.date, startTime: booking.startTime, duration: booking.duration, paymentType: booking.paymentType, bookingId }),
    ]);
    if (customerResult.status === 'rejected') console.error('[Admin Cancel] Customer WA failed:', customerResult.reason);
    if (adminResult.status === 'rejected') console.error('[Admin Cancel] Admin WA failed:', adminResult.reason);

    return NextResponse.json({ success: true, data: { status: 'cancelled' } });
  } catch (error) {
    console.error('Cancellation error:', error);
    return NextResponse.json({ success: false, error: 'Cancellation failed' }, { status: 500 });
  }
}
