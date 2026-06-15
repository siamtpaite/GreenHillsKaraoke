import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

const DEFAULT_STALE_MINUTES = 60;

/**
 * POST /api/admin/cleanup-stale-pending
 * Deletes stale razorpayOrders docs created by abandoned payment initiations
 * (i.e. /api/bookings/initiate was called, Razorpay order was created, but the
 * customer never completed payment so /api/bookings/confirm was never called).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword || body.password !== adminPassword) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const staleMinutes: number = body.staleMinutes ?? DEFAULT_STALE_MINUTES;
    const cutoff = Timestamp.fromDate(new Date(Date.now() - staleMinutes * 60 * 1000));

    const snapshot = await adminDb
      .collection('razorpayOrders')
      .where('createdAt', '<', cutoff)
      .get();

    if (snapshot.empty) {
      console.log('[cleanup-pending] No stale razorpayOrders found');
      return NextResponse.json({ success: true, cleaned: 0 });
    }

    let cleaned = 0;
    let batch = adminDb.batch();
    let opsInBatch = 0;

    const flush = async () => {
      if (opsInBatch === 0) return;
      await batch.commit();
      batch = adminDb.batch();
      opsInBatch = 0;
    };

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      console.log(`[cleanup-pending] Deleting stale order ${docSnap.id} (bookingId: ${data.bookingId})`);
      if (opsInBatch >= 499) await flush();
      batch.delete(docSnap.ref);
      opsInBatch++;
      cleaned++;
    }

    await flush();

    console.log(`[cleanup-pending] Done — ${cleaned} stale razorpayOrders removed`);
    return NextResponse.json({ success: true, cleaned });
  } catch (error) {
    console.error('[cleanup-pending] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
