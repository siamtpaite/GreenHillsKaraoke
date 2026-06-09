import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Booking, ApiResponse } from '@/lib/types';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'GreenHills2021';
const ACTIVE_STATUSES = ['confirmed', 'pending_full_payment', 'checked_in'];

/**
 * POST /api/admin/resync-slots
 * One-time repair: restores 'booked' status on availability slots for all active bookings.
 * Slots were corrupted to 'available' by a bug in initializeSlotsForDate (missing merge:true).
 * Body: { password: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'Invalid password' } as ApiResponse<null>,
        { status: 401 }
      );
    }

    let bookingCount = 0;
    let slotCount = 0;

    for (const status of ACTIVE_STATUSES) {
      const snapshot = await adminDb
        .collection('bookings')
        .where('status', '==', status)
        .get();

      for (const bookingDoc of snapshot.docs) {
        const booking = bookingDoc.data() as Booking & { status: string };
        const { date, hourList } = booking;
        const bookingId = bookingDoc.id;

        if (!date || !hourList?.length) {
          console.warn(`[resync-slots] Skipping booking ${bookingId} — missing date or hourList`);
          continue;
        }

        for (const hour of hourList) {
          const slotRef = adminDb.doc(`availability/${date}/slots/${hour}`);
          await slotRef.set(
            { status: 'booked', bookingId, bookedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
          slotCount++;
        }

        bookingCount++;
        console.log(
          `[resync-slots] Synced booking ${bookingId} (${status}) — ${date} hours: ${hourList.join(', ')}`
        );
      }
    }

    const summary = `Synced ${bookingCount} bookings, ${slotCount} slots restored`;
    console.log(`[resync-slots] Done — ${summary}`);

    return NextResponse.json({
      success: true,
      message: summary,
      data: { bookingCount, slotCount },
    } as ApiResponse<{ bookingCount: number; slotCount: number }>);
  } catch (error) {
    console.error('[resync-slots] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Resync failed', error: 'Internal server error' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}
