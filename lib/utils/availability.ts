import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { Slot, AvailabilityResponse } from '@/lib/types';

const OPERATING_HOURS_START = parseInt(process.env.OPERATING_HOURS_START || '12');
const OPERATING_HOURS_END = parseInt(process.env.OPERATING_HOURS_END || '22');

export function formatTimeSlot(hour: number): string {
  const start = new Date();
  start.setHours(hour, 0, 0);
  const end = new Date();
  end.setHours(hour + 1, 0, 0);
  return `${start.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${end.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

export async function isBlackoutDate(date: string): Promise<boolean> {
  const snap = await adminDb.doc(`blackoutDates/${date}`).get();
  return snap.exists;
}

export async function getOperatingHours(date: string): Promise<{ open: number; close: number }> {
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const snap = await adminDb.doc(`operatingHours/${dayOfWeek}`).get();
  if (snap.exists) {
    const data = snap.data()!;
    return { open: data.open || OPERATING_HOURS_START, close: data.close || OPERATING_HOURS_END };
  }
  return { open: OPERATING_HOURS_START, close: OPERATING_HOURS_END };
}

export async function getAvailability(date: string): Promise<AvailabilityResponse> {
  if (await isBlackoutDate(date)) {
    return { date, blackout: true, slots: [] };
  }
  const hours = await getOperatingHours(date);
  const slots: AvailabilityResponse['slots'] = [];
  for (let hour = hours.open; hour < hours.close; hour++) {
    const snap = await adminDb.doc(`availability/${date}/slots/${hour}`).get();
    const status = snap.exists ? (snap.data()!.status as Slot['status']) : 'available';
    slots.push({ hour, status, timeSlot: formatTimeSlot(hour) });
  }
  return { date, slots };
}

export async function initializeSlotsForDate(date: string): Promise<void> {
  const existing = await adminDb.collection(`availability/${date}/slots`).get();
  if (!existing.empty) return;
  const hours = await getOperatingHours(date);
  const batch = adminDb.batch();
  for (let hour = hours.open; hour < hours.close; hour++) {
    batch.set(adminDb.doc(`availability/${date}/slots/${String(hour)}`), {
      status: 'available',
      hour,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function areHoursAvailable(date: string, startHour: number, numHours: number): Promise<boolean> {
  for (let i = 0; i < numHours; i++) {
    const snap = await adminDb.doc(`availability/${date}/slots/${String(startHour + i)}`).get();
    if (snap.exists && snap.data()!.status !== 'available') return false;
  }
  return true;
}

export function formatHour(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0);
  return date.toLocaleString('en-US', { hour: 'numeric', hour12: true });
}

export function generateHourList(startHour: number, numHours: number): string[] {
  return Array.from({ length: numHours }, (_, i) => String(startHour + i));
}
