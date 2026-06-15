import { NextRequest, NextResponse } from 'next/server';
import { lockAndConfirmBooking, getBooking } from '@/lib/booking/service';
import { adminDb } from '@/lib/firebase/admin';
import { verifyPaymentSignature, refundPayment } from '@/lib/payment/razorpay';
import { sendCustomerConfirmation, sendAdminBookingAlert } from '@/lib/whatsapp/twilio-send';
import { ApiResponse } from '@/lib/types';

const HOURLY_RATE = parseInt(process.env.NEXT_PUBLIC_HOURLY_RATE || '50');
const DEPOSIT_AMOUNT = parseInt(process.env.DEPOSIT_AMOUNT || '50');

/**
 * POST /api/bookings/confirm
 * Called by the frontend after Razorpay payment succeeds.
 * Verifies signature, atomically checks time-range overlap, creates booking doc.
 * If time range is taken since initiate, refunds the payment and returns 409.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      bookingId,
      date,
      startTime,
      duration,
      customerName,
      customerEmail,
      customerPhone,
      paymentType,
    } = body;

    if (
      !razorpay_payment_id || !razorpay_order_id || !razorpay_signature ||
      !bookingId || !date || startTime === undefined || !duration ||
      !customerName || !customerEmail || !customerPhone ||
      (paymentType !== 'full' && paymentType !== 'deposit')
    ) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      console.error(`[confirm] Invalid signature for order ${razorpay_order_id}`);
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' } as ApiResponse<null>,
        { status: 401 }
      );
    }

    // Verify this Razorpay order was created for this bookingId (prevents payment swap attack)
    const orderDoc = await adminDb.doc(`razorpayOrders/${razorpay_order_id}`).get();
    if (!orderDoc.exists || orderDoc.data()?.bookingId !== bookingId) {
      console.error(`[confirm] Order ${razorpay_order_id} not bound to booking ${bookingId}`);
      return NextResponse.json(
        { success: false, error: 'Payment order does not match this booking' } as ApiResponse<null>,
        { status: 401 }
      );
    }

    try {
      await lockAndConfirmBooking(
        bookingId,
        { date, startTime, duration, customerName, customerEmail, customerPhone, paymentType },
        razorpay_payment_id,
        razorpay_order_id
      );
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('SLOT_CONFLICT')) {
        // Guard against duplicate confirm: already confirmed with same paymentId → 200
        const existingBooking = await getBooking(bookingId);
        if (existingBooking?.status === 'confirmed' && existingBooking.razorpayPaymentId === razorpay_payment_id) {
          console.log(`[confirm] Duplicate confirm for ${bookingId} — already confirmed`);
          return NextResponse.json(
            { success: true, message: 'Booking confirmed', data: { bookingId, status: 'confirmed' } } as ApiResponse<any>,
            { status: 200 }
          );
        }
        console.warn(`[confirm] Time conflict for ${bookingId} — refunding ${razorpay_payment_id}`);
        try {
          await refundPayment(razorpay_payment_id);
          console.log(`[confirm] Refund issued for ${razorpay_payment_id}`);
        } catch (refundErr) {
          console.error(`[confirm] Refund failed for ${razorpay_payment_id}:`, refundErr);
        }
        return NextResponse.json(
          { success: false, error: 'This time slot was just booked by someone else. Your payment has been refunded.' } as ApiResponse<null>,
          { status: 409 }
        );
      }
      throw err;
    }

    console.log(`[confirm] ✓ Booking ${bookingId} confirmed — ${date} ${duration}min for ${customerName}`);

    const totalAmount = Math.ceil(duration / 60) * HOURLY_RATE;
    const balanceDue = paymentType === 'full' ? 0 : totalAmount - DEPOSIT_AMOUNT;

    console.log(`[confirm] Sending WhatsApp to customer=${customerPhone} admins=3 bookingId=${bookingId}`);
    await Promise.all([
      sendCustomerConfirmation(customerPhone, { date, duration, balanceDue, bookingId, paymentType })
        .catch((e) => console.error('[confirm] Customer WA failed:', e)),
      sendAdminBookingAlert({ guestName: customerName, date, duration, balanceDue, bookingId, paymentType })
        .catch((e) => console.error('[confirm] Admin WA failed:', e)),
    ]);

    return NextResponse.json(
      { success: true, message: 'Booking confirmed', data: { bookingId, status: 'confirmed' } } as ApiResponse<any>,
      { status: 200 }
    );
  } catch (error) {
    console.error('[confirm] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to confirm booking' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
