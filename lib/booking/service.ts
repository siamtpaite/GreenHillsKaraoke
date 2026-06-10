import {
  doc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase/admin';
import { db } from '../firebase/config';
import { Booking, BookingRequest } from '../types';
import { generateHourList } from '../utils/availability';

const HOURLY_RATE = parseInt(process.env.NEXT_PUBLIC_HOURLY_RATE || '1180');
const DEPOSIT_AMOUNT = parseInt(process.env.DEPOSIT_AMOUNT || '500');

/**
 * Create a new booking with Firestore transaction
 * This prevents double-booking by using atomic transactions
 */
export async function createBooking(
  req: BookingRequest
): Promise<{ bookingId: string; order: any }> {
  const bookingId = adminDb.collection('bookings').doc().id;
  const hourList = generateHourList(req.startHour, req.hours);
  const totalAmount = HOURLY_RATE * req.hours;

  try {
    // Attempt to lock slots in transaction
    await runTransaction(db, async (transaction) => {
      // 1. Check all slots are available
      for (const hour of hourList) {
        const slotRef = doc(db, `availability/${req.date}/slots/${hour}`);
        const slotSnap = await transaction.get(slotRef);

        if (
          !slotSnap.exists() ||
          slotSnap.data().status !== 'available'
        ) {
          throw new Error(
            `Slot ${req.date} ${hour}:00 is already booked or unavailable`
          );
        }
      }

      // 2. Lock all slots
      for (const hour of hourList) {
        const slotRef = doc(db, `availability/${req.date}/slots/${hour}`);
        transaction.update(slotRef, {
          status: 'booked',
          bookingId,
          bookedAt: serverTimestamp(),
        });
      }

      // 3. Create booking record with status "pending_payment"
      const bookingRef = doc(db, `bookings/${bookingId}`);
      transaction.set(bookingRef, {
        id: bookingId,
        customerName: req.customerName,
        customerEmail: req.customerEmail,
        customerPhone: req.customerPhone,
        date: req.date,
        hours: req.hours,
        hourList,
        depositPaid: 0, // Will be updated after payment
        totalAmount,
        amountDue: totalAmount - DEPOSIT_AMOUNT,
        status: 'pending_payment', // Awaiting deposit payment
        createdAt: serverTimestamp(),
      } as Partial<Booking>);
    });

    // 4. Return booking ID and prepare for Razorpay
    return {
      bookingId,
      order: {
        amount: DEPOSIT_AMOUNT * 100, // Razorpay expects amount in paise
        currency: 'INR',
        receipt: bookingId,
        notes: {
          bookingId,
          customerEmail: req.customerEmail,
          date: req.date,
          hours: req.hours,
        },
      },
    };
  } catch (error) {
    console.error('Booking creation failed:', error);
    throw error;
  }
}

/**
 * Confirm booking after Razorpay payment success
 */
export async function confirmBookingPayment(
  bookingId: string,
  razorpayPaymentId: string,
  razorpayOrderId: string
): Promise<void> {
  const bookingRef = adminDb.doc(`bookings/${bookingId}`);

  await adminDb.runTransaction(async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);

    if (!bookingSnap.exists) {
      throw new Error('Booking not found');
    }

    transaction.update(bookingRef, {
      depositPaid: DEPOSIT_AMOUNT,
      status: 'pending_full_payment',
      razorpayPaymentId,
      razorpayOrderId,
    });
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
