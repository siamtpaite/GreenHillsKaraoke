import Razorpay from 'razorpay';
import crypto from 'crypto';

function getRazorpayClient() {
  // NEXT_PUBLIC_ prefix is for client bundles; server-side uses the unprefixed var.
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are not configured');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/**
 * Create a Razorpay order for booking deposit
 */
export async function createRazorpayOrder(
  amount: number, // in paise (₹500 = 50000 paise)
  bookingId: string,
  customerEmail: string,
  customerPhone: string
): Promise<any> {
  const razorpay = getRazorpayClient();
  const options = {
    amount,
    currency: 'INR',
    receipt: bookingId,
    notes: {
      bookingId,
      purpose: 'karaoke_deposit',
      customerEmail,
      customerPhone,
    },
  };

  try {
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    throw error;
  }
}

/**
 * Verify Razorpay payment signature (webhook verification)
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const message = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(message)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Fetch payment details from Razorpay
 */
export async function getPaymentDetails(paymentId: string): Promise<any> {
  try {
    const razorpay = getRazorpayClient();
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('Failed to fetch payment details:', error);
    throw error;
  }
}

/**
 * Refund a payment (if needed)
 */
export async function refundPayment(
  paymentId: string,
  amount?: number
): Promise<any> {
  try {
    const razorpay = getRazorpayClient();
    const refundOptions: any = {
      payment_id: paymentId,
    };

    if (amount) {
      refundOptions.amount = amount; // in paise
    }

    const refund = await razorpay.payments.refund(paymentId, refundOptions);
    return refund;
  } catch (error) {
    console.error('Refund failed:', error);
    throw error;
  }
}
