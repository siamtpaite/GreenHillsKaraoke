import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(req: NextRequest) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers.get('x-admin-password') !== pw) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const snapshot = await adminDb.collection('blackoutDates').orderBy('date', 'asc').get();
    const dates = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ success: true, data: dates });
  } catch (error) {
    console.error('[blackout-dates] GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch blackout dates' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers.get('x-admin-password') !== pw) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { dates } = body as { dates: { date: string; reason: string }[] };

    if (!Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ success: false, error: 'dates array is required' }, { status: 400 });
    }

    const batch = adminDb.batch();
    for (const { date, reason } of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const ref = adminDb.doc(`blackoutDates/${date}`);
      batch.set(ref, {
        date,
        reason: reason?.trim() || 'Closed',
        createdBy: 'admin',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    console.log(`[blackout-dates] Blocked ${dates.length} date(s):`, dates.map((d) => d.date).join(', '));
    return NextResponse.json({ success: true, datesBlocked: dates.length });
  } catch (error) {
    console.error('[blackout-dates] POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to block dates' }, { status: 500 });
  }
}
