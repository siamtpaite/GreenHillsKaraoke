import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking, getBooking } from '@/lib/booking/service';
import { ApiResponse } from '@/lib/types';
import { sendAdminCancellationAlert, sendCustomerCancellationAlert } from '@/lib/whatsapp/baileys-send';

const normalisePhone = (p: string) => p.replace(/\D/g, '').slice(-10);

/**
 * POST /api/bookings/[bookingId]/cancel
 * Cancel a booking and release slots back to availability.
 * Requires customerPhone in the request body to prove ownership.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: 'Booking ID is required' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { customerPhone, cancellationToken } = body as { customerPhone?: string; cancellationToken?: string };

    const booking = await getBooking(bookingId);

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }

    if (booking.cancellationToken) {
      // New booking — token was issued at confirmation; require it
      if (!cancellationToken || cancellationToken !== booking.cancellationToken) {
        return NextResponse.json(
          { success: false, error: 'Invalid cancellation token. Check your WhatsApp booking confirmation.' } as ApiResponse<null>,
          { status: 403 }
        );
      }
    } else {
      // Legacy booking — no token was ever issued; fall back to phone-number match
      if (!customerPhone) {
        return NextResponse.json(
          { success: false, error: 'customerPhone is required for this booking' } as ApiResponse<null>,
          { status: 400 }
        );
      }
      if (normalisePhone(customerPhone) !== normalisePhone(booking.customerPhone)) {
        return NextResponse.json(
          { success: false, error: 'Phone number does not match booking' } as ApiResponse<null>,
          { status: 403 }
        );
      }
    }

    if (['completed', 'cancelled', 'no_show'].includes(booking.status)) {
      return NextResponse.json(
        { success: false, error: `Booking cannot be cancelled (status: ${booking.status})` } as ApiResponse<null>,
        { status: 409 }
      );
    }

    await cancelBooking(bookingId);

    const resolvedStart = booking.startTime ?? booking.startMinute ?? (booking.startHour != null ? booking.startHour * 60 : 0);
    const resolvedDuration = booking.duration ?? (booking.hours != null ? booking.hours * 60 : 60);
    console.log(`[Cancel] Sending WA — bookingId=${bookingId} phone=${booking.customerPhone} date=${booking.date} startTime=${resolvedStart} duration=${resolvedDuration}`);
    const [customerResult, adminResult] = await Promise.allSettled([
      sendCustomerCancellationAlert(booking.customerPhone, { date: booking.date, startTime: resolvedStart, duration: resolvedDuration, bookingId }),
      sendAdminCancellationAlert({ guestName: booking.customerName, customerPhone: booking.customerPhone, date: booking.date, startTime: resolvedStart, duration: resolvedDuration, paymentType: booking.paymentType, bookingId }),
    ]);

    const cVal = customerResult.status === 'fulfilled' ? customerResult.value : null;
    const aVal = adminResult.status === 'fulfilled' ? adminResult.value : null;
    console.log(`[Cancel] Customer WA result:`, customerResult.status === 'rejected' ? customerResult.reason : cVal);
    console.log(`[Cancel] Admin WA result:`, adminResult.status === 'rejected' ? adminResult.reason : aVal);
    if (customerResult.status === 'rejected') console.error('[Cancel] Customer WA threw:', customerResult.reason);
    if (adminResult.status === 'rejected') console.error('[Cancel] Admin WA threw:', adminResult.reason);

    return NextResponse.json(
      {
        success: true,
        message: 'Booking cancelled successfully. Deposit (₹500) is non-refundable.',
        data: {
          bookingId,
          status: 'cancelled',
          depositRefunded: false,
          notes: 'The ₹500 deposit has been retained. Time slots have been released.',
        },
      } as ApiResponse<any>,
      { status: 200 }
    );
  } catch (error) {
    console.error('Booking cancellation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel booking' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
