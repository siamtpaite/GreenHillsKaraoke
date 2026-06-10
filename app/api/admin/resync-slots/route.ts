import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Booking, ApiResponse } from '@/lib/types';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'GreenHills2021';
const ACTIVE_STATUSES = ['confirmed', 'pending_full_payment', 'checked_in'];
const BATCH_LIMIT = 500;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'Invalid password' } as ApiResponse<null>,
        { status: 401 }
      );
    }

    let bookingsProcessed = 0;
    let slotsRestored = 0;

    // Collect all slot writes across statuses, then flush in batches of 500
    let batch = adminDb.batch();
    let opsInBatch = 0;

    const flushBatch = async () => {
      if (opsInBatch === 0) return;
      await batch.commit();
      console.log(`[resync-slots] Flushed batch of ${opsInBatch} ops`);
      batch = adminDb.batch();
      opsInBatch = 0;
    };

    for (const status of ACTIVE_STATUSES) {
      const snapshot = await adminDb
        .collection('bookings')
        .where('status', '==', status)
        .get();

      console.log(`[resync-slots] Found ${snapshot.docs.length} bookings with status '${status}'`);

      for (const bookingDoc of snapshot.docs) {
        const booking = bookingDoc.data() as Booking & { status: string };
        const { date, hourList } = booking;
        const bookingId = bookingDoc.id;

        if (!date || !hourList?.length) {
          console.warn(`[resync-slots] Skipping booking ${bookingId} — missing date or hourList`);
          continue;
        }

        for (const hour of hourList) {
          if (opsInBatch >= BATCH_LIMIT) {
            await flushBatch();
          }

          const slotRef = adminDb.doc(`availability/${date}/slots/${hour}`);
          batch.set(
            slotRef,
            { status: 'booked', bookingId, bookedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
          opsInBatch++;
          slotsRestored++;
        }

        bookingsProcessed++;
        console.log(
          `[resync-slots] Queued booking ${bookingId} (${status}) — ${date} hours: ${hourList.join(', ')}`
        );
      }
    }

    await flushBatch();

    console.log(`[resync-slots] Done — bookingsProcessed: ${bookingsProcessed}, slotsRestored: ${slotsRestored}`);

    return NextResponse.json({ success: true, bookingsProcessed, slotsRestored });
  } catch (error) {
    console.error('[resync-slots] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Resync failed', error: 'Internal server error' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
