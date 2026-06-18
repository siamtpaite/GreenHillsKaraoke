import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const BATCH_LIMIT = 500;

export async function POST(req: NextRequest) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers.get('x-admin-password') !== pw) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Fetch all bookings — filter in memory to avoid index/not-in limitations
    const snapshot = await adminDb.collection('bookings').get();

    // Group by (customerPhone, date, sorted hourList)
    const groups = new Map<string, Array<{ id: string; data: FirebaseFirestore.DocumentData }>>();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const { customerPhone, date, hourList, status } = data;

      // Skip already-resolved bookings
      if (['cancelled', 'completed', 'no_show'].includes(status)) continue;
      if (!customerPhone || !date || !Array.isArray(hourList) || hourList.length === 0) continue;

      const key = `${customerPhone}|${date}|${[...hourList].sort().join(',')}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ id: docSnap.id, data });
    }

    let duplicatesFound = 0;
    let duplicatesRemoved = 0;
    let batch = adminDb.batch();
    let opsInBatch = 0;

    const flushBatch = async () => {
      if (opsInBatch === 0) return;
      await batch.commit();
      console.log(`[cleanup-duplicates] Flushed batch of ${opsInBatch} ops`);
      batch = adminDb.batch();
      opsInBatch = 0;
    };

    const addOp = async (fn: (b: typeof batch) => void) => {
      if (opsInBatch >= BATCH_LIMIT) await flushBatch();
      fn(batch);
      opsInBatch++;
    };

    for (const [key, bookings] of groups) {
      if (bookings.length <= 1) continue;

      // Sort oldest-first by createdAt; keep the first
      bookings.sort((a, b) => {
        const aMs = a.data.createdAt?.toMillis?.() ?? 0;
        const bMs = b.data.createdAt?.toMillis?.() ?? 0;
        return aMs - bMs;
      });

      const [keeper, ...duplicates] = bookings;
      const keeperHours = new Set<string>(keeper.data.hourList);

      duplicatesFound += duplicates.length;
      console.log(`[cleanup-duplicates] Group: ${key}`);
      console.log(`  Keeping  ${keeper.id} (${keeper.data.status}, created ${keeper.data.createdAt?.toDate?.()})`);

      // Ensure the keeper's slots are correctly attributed to it
      for (const hour of keeper.data.hourList as string[]) {
        const slotRef = adminDb.doc(`availability/${keeper.data.date}/slots/${hour}`);
        await addOp((b) =>
          b.set(slotRef, { status: 'booked', bookingId: keeper.id, bookedAt: FieldValue.serverTimestamp() }, { merge: true })
        );
      }

      for (const dup of duplicates) {
        console.log(`  Removing ${dup.id} (${dup.data.status}, created ${dup.data.createdAt?.toDate?.()})`);

        // Release only slots the duplicate owns that the keeper does NOT share
        // (for true duplicates hourList is identical, so nothing gets released)
        for (const hour of dup.data.hourList as string[]) {
          if (!keeperHours.has(hour)) {
            const slotRef = adminDb.doc(`availability/${dup.data.date}/slots/${hour}`);
            await addOp((b) =>
              b.set(slotRef, { status: 'available', bookingId: null, bookedAt: null }, { merge: true })
            );
          }
        }

        // Hard-delete the duplicate booking document
        await addOp((b) => b.delete(adminDb.doc(`bookings/${dup.id}`)));
        duplicatesRemoved++;
      }
    }

    await flushBatch();

    console.log(`[cleanup-duplicates] Done — found ${duplicatesFound}, removed ${duplicatesRemoved}`);

    return NextResponse.json({ success: true, duplicatesFound, duplicatesRemoved });
  } catch (error) {
    console.error('[cleanup-duplicates] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
