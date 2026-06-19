import { NextRequest, NextResponse } from 'next/server';
import { isTimeRangeAvailable, isBlackoutDate, getOperatingHours } from '@/lib/utils/availability';
import { createRazorpayOrder } from '@/lib/payment/razorpay';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ApiResponse } from '@/lib/types';

const HOURLY_RATE = parseInt(process.env.NEXT_PUBLIC_HOURLY_RATE || '1180');
const DEPOSIT_AMOUNT = parseInt(process.env.NEXT_PUBLIC_DEPOSIT_AMOUNT || '500');
const MIN_DURATION = 30;   // minutes
const MAX_DURATION = 480;  // minutes (8 hours)

/**
 * POST /api/bookings/initiate
 * Validates request, does an optimistic time-range availability check, then creates a Razorpay order.
 * No booking doc is written here — the booking is committed atomically in /confirm after payment.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, startTime, duration, customerName, customerEmail, customerPhone, paymentType } = body;

    if (!date || startTime === undefined || !duration || !customerName || !customerEmail || !customerPhone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: date, startTime, duration, customerName, customerEmail, customerPhone' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (paymentType !== 'full' && paymentType !== 'deposit') {
      return NextResponse.json(
        { success: false, error: 'paymentType must be "full" or "deposit"' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
    if (date < today) {
      return NextResponse.json(
        { success: false, error: 'Cannot book a date in the past' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(customerPhone.replace(/[^\d]/g, ''))) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (typeof startTime !== 'number' || startTime % 5 !== 0 || startTime < 0) {
      return NextResponse.json(
        { success: false, error: 'startTime must be a non-negative multiple of 5 (minutes from midnight)' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (typeof duration !== 'number' || duration % 5 !== 0 || duration < MIN_DURATION || duration > MAX_DURATION) {
      return NextResponse.json(
        { success: false, error: `duration must be a multiple of 5, between ${MIN_DURATION} and ${MAX_DURATION} minutes` } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (await isBlackoutDate(date)) {
      return NextResponse.json(
        { success: false, error: 'This date is unavailable for booking' } as ApiResponse<null>,
        { status: 409 }
      );
    }

    const operatingHours = await getOperatingHours(date);
    const openMinute = operatingHours.open * 60;
    const closeMinute = operatingHours.close * 60;
    if (startTime < openMinute || (startTime + duration) > closeMinute) {
      return NextResponse.json(
        { success: false, error: 'Requested time is outside operating hours' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    const available = await isTimeRangeAvailable(date, startTime, duration);
    if (!available) {
      return NextResponse.json(
        { success: false, error: 'The selected time range is already booked' } as ApiResponse<null>,
        { status: 409 }
      );
    }

    const bookingId = adminDb.collection('bookings').doc().id;
    const totalAmount = Math.ceil(duration / 60) * HOURLY_RATE;
    const razorpayAmount = paymentType === 'full' ? totalAmount * 100 : DEPOSIT_AMOUNT * 100;

    const razorpayOrder = await createRazorpayOrder(
      razorpayAmount,
      bookingId,
      customerEmail,
      customerPhone
    );

    await adminDb.doc(`razorpayOrders/${razorpayOrder.id}`).set({
      bookingId,
      paymentType,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Write a 15-minute slot hold so concurrent initiate requests see this slot as taken
    await adminDb.doc(`slotHolds/${bookingId}`).set({
      date,
      startTime,
      duration,
      bookingId,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)),
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Order created. Proceed to payment.',
        data: {
          bookingId,
          paymentType,
          totalAmount,
          razorpayOrder: {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
          },
        },
      } as ApiResponse<any>,
      { status: 201 }
    );
  } catch (error) {
    console.error('[initiate] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initiate booking' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
