import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { sendWhatsAppMessage } from '@/lib/whatsapp/baileys-send';

const ADMIN_PHONES: string[] = (process.env.ADMIN_PHONES || '9089402122,8413853992,7085766889,8787633291')
  .split(',').map(p => p.trim().replace(/\D/g, '').slice(-10)).filter(Boolean);

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers.get('x-admin-password') !== pw) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { phone } = await req.json();
  const phone10 = (phone ?? '').replace(/\D/g, '').slice(-10);

  if (!ADMIN_PHONES.includes(phone10)) {
    return NextResponse.json(
      { success: false, error: 'Phone number not recognized as a registered admin' },
      { status: 403 }
    );
  }

  const otp = generateOtp();
  const expiresAt = Timestamp.fromMillis(Date.now() + 5 * 60 * 1000);

  await adminDb.doc(`otpVerifications/${phone10}`).set({
    otp,
    expiresAt,
    used: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  await sendWhatsAppMessage({
    to: `91${phone10}`,
    message:
      `🔐 *GreenHills Admin Override Code*\n\n` +
      `Your OTP: *${otp}*\n\n` +
      `⏱ Expires in 5 minutes\n` +
      `🚫 Do not share this code with anyone`,
  });

  return NextResponse.json({ success: true });
}
