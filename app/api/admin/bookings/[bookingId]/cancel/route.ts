import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendAdminCancellationAlert, sendCustomerCancellationAlert } from '@/lib/whatsapp/baileys-send';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers.get('x-admin-password') !== pw) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
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

    const resolvedStart = booking.startTime ?? booking.startMinute ?? (booking.startHour != null ? booking.startHour * 60 : 0);
    const resolvedDuration = booking.duration ?? (booking.hours != null ? booking.hours * 60 : 60);
    console.log(`[Admin Cancel] Sending WA — bookingId=${bookingId} phone=${booking.customerPhone} date=${booking.date} startTime=${resolvedStart} duration=${resolvedDuration}`);
    const [customerResult, adminResult] = await Promise.allSettled([
      sendCustomerCancellationAlert(booking.customerPhone, { date: booking.date, startTime: resolvedStart, duration: resolvedDuration, bookingId }),
      sendAdminCancellationAlert({ guestName: booking.customerName, customerPhone: booking.customerPhone, date: booking.date, startTime: resolvedStart, duration: resolvedDuration, paymentType: booking.paymentType, bookingId }),
    ]);
    const cVal = customerResult.status === 'fulfilled' ? customerResult.value : null;
    const aVal = adminResult.status === 'fulfilled' ? adminResult.value : null;
    console.log(`[Admin Cancel] Customer WA result:`, customerResult.status === 'rejected' ? customerResult.reason : cVal);
    console.log(`[Admin Cancel] Admin WA result:`, adminResult.status === 'rejected' ? adminResult.reason : aVal);
    if (customerResult.status === 'rejected') console.error('[Admin Cancel] Customer WA threw:', customerResult.reason);
    if (adminResult.status === 'rejected') console.error('[Admin Cancel] Admin WA threw:', adminResult.reason);

    return NextResponse.json({ success: true, data: { status: 'cancelled' } });
  } catch (error) {
    console.error('Cancellation error:', error);
    return NextResponse.json({ success: false, error: 'Cancellation failed' }, { status: 500 });
  }
}
