import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

function requireAdmin(req: NextRequest): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  return !!pw && req.headers.get('x-admin-password') === pw;
}

/**
 * GET /api/admin/pending-refunds
 * Returns all unresolved pending refunds (Razorpay refunds that failed during /confirm).
 */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const snap = await adminDb
      .collection('pendingRefunds')
      .where('resolved', '==', false)
      .get();

    const refunds = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          bookingId: d.bookingId,
          razorpayPaymentId: d.razorpayPaymentId,
          razorpayOrderId: d.razorpayOrderId,
          customerName: d.customerName,
          customerPhone: d.customerPhone,
          reason: d.reason,
          resolved: d.resolved,
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    return NextResponse.json({ success: true, data: refunds });
  } catch (error) {
    console.error('[pending-refunds] Fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch pending refunds' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/pending-refunds
 * Mark a pending refund as resolved (after manually processing it in Razorpay dashboard).
 * Body: { paymentId: string }
 */
export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { paymentId } = await req.json();
    if (!paymentId) {
      return NextResponse.json({ success: false, error: 'paymentId is required' }, { status: 400 });
    }
    await adminDb.doc(`pendingRefunds/${paymentId}`).update({
      resolved: true,
      resolvedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, message: 'Marked as resolved' });
  } catch (error) {
    console.error('[pending-refunds] Resolve error:', error);
    return NextResponse.json({ success: false, error: 'Failed to resolve' }, { status: 500 });
  }
}
