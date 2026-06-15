import { NextRequest, NextResponse } from 'next/server';
import { getAvailability } from '@/lib/utils/availability';

/**
 * GET /api/availability?date=2026-06-15
 * Returns booked time ranges for a date. The UI overlays these on the timeline.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(date + 'T00:00:00') < today) {
      return NextResponse.json(
        { success: false, error: 'Cannot check availability for past dates' },
        { status: 400 }
      );
    }

    const availability = await getAvailability(date);
    return NextResponse.json({ success: true, data: availability }, { status: 200 });
  } catch (error) {
    console.error('[availability] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch availability' }, { status: 500 });
  }
}
