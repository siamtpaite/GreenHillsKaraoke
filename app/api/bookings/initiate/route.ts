import { NextRequest, NextResponse } from 'next/server';
import { initializeSlotsForDate, areHoursAvailable, isBlackoutDate } from '@/lib/utils/availability';
import { createRazorpayOrder } from '@/lib/payment/razorpay';
import { adminDb } from '@/lib/firebase/admin';
import { ApiResponse } from '@/lib/types';

const DEPOSIT_AMOUNT = parseInt(process.env.DEPOSIT_AMOUNT || '500');

/**
 * POST /api/bookings/initiate
 * Validates the request, does an optimistic availability check, then creates a
 * Razorpay order. No Firestore booking doc is written here — slots are locked
 * atomically in POST /api/bookings/confirm after payment succeeds.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, startHour, hours, customerName, customerEmail, customerPhone } = body;

    if (!date || startHour === undefined || !hours || !customerName || !customerEmail || !customerPhone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(customerPhone.replace(/[^\d]/g, ''))) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (hours < 1 || hours > 8) {
      return NextResponse.json(
        { success: false, error: 'Booking must be between 1 and 8 hours' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    if (await isBlackoutDate(date)) {
      return NextResponse.json(
        { success: false, error: 'This date is unavailable for booking' } as ApiResponse<null>,
        { status: 409 }
      );
    }

    // Ensure slot docs exist, then do an optimistic availability check.
    // This is not the authoritative lock — that happens in /confirm.
    try { await initializeSlotsForDate(date); } catch {}

    const available = await areHoursAvailable(date, startHour, hours);
    if (!available) {
      return NextResponse.json(
        { success: false, error: 'One or more requested time slots are already booked' } as ApiResponse<null>,
        { status: 409 }
      );
    }

    // Generate a booking ID that will be used as the Firestore doc key at confirm time.
    const bookingId = adminDb.collection('bookings').doc().id;

    const razorpayOrder = await createRazorpayOrder(
      DEPOSIT_AMOUNT * 100,
      bookingId,
      customerEmail,
      customerPhone
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Order created. Proceed to payment.',
        data: {
          bookingId,
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
