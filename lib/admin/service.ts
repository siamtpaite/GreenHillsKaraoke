import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { adminDb } from './firebase/admin';
import { Booking } from './types';

/**
 * Add a blackout date (close the karaoke for the day)
 */
export async function addBlackoutDate(
  date: string,
  reason: string,
  adminEmail: string
): Promise<void> {
  const blackoutRef = doc(adminDb, `blackoutDates/${date}`);
  await setDoc(blackoutRef, {
    date,
    reason,
    createdBy: adminEmail,
    createdAt: serverTimestamp(),
  });
}

/**
 * Remove a blackout date
 */
export async function removeBlackoutDate(date: string): Promise<void> {
  const blackoutRef = doc(adminDb, `blackoutDates/${date}`);
  await adminDb.deleteDoc(blackoutRef);
}

/**
 * Release a booked slot (admin manual override)
 */
export async function releaseSlot(date: string, hour: number): Promise<void> {
  const slotRef = doc(adminDb, `availability/${date}/slots/${String(hour)}`);
  await adminDb.update(slotRef, {
    status: 'available',
    bookingId: null,
    bookedAt: null,
  });
}

/**
 * Get all bookings for a date
 */
export async function getBookingsForDate(date: string): Promise<Booking[]> {
  const bookingsQuery = adminDb.collection('bookings').where('date', '==', date);
  const snapshot = await bookingsQuery.get();
  return snapshot.docs.map((doc) => doc.data() as Booking);
}

/**
 * Get all bookings by status
 */
export async function getBookingsByStatus(status: string): Promise<Booking[]> {
  const bookingsQuery = adminDb.collection('bookings').where('status', '==', status);
  const snapshot = await bookingsQuery.get();
  return snapshot.docs.map((doc) => doc.data() as Booking);
}

/**
 * Set operating hours for a day of week
 */
export async function setOperatingHours(
  dayOfWeek: string,
  open: number,
  close: number,
  isOpen: boolean = true
): Promise<void> {
  const hoursRef = doc(adminDb, `operatingHours/${dayOfWeek}`);
  await setDoc(hoursRef, {
    dayOfWeek,
    open,
    close,
    isOpen,
    updatedAt: serverTimestamp(),
  });
}
