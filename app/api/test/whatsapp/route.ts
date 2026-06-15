import { NextRequest, NextResponse } from 'next/server';
import { sendCustomerConfirmation, sendAdminBookingAlert } from '@/lib/whatsapp/twilio-send';

export async function POST(req: NextRequest) {
  try {
    const testPhone = '7085766889';
    const testBooking = {
      date: new Date().toISOString().split('T')[0],
      duration: 60,
      balanceDue: 0,
      bookingId: 'TEST-' + Date.now(),
      paymentType: 'full' as const,
    };

    console.log('[test/whatsapp] Sending test WhatsApp messages:', testBooking);

    const [customerResult, adminResults] = await Promise.all([
      sendCustomerConfirmation(testPhone, testBooking),
      sendAdminBookingAlert({ guestName: 'Test Guest', ...testBooking }),
    ]);

    const allSuccess = customerResult.success && adminResults.every((r: any) => r.success);

    return NextResponse.json(
      {
        success: allSuccess,
        message: allSuccess ? 'Test WhatsApp messages sent' : 'Some messages failed — check logs',
        customerResult,
        adminResults,
      },
      { status: allSuccess ? 200 : 503 }
    );
  } catch (error) {
    console.error('[test/whatsapp] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
