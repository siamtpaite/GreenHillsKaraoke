import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase/admin';
import { Booking, BookingRequest } from '../types';

const HOURLY_RATE = parseInt(process.env.NEXT_PUBLIC_HOURLY_RATE || '1180');
const DEPOSIT_AMOUNT = parseInt(process.env.NEXT_PUBLIC_DEPOSIT_AMOUNT || '500');

function computePaymentAmounts(paymentType: 'full' | 'deposit', totalAmount: number) {
  if (paymentType === 'full') return { paidAmount: totalAmount, balanceDue: 0 };
  return { paidAmount: DEPOSIT_AMOUNT, balanceDue: totalAmount - DEPOSIT_AMOUNT };
}

// Resolve start/end from any booking doc format (new or legacy)
function resolveRange(data: any): { start: number; end: number } {
  const start =
    data.startTime ??
    data.startMinute ??
    (data.startHour != null ? data.startHour * 60 : null) ??
    720;
  const duration = data.duration ?? (data.hours != null ? data.hours * 60 : 60);
  return { start, end: data.endTime ?? start + duration };
}

/**
 * Atomically verify no time-range overlap exists, then create the confirmed booking doc.
 * Throws an error prefixed 'SLOT_CONFLICT' if the range is taken.
 * Called only after Razorpay payment signature is verified.
 */
export async function lockAndConfirmBooking(
  bookingId: string,
  req: BookingRequest,
  razorpayPaymentId: string,
  razorpayOrderId: string
): Promise<void> {
  const endTime = req.startTime + req.duration;
  const totalAmount = Math.ceil(req.duration / 60) * HOURLY_RATE;

  await adminDb.runTransaction(async (tx) => {
    // Read all active bookings for the date within the transaction
    const existingSnap = await tx.get(
      adminDb.collection('bookings')
        .where('date', '==', req.date)
        .where('status', 'in', ['confirmed', 'checked_in'])
    );

    for (const doc of existingSnap.docs) {
      if (doc.id === bookingId) continue;
      const { start: bStart, end: bEnd } = resolveRange(doc.data());
      if (req.startTime < bEnd && endTime > bStart) {
        throw new Error(
          `SLOT_CONFLICT: ${req.date} ${req.startTime}–${endTime} overlaps booking ${doc.id}`
        );
      }
    }

    const { paidAmount, balanceDue } = computePaymentAmounts(req.paymentType, totalAmount);
    const bookingRef = adminDb.doc(`bookings/${bookingId}`);
    tx.set(bookingRef, {
      id: bookingId,
      customerName: req.customerName,
      customerEmail: req.customerEmail,
      customerPhone: req.customerPhone,
      date: req.date,
      startTime: req.startTime,
      duration: req.duration,
      endTime,
      paymentType: req.paymentType,
      totalAmount,
      paidAmount,
      balanceDue,
      depositPaid: paidAmount,  // legacy alias
      amountDue: balanceDue,    // legacy alias
      status: 'confirmed',
      razorpayPaymentId,
      razorpayOrderId,
      createdAt: FieldValue.serverTimestamp(),
    } as Partial<Booking>);
  });
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const bookingRef = adminDb.doc(`bookings/${bookingId}`);
  const snap = await bookingRef.get();
  if (!snap.exists) throw new Error('Booking not found');
  await bookingRef.update({ status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() });
}

export async function getBooking(bookingId: string): Promise<Booking | null> {
  const snap = await adminDb.doc(`bookings/${bookingId}`).get();
  return snap.exists ? (snap.data() as Booking) : null;
}

export async function completeBooking(bookingId: string): Promise<void> {
  await adminDb.doc(`bookings/${bookingId}`).update({
    status: 'completed',
    checkOutTime: FieldValue.serverTimestamp(),
  });
}

export async function markAsNoShow(bookingId: string): Promise<void> {
  await adminDb.doc(`bookings/${bookingId}`).update({ status: 'no_show' });
}
