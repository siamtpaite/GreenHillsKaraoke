import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  getDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Slot, AvailabilityResponse } from '@/lib/types';

const OPERATING_HOURS_START = parseInt(process.env.OPERATING_HOURS_START || '12');
const OPERATING_HOURS_END = parseInt(process.env.OPERATING_HOURS_END || '22');

/**
 * Generate time slot display (e.g., "12:00 PM - 1:00 PM")
 */
export function formatTimeSlot(hour: number): string {
  const start = new Date();
  start.setHours(hour, 0, 0);
  const end = new Date();
  end.setHours(hour + 1, 0, 0);

  const startStr = start.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const endStr = end.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${startStr} - ${endStr}`;
}

/**
 * Check if a date is blackout (closed)
 */
export async function isBlackoutDate(date: string): Promise<boolean> {
  const blackoutRef = doc(db, `blackoutDates/${date}`);
  const blackoutSnap = await getDoc(blackoutRef);
  return blackoutSnap.exists();
}

/**
 * Get operating hours for a specific day of week
 */
export async function getOperatingHours(
  date: string
): Promise<{ open: number; close: number }> {
const dayOfWeek = new Date(date).toLocaleDateString('en-US', {
  weekday: 'long',
}).toLowerCase();

  const hoursRef = doc(db, `operatingHours/${dayOfWeek}`);
  const hoursSnap = await getDoc(hoursRef);

  if (hoursSnap.exists()) {
    const data = hoursSnap.data() as any;
    return {
      open: data.open || OPERATING_HOURS_START,
      close: data.close || OPERATING_HOURS_END,
    };
  }

  return {
    open: OPERATING_HOURS_START,
    close: OPERATING_HOURS_END,
  };
}

/**
 * Get all slots for a date with their current status
 */
export async function getAvailability(date: string): Promise<AvailabilityResponse> {
  // Check if blackout
  if (await isBlackoutDate(date)) {
    return {
      date,
      slots: [],
    };
  }

  const hours = await getOperatingHours(date);
  const slots: AvailabilityResponse['slots'] = [];

  for (let hour = hours.open; hour < hours.close; hour++) {
    const slotRef = doc(db, `availability/${date}/slots/${hour}`);
    const slotSnap = await getDoc(slotRef);

    const status = slotSnap.exists()
      ? (slotSnap.data().status as Slot['status'])
      : 'available';

    slots.push({
      hour,
      status,
      timeSlot: formatTimeSlot(hour),
    });
  }

  return {
    date,
    slots,
  };
}

/**
 * Initialize slots for a date (called once per date)
 */
export async function initializeSlotsForDate(date: string): Promise<void> {
  const hours = await getOperatingHours(date);

  const batch = writeBatch(db);

  for (let hour = hours.open; hour < hours.close; hour++) {
    const slotRef = doc(db, `availability/${date}/slots/${String(hour)}`);
    batch.set(slotRef, {
      status: 'available',
      hour,
      createdAt: serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
}

/**
 * Check if consecutive hours are available
 */
export async function areHoursAvailable(
  date: string,
  startHour: number,
  numHours: number
): Promise<boolean> {
  for (let i = 0; i < numHours; i++) {
    const hour = startHour + i;
    const slotRef = doc(db, `availability/${date}/slots/${String(hour)}`);
    const slotSnap = await getDoc(slotRef);

    if (slotSnap.exists() && slotSnap.data().status !== 'available') {
      return false;
    }
  }

  return true;
}

/**
 * Format hour number to time display
 */
export function formatHour(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0);
  return date.toLocaleString('en-US', {
    hour: 'numeric',
    hour12: true,
  });
}

/**
 * Generate hour list for a booking
 */
export function generateHourList(startHour: number, numHours: number): string[] {
  return Array.from({ length: numHours }, (_, i) =>
    String(startHour + i)
  );
}