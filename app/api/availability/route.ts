import { NextRequest, NextResponse } from 'next/server';
import { getAvailability, initializeSlotsForDate } from '@/lib/utils/availability';

/**
 * GET /api/availability?date=2026-06-15
 * Returns all available/booked slots for a given date
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD',
        },
        { status: 400 }
      );
    }

    // Validate date is not in the past
    const requestedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (requestedDate < today) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot book slots in the past',
        },
        { status: 400 }
      );
    }

    // Initialize slots if they don't exist
    try {
      await initializeSlotsForDate(date);
    } catch (error) {
      // Slots might already exist, continue
    }

    // Fetch availability and return all slots so the UI can grey out booked ones
    const availability = await getAvailability(date);

    return NextResponse.json(
      {
        success: true,
        message: 'Availability fetched successfully',
        data: availability,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch availability',
      },
      { status: 500 }
    );
  }
}
