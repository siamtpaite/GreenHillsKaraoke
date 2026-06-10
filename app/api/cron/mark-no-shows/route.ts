import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendWhatsAppNotification } from '@/lib/whatsapp/baileys-send';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'GreenHills2021';
// Statuses that represent a booking which should have been attended
const ELIGIBLE_STATUSES = ['confirmed', 'pending_full_payment'];

async function runNoShowCheck() {
  const now = new Date();
  let noShowsMarked = 0;

  for (const status of ELIGIBLE_STATUSES) {
    const snapshot = await adminDb
      .collection('bookings')
      .where('status', '==', status)
      .get();

    console.log(`[no-show] Checking ${snapshot.size} bookings with status '${status}'`);

    for (const docSnap of snapshot.docs) {
      const booking = docSnap.data();
      const { date, hours, startHour, hourList, customerName, checkInTime } = booking;

      if (!date || !hours) {
        console.warn(`[no-show] Skipping ${docSnap.id} — missing date or hours`);
        continue;
      }

      // Derive start hour from startHour field or first entry in hourList
      const effectiveStart: number = startHour ?? Number(hourList?.[0] ?? 0);
      const endHour = effectiveStart + hours;

      // Slot end time in IST (UTC+05:30)
      const slotEnd = new Date(
        `${date}T${endHour.toString().padStart(2, '0')}:00:00+05:30`
      );

      if (now <= slotEnd) {
        console.log(`[no-show] Skipping ${docSnap.id} — slot hasn't ended yet (ends ${slotEnd.toISOString()})`);
        continue;
      }

      if (checkInTime) {
        console.log(`[no-show] Skipping ${docSnap.id} — guest checked in`);
        continue;
      }

      // Mark as no-show
      await adminDb.doc(`bookings/${docSnap.id}`).update({
        status: 'no_show',
        noShowMarkedAt: FieldValue.serverTimestamp(),
      });

      console.log(`[no-show] Marked ${docSnap.id} (${customerName}) — ${date} ${effectiveStart}:00 IST`);
      noShowsMarked++;

      // Notify admin group
      sendWhatsAppNotification({
        bookingId: docSnap.id,
        customerName,
        date,
        hours,
        totalAmount: booking.totalAmount,
        startHour: effectiveStart,
        eventType: 'no_show',
      }).catch((err) => console.error(`[no-show] WA failed for ${docSnap.id}:`, err));
    }
  }

  console.log(`[no-show] Done — ${noShowsMarked} bookings marked`);
  return NextResponse.json({ success: true, noShowsMarked });
}

// GET — invoked by Vercel cron (Authorization: Bearer <CRON_SECRET>)
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return runNoShowCheck();
}

// POST — manual trigger (body: { password })
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.password !== ADMIN_PASSWORD) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return runNoShowCheck();
}
