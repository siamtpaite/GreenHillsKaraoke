import Razorpay from 'razorpay';
import crypto from 'crypto';

function getCredentials() {
  const keyId =
    process.env.TEST_NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret =
    process.env.TEST_RAZORPAY_KEY_SECRET ||
    process.env.RAZORPAY_KEY_SECRET;
  return { keyId, keySecret };
}

function getRazorpayClient() {
  const { keyId, keySecret } = getCredentials();

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
 * Verify Razorpay payment signature — for client-side confirmation after payment.success.
 * Uses key_secret and signs "orderId|paymentId".
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const { keySecret } = getCredentials();
  if (!keySecret) throw new Error('Razorpay credentials are not configured');
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expectedSignature === signature;
}

/**
 * Verify Razorpay webhook signature — for server-side webhook events.
 * Uses RAZORPAY_WEBHOOK_SECRET and signs the raw request body.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
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
