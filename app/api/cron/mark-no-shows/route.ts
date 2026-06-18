import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendWhatsAppMessage } from '@/lib/whatsapp/baileys-send';

const ADMIN_NUMBERS = ['+919089402122', '+918413853992', '+917085766889'];
const ACTIVE_STATUSES = ['confirmed', 'pending_full_payment'];

async function runNoShowCheck() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  let noShowsMarked = 0;

  for (const status of ACTIVE_STATUSES) {
    // S10: filter to today and earlier to avoid scanning future bookings
    const snapshot = await adminDb
      .collection('bookings')
      .where('status', '==', status)
      .where('date', '<=', today)
      .get();

    console.log(`[no-show] Checking ${snapshot.size} bookings with status '${status}'`);

    for (const docSnap of snapshot.docs) {
      const booking = docSnap.data();
      const { date, customerName, checkInTime } = booking;

      if (!date) {
        console.warn(`[no-show] Skipping ${docSnap.id} — missing date`);
        continue;
      }

      // Resolve end time from new (startTime/duration) or legacy (startHour/hours) fields
      const startTime = booking.startTime ?? booking.startMinute ?? (booking.startHour ?? 0) * 60;
      const duration = booking.duration ?? (booking.hours ?? 1) * 60;
      const endTime = booking.endTime ?? startTime + duration;

      const endHour = Math.floor(endTime / 60) % 24;
      const endMin = endTime % 60;
      const slotEnd = new Date(
        `${date}T${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00+05:30`
      );

      if (now <= slotEnd) {
        console.log(`[no-show] Skipping ${docSnap.id} — slot ends ${slotEnd.toISOString()}`);
        continue;
      }

      if (checkInTime) {
        console.log(`[no-show] Skipping ${docSnap.id} — guest checked in`);
        continue;
      }

      await adminDb.doc(`bookings/${docSnap.id}`).update({
        status: 'no_show',
        noShowMarkedAt: FieldValue.serverTimestamp(),
      });

      console.log(`[no-show] Marked ${docSnap.id} (${customerName}) — ${date}`);
      noShowsMarked++;

      const message =
        `[NO-SHOW] 🚫\nGuest: ${customerName}\nDate: ${date}\nBooking ID: ${docSnap.id}`;
      for (const number of ADMIN_NUMBERS) {
        sendWhatsAppMessage({ to: number, message }).catch((e) =>
          console.error(`[no-show] WA to ${number} failed:`, e)
        );
      }
    }
  }

  console.log(`[no-show] Done — ${noShowsMarked} bookings marked`);
  return NextResponse.json({ success: true, noShowsMarked });
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return runNoShowCheck();
}

export async function POST(req: NextRequest) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers.get('x-admin-password') !== pw) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return runNoShowCheck();
}
