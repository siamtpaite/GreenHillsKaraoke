import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendWhatsAppMessage, sendAdminCheckInAlert } from '@/lib/whatsapp/baileys-send';
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

    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { success: false, error: 'Can only check in confirmed bookings' },
        { status: 400 }
      );
    }

    await bookingRef.update({
      status: 'checked_in',
      checkInTime: FieldValue.serverTimestamp(),
    });

    const balanceDue = booking.balanceDue ?? booking.amountDue ?? 0;
    const startTime = booking.startTime ?? booking.startMinute ?? (booking.startHour ?? 0) * 60;
    const dur = booking.duration ?? (booking.hours ?? 1) * 60;
    const h = Math.floor(dur / 60), m = dur % 60;
    const durStr = m === 0 ? `${h}h` : `${h}h ${m}min`;
    const balanceLine = balanceDue > 0 ? `Balance due: ₹${balanceDue}` : 'Fully paid';

    sendWhatsAppMessage({
      to: booking.customerPhone,
      message:
        `🎤 *Welcome to Green Hills Karaoke!*\n\n` +
        `Hi ${booking.customerName}, you've been checked in.\n` +
        `📅 Date: ${booking.date}\n` +
        `⏱️ Duration: ${durStr}\n` +
        `${balanceLine}\n\n` +
        `Enjoy your session! 🎶`,
    }).catch((e) => console.error('[Check-in] Customer WA failed:', e));

    sendAdminCheckInAlert({
      guestName: booking.customerName,
      customerPhone: booking.customerPhone,
      date: booking.date,
      startTime,
      duration: dur,
      balanceDue,
      bookingId,
    }).catch((e) => console.error('[Check-in] Admin WA failed:', e));

    return NextResponse.json({ success: true, data: { status: 'checked_in' } });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json({ success: false, error: 'Check-in failed' }, { status: 500 });
  }
}
