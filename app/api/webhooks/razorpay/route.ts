import { NextRequest, NextResponse } from 'next/server';
import { verifyPaymentSignature, getPaymentDetails } from '@/lib/payment/razorpay';
import { confirmBookingPayment, getBooking } from '@/lib/booking/service';
import { ApiResponse } from '@/lib/types';

/**
 * POST /api/webhooks/razorpay
 * Webhook from Razorpay after successful payment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, payload } = body;

    // Only process payment.authorized and payment.captured events
    if (!['payment.authorized', 'payment.captured'].includes(event)) {
      return NextResponse.json({ received: true });
    }

    const { payment } = payload;
    const { id: paymentId, order_id: orderId, notes } = payment;

    // Verify signature
    const signature = request.headers.get('x-razorpay-signature') || '';
    const isValid = verifyPaymentSignature(orderId, paymentId, signature);

    if (!isValid) {
      console.error('Invalid Razorpay signature');
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid signature',
        } as ApiResponse<null>,
        { status: 401 }
      );
    }

    // Get booking ID from notes
    const bookingId = notes?.bookingId;
    if (!bookingId) {
      console.error('No bookingId in payment notes');
      return NextResponse.json(
        {
          success: false,
          error: 'Booking ID not found in payment',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Verify booking exists
    const booking = await getBooking(bookingId);
    if (!booking) {
      console.error(`Booking not found: ${bookingId}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Booking not found',
        } as ApiResponse<null>,
        { status: 404 }
      );
    }

    // Confirm payment and update booking
    await confirmBookingPayment(bookingId, paymentId, orderId);

    // Send email notification (optional - integrate with nodemailer/SendGrid)
    console.log(`✓ Payment confirmed for booking ${bookingId}`);
    console.log(`  Customer: ${booking.customerEmail}`);
    console.log(`  Amount: ₹${booking.depositPaid} deposited`);
    console.log(`  Remaining due: ₹${booking.amountDue}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Payment confirmed',
        data: { bookingId, status: 'confirmed' },
      } as ApiResponse<any>,
      { status: 200 }
    );
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process payment',
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
