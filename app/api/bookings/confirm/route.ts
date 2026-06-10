import { NextRequest, NextResponse } from 'next/server';
import { lockAndConfirmBooking } from '@/lib/booking/service';
import { verifyPaymentSignature, refundPayment } from '@/lib/payment/razorpay';
import { sendWhatsAppNotification, formatCustomerJid } from '@/lib/whatsapp/baileys-send';
import { ApiResponse } from '@/lib/types';

const HOURLY_RATE = parseInt(process.env.NEXT_PUBLIC_HOURLY_RATE || '1180');
const DEPOSIT_AMOUNT = parseInt(process.env.DEPOSIT_AMOUNT || '500');

/**
 * POST /api/bookings/confirm
 * Called by the frontend after Razorpay payment succeeds.
 * Verifies the payment signature, then atomically locks the slots and creates
 * a confirmed booking. If the slots were taken between initiate and confirm,
 * the payment is refunded and a 409 is returned.
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
      startHour,
      hours,
      customerName,
      customerEmail,
      customerPhone,
    } = body;

    if (
      !razorpay_payment_id || !razorpay_order_id || !razorpay_signature ||
      !bookingId || !date || startHour === undefined || !hours ||
      !customerName || !customerEmail || !customerPhone
    ) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Verify Razorpay signature before touching Firestore
    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      console.error(`[confirm] Invalid signature for order ${razorpay_order_id}`);
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' } as ApiResponse<null>,
        { status: 401 }
      );
    }

    // Atomically check slots, lock them, and create the booking doc
    try {
      await lockAndConfirmBooking(
        bookingId,
        { date, startHour, hours, customerName, customerEmail, customerPhone },
        razorpay_payment_id,
        razorpay_order_id
      );
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('SLOT_CONFLICT')) {
        console.warn(`[confirm] Slot conflict for ${bookingId} — issuing refund for ${razorpay_payment_id}`);
        try {
          await refundPayment(razorpay_payment_id);
          console.log(`[confirm] Refund issued for ${razorpay_payment_id}`);
        } catch (refundErr) {
          console.error(`[confirm] Refund failed for ${razorpay_payment_id}:`, refundErr);
        }
        return NextResponse.json(
          {
            success: false,
            error: 'These slots were just booked by someone else. Your payment has been refunded.',
          } as ApiResponse<null>,
          { status: 409 }
        );
      }
      throw err;
    }

    console.log(`[confirm] ✓ Booking ${bookingId} confirmed — ${date} ${hours}h for ${customerName}`);

    // Fire WhatsApp notifications — don't await, booking is already committed
    const totalAmount = HOURLY_RATE * hours;
    const amountDue = totalAmount - DEPOSIT_AMOUNT;
    const waBase = { bookingId, customerName, date, hours, totalAmount, amountDue, startHour };

    sendWhatsAppNotification(
      { ...waBase, eventType: 'customer_booking_confirmed' },
      formatCustomerJid(customerPhone)
    ).catch((e) => console.error('[confirm] Customer WA failed:', e));

    sendWhatsAppNotification(
      { ...waBase, eventType: 'booking_confirmed' }
    ).catch((e) => console.error('[confirm] Admin WA failed:', e));

    return NextResponse.json(
      {
        success: true,
        message: 'Booking confirmed',
        data: { bookingId, status: 'confirmed' },
      } as ApiResponse<any>,
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
