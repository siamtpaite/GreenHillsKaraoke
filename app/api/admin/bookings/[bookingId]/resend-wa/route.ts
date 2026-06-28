import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendCustomerConfirmation, sendAdminBookingAlert } from '@/lib/whatsapp/baileys-send';
import { ApiResponse } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || request.headers.get('x-admin-password') !== pw) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { bookingId } = await params;
  const snap = await adminDb.doc(`bookings/${bookingId}`).get();
  if (!snap.exists) {
    return NextResponse.json(
      { success: false, error: 'Booking not found' } as ApiResponse<null>,
      { status: 404 }
    );
  }

  const b = snap.data() as any;
  const startTime: number = b.startTime ?? b.startMinute ?? (b.startHour != null ? b.startHour * 60 : 720);
  const duration: number = b.duration ?? (b.hours != null ? b.hours * 60 : 60);
  const balanceDue: number = b.balanceDue ?? b.amountDue ?? 0;
  const isOffline = b.createdBy === 'admin';

  const [adminResult, customerResult] = await Promise.allSettled([
    sendAdminBookingAlert({
      guestName: b.customerName,
      customerPhone: b.customerPhone,
      date: b.date,
      startTime,
      duration,
      balanceDue,
      bookingId,
      paymentType: b.paymentType ?? 'deposit',
      specialRequests: b.specialRequests ?? b.notes ?? '',
      isOffline,
    }),
    sendCustomerConfirmation(b.customerPhone, {
      date: b.date,
      startTime,
      duration,
      balanceDue,
      bookingId,
      paymentType: b.paymentType ?? 'deposit',
      customerName: b.customerName,
      totalAmount: b.totalAmount,
      cancellationToken: b.cancellationToken,
      specialRequests: b.specialRequests ?? b.notes ?? '',
    }),
  ]);

  const adminOk = adminResult.status === 'fulfilled';
  const customerOk = customerResult.status === 'fulfilled';

  console.log(`[resend-wa] booking=${bookingId} adminOk=${adminOk} customerOk=${customerOk} isOffline=${isOffline}`);

  return NextResponse.json({
    success: adminOk || customerOk,
    data: {
      adminSent: adminOk,
      customerSent: customerOk,
      adminError: adminResult.status === 'rejected' ? String(adminResult.reason) : undefined,
      customerError: customerResult.status === 'rejected' ? String(customerResult.reason) : undefined,
    },
  } as ApiResponse<any>);
}
