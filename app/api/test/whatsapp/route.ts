import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppNotification } from '@/lib/whatsapp/baileys-send';

export async function POST(req: NextRequest) {
  try {
    const mockBooking = {
      bookingId: 'TEST-' + Date.now(),
      customerName: 'Nem Test',
      date: new Date().toISOString().split('T')[0],
      hours: 2,
      totalAmount: 2360,
      eventType: 'booking_confirmed' as const,
    };

    console.log('📤 Sending mock WhatsApp message:', mockBooking);

    const result = await sendWhatsAppNotification(mockBooking);

    return NextResponse.json(
      {
        success: result.success,
        message: result.success
          ? 'WhatsApp test message sent'
          : 'WhatsApp test message could not be sent yet. The session is not authenticated.',
        data: mockBooking,
        result,
      },
      { status: result.success ? 200 : 503 }
    );
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
