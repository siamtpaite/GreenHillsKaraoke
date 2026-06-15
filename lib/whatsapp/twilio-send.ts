import twilio from 'twilio';

const ADMIN_NUMBERS = [
  '+919089402122', // Elvis
  '+918413853992', // Joyful
  '+917085766889', // Siam 1
  '+918787633291', // Siam 2
];

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  }
  return twilio(accountSid, authToken);
}

function getFromNumber(): string {
  const n = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!n) throw new Error('Missing TWILIO_WHATSAPP_NUMBER');
  // Accept "whatsapp:+91..." or plain "+91..." from the env var
  return n.startsWith('whatsapp:') ? n : `whatsapp:${n}`;
}

function toWhatsApp(phone: string): string {
  // Normalise to E.164 for Indian numbers stored without country code
  const digits = phone.replace(/\D/g, '');
  const e164 = digits.length === 10 ? `+91${digits}` : `+${digits}`;
  return `whatsapp:${e164}`;
}

interface SendOptions {
  to: string;
  message: string;
}

export async function sendWhatsAppMessage(options: SendOptions) {
  try {
    const result = await getClient().messages.create({
      from: getFromNumber(),
      to: toWhatsApp(options.to),
      body: options.message,
    });
    console.log(`[Twilio] Sent to ${options.to}, SID: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error(`[Twilio] Failed to send to ${options.to}:`, error);
    return { success: false, error };
  }
}

export async function sendCustomerConfirmation(
  customerPhone: string,
  bookingDetails: {
    date: string;
    hours: number;
    amountDue: number;
    bookingId: string;
  }
) {
  const message =
    `✅ *BOOKING CONFIRMED — Green Hills Karaoke*\n\n` +
    `📅 Date: ${bookingDetails.date}\n` +
    `⏱️ Duration: ${bookingDetails.hours} hour(s)\n` +
    `💰 Amount Due at Venue: ₹${bookingDetails.amountDue}\n` +
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
    `6. ₹500 deposit is strictly non-refundable\n` +
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
  hours: number;
  amountDue: number;
  bookingId: string;
}) {
  const message =
    `[BOOKING ALERT] 🎤\n` +
    `Guest: ${bookingDetails.guestName}\n` +
    `Date: ${bookingDetails.date}\n` +
    `Duration: ${bookingDetails.hours} hrs\n` +
    `Amount: ₹${bookingDetails.amountDue}\n` +
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
