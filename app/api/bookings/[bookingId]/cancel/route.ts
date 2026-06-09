import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking, getBooking } from '@/lib/booking/service';
import { ApiResponse } from '@/lib/types';
import { sendWhatsAppNotification, formatCustomerJid } from '@/lib/whatsapp/baileys-send';

/**
 * POST /api/bookings/[bookingId]/cancel
 * Cancel a booking and release slots back to availability
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;

    if (!bookingId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Booking ID is required',
        } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Verify booking exists and is cancellable
    const booking = await getBooking(bookingId);

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          error: 'Booking not found',
        } as ApiResponse<null>,
        { status: 404 }
      );
    }

    // Check if booking can be cancelled
    if (['completed', 'cancelled', 'no_show'].includes(booking.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Booking cannot be cancelled (current status: ${booking.status})`,
        } as ApiResponse<null>,
        { status: 409 }
      );
    }

    // Cancel the booking (releases slots)
    await cancelBooking(bookingId);

    const waPayload = {
      bookingId,
      customerName: booking.customerName,
      date: booking.date,
      hours: booking.hours,
      totalAmount: booking.totalAmount,
    };

    // Notify customer
    sendWhatsAppNotification(
      { ...waPayload, eventType: 'customer_cancelled' },
      formatCustomerJid(booking.customerPhone)
    ).catch((err) => console.error('[Cancel] Customer WA failed:', err));

    // Notify admin group
    sendWhatsAppNotification(
      { ...waPayload, eventType: 'cancelled' }
    ).catch((err) => console.error('[Cancel] Admin WA failed:', err));

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
      {
        success: false,
        error: 'Failed to cancel booking',
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
