import twilio from 'twilio';

const ADMIN_NUMBERS = [
  '+919089402122', // Elvis
  '+918413853992', // Joyful
  '+917085766889', // Siam 1
];

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  return twilio(accountSid, authToken);
}

function getFromNumber(): string {
  const n = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!n) throw new Error('Missing TWILIO_WHATSAPP_NUMBER');
  return n.startsWith('whatsapp:') ? n : `whatsapp:${n}`;
}

function toWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const e164 = digits.length === 10 ? `+91${digits}` : `+${digits}`;
  return `whatsapp:${e164}`;
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

interface SendOptions {
  to: string;
  message: string;
}

export async function sendWhatsAppMessage(options: SendOptions) {
  const from = getFromNumber();
  const to = toWhatsApp(options.to);
  console.log(`[Twilio] → from=${from} to=${to} msgLen=${options.message.length}`);
  try {
    const result = await getClient().messages.create({ from, to, body: options.message });
    console.log(`[Twilio] ✓ Delivered to ${options.to}, SID=${result.sid} status=${result.status}`);
    return { success: true, sid: result.sid };
  } catch (error: any) {
    console.error(`[Twilio] ✗ Failed to ${options.to}: code=${error?.code} msg=${error?.message}`, error);
    return { success: false, error };
  }
}

export async function sendCustomerConfirmation(
  customerPhone: string,
  bookingDetails: {
    date: string;
    duration: number;   // minutes
    balanceDue: number;
    bookingId: string;
    paymentType: 'full' | 'deposit';
  }
) {
  const balanceLine =
    bookingDetails.paymentType === 'full'
      ? `✅ Fully paid — nothing due at venue`
      : `💰 Balance Due at Venue: ₹${bookingDetails.balanceDue}`;

  const message =
    `✅ *BOOKING CONFIRMED — Green Hills Karaoke*\n\n` +
    `📅 Date: ${bookingDetails.date}\n` +
    `⏱️ Duration: ${fmtDuration(bookingDetails.duration)}\n` +
    `${balanceLine}\n` +
    `🔖 Booking ID: ${bookingDetails.bookingId}\n\n` +
    `⏰ Please arrive 10–15 mins before your slot.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *RULES & REGULATIONS*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `1. No outside food or beverages allowed\n` +
    `2. Alcohol & drugs strictly prohibited\n` +
    `3. Smoking only in designated outdoor area\n` +
    `4. Handle microphones & equipment with care\n` +
    `5. Equipment damage will be charged to the guest\n` +
    `6. ₹50 deposit is strictly non-refundable\n` +
    `7. Late arrivals will NOT receive extra time\n` +
    `8. Extensions subject to availability — request in advance\n` +
    `9. Minors (under 18) must be accompanied by a parent/guardian\n` +
    `10. Maintain sound levels within management limits\n` +
    `11. Respect staff and fellow guests at all times\n` +
    `12. Misconduct may result in immediate session termination\n` +
    `13. Management reserves the right to refuse entry or service\n\n` +
    `🎤 *See you soon — sing your heart out!*\nGreen Hills Karaoke`;

  return sendWhatsAppMessage({ to: customerPhone, message });
}

export async function sendAdminBookingAlert(bookingDetails: {
  guestName: string;
  date: string;
  duration: number;   // minutes
  balanceDue: number;
  bookingId: string;
  paymentType: 'full' | 'deposit';
}) {
  const paymentLine =
    bookingDetails.paymentType === 'full'
      ? `Payment: FULL (₹0 due at venue)`
      : `Payment: DEPOSIT — ₹${bookingDetails.balanceDue} due at venue`;

  const message =
    `[BOOKING ALERT] 🎤\n` +
    `Guest: ${bookingDetails.guestName}\n` +
    `Date: ${bookingDetails.date}\n` +
    `Duration: ${fmtDuration(bookingDetails.duration)}\n` +
    `${paymentLine}\n` +
    `Booking ID: ${bookingDetails.bookingId}`;

  const results = [];
  for (const number of ADMIN_NUMBERS) {
    results.push({ number, ...await sendWhatsAppMessage({ to: number, message }) });
  }
  return results;
}

export async function sendAdminCancellationAlert(bookingDetails: {
  guestName: string;
  date: string;
  bookingId: string;
}) {
  const message =
    `[CANCELLATION ALERT] ❌\n` +
    `Guest: ${bookingDetails.guestName}\n` +
    `Date: ${bookingDetails.date}\n` +
    `Booking ID: ${bookingDetails.bookingId}`;

  const results = [];
  for (const number of ADMIN_NUMBERS) {
    results.push({ number, ...await sendWhatsAppMessage({ to: number, message }) });
  }
  return results;
}

export async function sendCustomerCancellationAlert(
  customerPhone: string,
  bookingDetails: { date: string; bookingId: string }
) {
  const message =
    `❌ *BOOKING CANCELLED — Green Hills Karaoke*\n\n` +
    `📅 Date: ${bookingDetails.date}\n` +
    `🔖 Booking ID: ${bookingDetails.bookingId}\n\n` +
    `Your ₹50 deposit is non-refundable.\n\n` +
    `To make a new booking visit our booking page.\n` +
    `Green Hills Karaoke`;

  return sendWhatsAppMessage({ to: customerPhone, message });
}
