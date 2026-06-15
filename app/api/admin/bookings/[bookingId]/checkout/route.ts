import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp/baileys-send';
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

    if (booking.status !== 'checked_in') {
      return NextResponse.json(
        { success: false, error: 'Can only check out checked-in bookings' },
        { status: 400 }
      );
    }

    await bookingRef.update({
      status: 'completed',
      checkOutTime: FieldValue.serverTimestamp(),
    });

    sendWhatsAppMessage({
      to: booking.customerPhone,
      message:
        `✅ *Thanks for visiting Green Hills Karaoke!*\n\n` +
        `Hi ${booking.customerName}, your session on ${booking.date} is complete.\n\n` +
        `Hope you had an amazing time! 🎤\n` +
        `See you again soon — Green Hills Karaoke`,
    }).catch((e) => console.error('[Check-out] Customer WA failed:', e));

    return NextResponse.json({
      success: true,
      data: { status: 'completed' },
    });
  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json({ success: false, error: 'Check-out failed' }, { status: 500 });
  }
}
