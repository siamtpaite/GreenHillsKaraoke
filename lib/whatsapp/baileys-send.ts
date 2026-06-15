const WHATSAPP_SERVER_URL = process.env.WHATSAPP_SERVER_URL || 'http://152.42.201.75:3001';

const ADMIN_NUMBERS = ['919089402122', '918413853992', '917085766889'];

function toPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}min`;
}

async function sendIndividual(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const formatted = toPhone(phone);
  console.log(`[Baileys] → phone=${formatted} msgLen=${message.length}`);
  try {
    const res = await fetch(`${WHATSAPP_SERVER_URL}/send-individual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: formatted, message }),
    });
    const json = await res.json() as { success: boolean; messageId?: string; error?: string };
    if (json.success) {
      console.log(`[Baileys] ✓ Sent to ${formatted}, messageId=${json.messageId}`);
    } else {
      console.error(`[Baileys] ✗ Failed to ${formatted}:`, json.error);
    }
    return json;
  } catch (err: any) {
    console.error(`[Baileys] ✗ Network error to ${formatted}:`, err.message);
    return { success: false, error: err.message };
  }
}

// Generic send — used by mark-no-shows cron (to: E.164 "+91..." or plain digits)
export async function sendWhatsAppMessage(options: { to: string; message: string }) {
  return sendIndividual(options.to, options.message);
}

export async function sendCustomerConfirmation(
  customerPhone: string,
  bookingDetails: {
    date: string;
    duration: number;
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

  return sendIndividual(customerPhone, message);
}

export async function sendAdminBookingAlert(bookingDetails: {
  guestName: string;
  date: string;
  duration: number;
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

  return Promise.all(ADMIN_NUMBERS.map((n) => sendIndividual(n, message)));
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

  return Promise.all(ADMIN_NUMBERS.map((n) => sendIndividual(n, message)));
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

  return sendIndividual(customerPhone, message);
}
