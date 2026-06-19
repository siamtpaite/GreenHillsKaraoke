import { adminDb } from '@/lib/firebase/admin';
import { AvailabilityResponse } from '@/lib/types';

const OPERATING_HOURS_START = parseInt(process.env.OPERATING_HOURS_START || '12');
const OPERATING_HOURS_END = parseInt(process.env.OPERATING_HOURS_END || '22');

// "780" → "1:00 PM", "1440" → "12:00 AM"
export function minutesToTime(minutes: number): string {
  const clamped = minutes >= 1440 ? 0 : minutes;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  if (minutes >= 1440) return '12:00 AM';
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

// "1:00 PM – 3:00 PM"
export function formatTimeRange(startTime: number, duration: number): string {
  return `${minutesToTime(startTime)} – ${minutesToTime(startTime + duration)}`;
}

// "2 hours", "1h 30min", "30 min"
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

export async function isBlackoutDate(date: string): Promise<boolean> {
  const snap = await adminDb.doc(`blackoutDates/${date}`).get();
  return snap.exists;
}

export async function getOperatingHours(date: string): Promise<{ open: number; close: number }> {
  const dayOfWeek = new Date(date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const snap = await adminDb.doc(`operatingHours/${dayOfWeek}`).get();
  if (snap.exists) {
    const data = snap.data()!;
    return { open: data.open || OPERATING_HOURS_START, close: data.close || OPERATING_HOURS_END };
  }
  return { open: OPERATING_HOURS_START, close: OPERATING_HOURS_END };
}

// Resolve a legacy booking's start/end times from any field format
function resolveRange(data: FirebaseFirestore.DocumentData): { start: number; end: number } {
  const start =
    data.startTime ??
    data.startMinute ??
    (data.startHour != null ? data.startHour * 60 : null) ??
    (data.hourList?.[0] != null ? Number(data.hourList[0]) * 60 : null) ??
    OPERATING_HOURS_START * 60;

  const duration =
    data.duration ??
    (data.hours != null ? data.hours * 60 : null) ??
    60;

  const end = data.endTime ?? start + duration;
  return { start, end };
}

// Fetch all confirmed/checked-in bookings for a date and return their time ranges
export async function getBookedRanges(date: string): Promise<AvailabilityResponse['bookedRanges']> {
  const snap = await adminDb
    .collection('bookings')
    .where('date', '==', date)
    .where('status', 'in', ['confirmed', 'checked_in'])
    .get();

  return snap.docs.map((doc) => {
    const { start, end } = resolveRange(doc.data());
    return { start, end, bookingId: doc.id };
  });
}

// Main availability endpoint response
export async function getAvailability(date: string): Promise<AvailabilityResponse> {
  if (await isBlackoutDate(date)) {
    return { date, blackout: true, bookedRanges: [] };
  }
  const bookedRanges = await getBookedRanges(date);
  return { date, bookedRanges };
}

// Fetch active slot holds (written by /initiate before payment, expire in 15 min)
async function getActiveSlotHolds(date: string): Promise<{ holdId: string; start: number; end: number }[]> {
  const now = Date.now();
  const snap = await adminDb
    .collection('slotHolds')
    .where('date', '==', date)
    .get();
  return snap.docs
    .filter((doc) => {
      const d = doc.data();
      return d.expiresAt && d.expiresAt.toMillis() > now;
    })
    .map((doc) => {
      const d = doc.data();
      return { holdId: doc.id, start: d.startTime, end: d.startTime + d.duration };
    });
}

// Check if [startTime, startTime+duration] is free of confirmed/checked-in bookings and active slot holds.
// excludeBookingId is used for edit flows (skip own booking when checking).
export async function isTimeRangeAvailable(
  date: string,
  startTime: number,
  duration: number,
  excludeBookingId?: string
): Promise<boolean> {
  const endTime = startTime + duration;
  const [bookingSnap, holds] = await Promise.all([
    adminDb
      .collection('bookings')
      .where('date', '==', date)
      .where('status', 'in', ['confirmed', 'checked_in'])
      .get(),
    getActiveSlotHolds(date),
  ]);

  for (const doc of bookingSnap.docs) {
    if (doc.id === excludeBookingId) continue;
    const { start: bStart, end: bEnd } = resolveRange(doc.data());
    if (startTime < bEnd && endTime > bStart) return false;
  }

  for (const hold of holds) {
    if (hold.holdId === excludeBookingId) continue;
    if (startTime < hold.end && endTime > hold.start) return false;
  }

  return true;
}
