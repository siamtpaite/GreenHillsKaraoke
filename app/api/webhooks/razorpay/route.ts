import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/payment/razorpay';

/**
 * POST /api/webhooks/razorpay
 *
 * Secondary audit endpoint — Razorpay fires this after payment events.
 * Booking state is already committed atomically by POST /api/bookings/confirm
 * (called by the frontend after the Razorpay handler callback), so this
 * handler only verifies the signature and acknowledges receipt.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';

    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.error('[razorpay webhook] Invalid signature — rejected');
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }

    const { event, payload } = JSON.parse(rawBody);

    if (['payment.authorized', 'payment.captured'].includes(event)) {
      const paymentId = payload?.payment?.entity?.id;
      const orderId = payload?.payment?.entity?.order_id;
      const bookingId = payload?.payment?.entity?.notes?.bookingId;
      console.log(`[razorpay webhook] ${event} — payment ${paymentId}, order ${orderId}, booking ${bookingId}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[razorpay webhook] Error:', error);
    return NextResponse.json({ success: false, error: 'Webhook error' }, { status: 500 });
  }
}
