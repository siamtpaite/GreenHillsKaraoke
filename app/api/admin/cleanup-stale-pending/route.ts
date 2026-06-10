import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'GreenHills2021';
// Bookings stuck in pending_payment longer than this are considered orphaned
const DEFAULT_STALE_MINUTES = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.password !== ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const staleMinutes: number = body.staleMinutes ?? DEFAULT_STALE_MINUTES;
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);

    const snapshot = await adminDb
      .collection('bookings')
      .where('status', '==', 'pending_payment')
      .get();

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
      const createdAt: Date = data.createdAt?.toDate?.() ?? new Date(0);

      if (createdAt > cutoff) {
        console.log(`[cleanup-pending] Skipping ${docSnap.id} — created ${createdAt.toISOString()}, within cutoff`);
        continue;
      }

      console.log(`[cleanup-pending] Releasing ${docSnap.id} (${data.customerName}) — ${data.date}, created ${createdAt.toISOString()}`);

      // Release each slot
      for (const hour of (data.hourList ?? [])) {
        if (opsInBatch >= 499) await flush();
        const slotRef = adminDb.doc(`availability/${data.date}/slots/${hour}`);
        batch.set(slotRef, { status: 'available', bookingId: null, bookedAt: null }, { merge: true });
        opsInBatch++;
      }

      // Delete the orphaned booking document
      if (opsInBatch >= 499) await flush();
      batch.delete(adminDb.doc(`bookings/${docSnap.id}`));
      opsInBatch++;
      cleaned++;
    }

    await flush();

    console.log(`[cleanup-pending] Done — ${cleaned} stale pending_payment bookings removed`);
    return NextResponse.json({ success: true, cleaned });
  } catch (error) {
    console.error('[cleanup-pending] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
