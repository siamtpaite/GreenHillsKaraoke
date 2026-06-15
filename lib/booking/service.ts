import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase/admin';
import { Booking, BookingRequest } from '../types';
import { generateHourList } from '../utils/availability';

const HOURLY_RATE = parseInt(process.env.NEXT_PUBLIC_HOURLY_RATE || '1180');
const DEPOSIT_AMOUNT = parseInt(process.env.DEPOSIT_AMOUNT || '500');

/**
 * Atomically check slot availability, lock all slots, and create a confirmed booking.
 * Called only after Razorpay payment signature is verified.
 * Throws an error prefixed with 'SLOT_CONFLICT' if any slot is no longer available.
 */
export async function lockAndConfirmBooking(
  bookingId: string,
  req: BookingRequest,
  razorpayPaymentId: string,
  razorpayOrderId: string
): Promise<void> {
  const hourList = generateHourList(req.startHour, req.hours);
  const totalAmount = HOURLY_RATE * req.hours;

  await adminDb.runTransaction(async (transaction) => {
    // 1. Read all slots and fail fast on any conflict
    for (const hour of hourList) {
      const slotRef = adminDb.doc(`availability/${req.date}/slots/${hour}`);
      const slotSnap = await transaction.get(slotRef);
      if (slotSnap.exists && slotSnap.data()?.status !== 'available') {
        throw new Error(`SLOT_CONFLICT: ${req.date} ${hour}:00 is no longer available`);
      }
    }

    // 2. Lock all slots
    for (const hour of hourList) {
      const slotRef = adminDb.doc(`availability/${req.date}/slots/${hour}`);
      transaction.set(slotRef, {
        status: 'booked',
        bookingId,
        bookedAt: FieldValue.serverTimestamp(),
        hour: parseInt(hour),
      });
    }

    // 3. Create booking as confirmed — deposit already paid
    const bookingRef = adminDb.doc(`bookings/${bookingId}`);
    transaction.set(bookingRef, {
      id: bookingId,
      customerName: req.customerName,
      customerEmail: req.customerEmail,
      customerPhone: req.customerPhone,
      date: req.date,
      startHour: req.startHour,
      hours: req.hours,
      hourList,
      depositPaid: DEPOSIT_AMOUNT,
      totalAmount,
      amountDue: totalAmount - DEPOSIT_AMOUNT,
      status: 'confirmed',
      razorpayPaymentId,
      razorpayOrderId,
      createdAt: FieldValue.serverTimestamp(),
    } as Partial<Booking>);
  });
}

/**
 * Cancel a booking and release slots
 */
export async function cancelBooking(bookingId: string): Promise<void> {
  const bookingRef = adminDb.doc(`bookings/${bookingId}`);
  const bookingSnap = await bookingRef.get();

  if (!bookingSnap.exists) {
    throw new Error('Booking not found');
  }

  const booking = bookingSnap.data() as Booking;

  await adminDb.runTransaction(async (transaction) => {
    for (const hour of booking.hourList) {
      const slotRef = adminDb.doc(`availability/${booking.date}/slots/${hour}`);
      transaction.update(slotRef, {
        status: 'available',
        bookingId: null,
        bookedAt: null,
      });
    }

    transaction.update(bookingRef, {
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Get booking by ID
 */
export async function getBooking(bookingId: string): Promise<Booking | null> {
  const bookingSnap = await adminDb.doc(`bookings/${bookingId}`).get();
  return bookingSnap.exists ? (bookingSnap.data() as Booking) : null;
}

/**
 * Mark booking as completed (after customer checks out)
 */
export async function completeBooking(bookingId: string): Promise<void> {
  await adminDb.doc(`bookings/${bookingId}`).update({
    status: 'completed',
    checkOutTime: FieldValue.serverTimestamp(),
  });
}

/**
 * Mark booking as no-show
 */
export async function markAsNoShow(bookingId: string): Promise<void> {
  await adminDb.doc(`bookings/${bookingId}`).update({ status: 'no_show' });
}
