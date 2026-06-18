import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const REVENUE_STATUSES = ['confirmed', 'pending_full_payment', 'checked_in', 'completed'];

export async function GET(req: NextRequest) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers.get('x-admin-password') !== pw) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') ?? 'week';

    const today = new Date().toISOString().split('T')[0];
    let startDate: string;

    if (period === 'today') {
      startDate = today;
    } else if (period === 'week') {
      startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else {
      startDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    const snapshot = await adminDb
      .collection('bookings')
      .where('date', '>=', startDate)
      .where('date', '<=', today)
      .get();

    let totalRevenue = 0;
    let bookingsCount = 0;
    let pendingPayments = 0;
    let noShows = 0;
    let cancellations = 0;

    const dailyMap = new Map<string, { revenue: number; count: number }>();

    for (const doc of snapshot.docs) {
      const { date, status, totalAmount, amountDue } = doc.data();

      if (REVENUE_STATUSES.includes(status)) {
        const amount = totalAmount ?? 0;
        totalRevenue += amount;
        bookingsCount++;

        const day = dailyMap.get(date) ?? { revenue: 0, count: 0 };
        day.revenue += amount;
        day.count++;
        dailyMap.set(date, day);
      }

      if (status === 'pending_full_payment') {
        pendingPayments += amountDue ?? 0;
      }
      if (status === 'no_show') noShows++;
      if (status === 'cancelled') cancellations++;
    }

    const dailyData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { revenue, count }]) => ({ date, revenue, count }));

    return NextResponse.json({
      success: true,
      data: { totalRevenue, bookingsCount, pendingPayments, noShows, cancellations, dailyData },
    });
  } catch (error) {
    console.error('[analytics] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
