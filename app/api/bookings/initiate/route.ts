import { NextRequest, NextResponse } from 'next/server';
import { createBooking } from '@/lib/booking/service';
import { areHoursAvailable, initializeSlotsForDate } from '@/lib/utils/availability';
import { createRazorpayOrder } from '@/lib/payment/razorpay';
import { BookingRequest, ApiResponse } from '@/lib/types';

const DEPOSIT_AMOUNT = parseInt(process.env.DEPOSIT_AMOUNT || '500');

/**
 * POST /api/bookings/initiate
 * Request body:
 * {
 *   "date": "2026-06-15",
 *   "startHour": 14,
 *   "hours": 2,
 *   "customerName": "John Doe",
 *   "customerEmail": "john@example.com",
 *   "customerPhone": "9876543210"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { date, startHour, hours, customerName, customerEmail, customerPhone } = body;

    if (
      !date ||
      startHour === undefined ||
      !hours ||
      !customerName ||
      !customerEmail ||
      !customerPhone
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Validate phone number (basic)
    if (!/^\d{10}$/.test(customerPhone.replace(/[^\d]/g, ''))) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid phone number',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Validate hours (1-8 hours max per booking)
    if (hours < 1 || hours > 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'Booking must be between 1 and 8 hours',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Make sure the date has slot documents initialized before checking availability.
    try {
      await initializeSlotsForDate(date);
    } catch (error) {
      // Ignore initialization errors and continue; the availability check below is resilient.
    }

    // Check if requested hours are available
    const available = await areHoursAvailable(date, startHour, hours);
    if (!available) {
      return NextResponse.json(
        {
          success: false,
          error: 'One or more requested time slots are already booked',
        } as ApiResponse<null>,
        { status: 409 }
      );
    }

    // Create booking (with transaction lock)
    const { bookingId, order } = await createBooking({
      date,
      startHour,
      hours,
      customerName,
      customerEmail,
      customerPhone,
    } as BookingRequest);

    // Create Razorpay order for deposit
    const razorpayOrder = await createRazorpayOrder(
      DEPOSIT_AMOUNT * 100, // Convert to paise
      bookingId,
      customerEmail,
      customerPhone
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Booking initiated. Proceed to payment.',
        data: {
          bookingId,
          razorpayOrder: {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            receipt: razorpayOrder.receipt,
          },
        },
      } as ApiResponse<any>,
      { status: 201 }
    );
  } catch (error) {
    console.error('Booking initiation error:', error);

    // Handle specific error messages
    if (error instanceof Error) {
      if (error.message.includes('already booked')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          } as ApiResponse<null>,
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initiate booking',
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
