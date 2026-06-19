const WHATSAPP_SERVER_URL = process.env.WHATSAPP_SERVER_URL || 'http://152.42.201.75:3001';
const DEPOSIT_AMOUNT = parseInt(process.env.NEXT_PUBLIC_DEPOSIT_AMOUNT || '500');

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

function fmtTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

async function sendIndividual(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const formatted = toPhone(phone);
  console.log(`[Baileys] → phone=${formatted} msgLen=${message.length}`);
  try {
    const res = await fetch(`${WHATSAPP_SERVER_URL}/send-individual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: formatted, message }),
      signal: AbortSignal.timeout(8000),
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
    startTime: number;
    duration: number;
    balanceDue: number;
    bookingId: string;
    paymentType: 'full' | 'deposit';
    customerName?: string;
    totalAmount?: number;
    cancellationToken?: string;
  }
) {
  const endTime = bookingDetails.startTime + bookingDetails.duration;
  const guestName = bookingDetails.customerName ?? 'Guest';
  const totalPaid = (bookingDetails.totalAmount ?? 0) - bookingDetails.balanceDue;

  const tokenSection = bookingDetails.cancellationToken
    ? `\n🔑 CANCELLATION TOKEN: ${bookingDetails.cancellationToken}\n(Keep this safe — required to cancel your booking)\n`
    : '';

  const message =
    `✅ BOOKING CONFIRMED!\n\n` +
    `Booking ID: ${bookingDetails.bookingId}\n` +
    `Date & Time: ${bookingDetails.date} | ${fmtTime(bookingDetails.startTime)} – ${fmtTime(endTime)}\n` +
    `Guest Name: ${guestName}\n` +
    `Duration: ${fmtDuration(bookingDetails.duration)}\n\n` +
    `💰 PAYMENT SUMMARY\n` +
    `Deposit (Non-Refundable): ₹${DEPOSIT_AMOUNT}\n` +
    `Remaining Amount: ₹${bookingDetails.balanceDue}\n` +
    `Total Paid: ₹${totalPaid}\n\n` +
    `📋 REFUND POLICY\n` +
    `✗ ₹${DEPOSIT_AMOUNT} deposit is NON-REFUNDABLE — it locks your slot\n` +
    `✓ Remaining amount refunded at admin discretion based on cancellation reason\n` +
    tokenSection + `\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 RULES & REGULATIONS\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `1. No outside food or beverages allowed\n` +
    `2. Alcohol & drugs strictly prohibited\n` +
    `3. Smoking only in designated outdoor area\n` +
    `4. Handle microphones & equipment with care\n` +
    `5. Equipment damage will be charged to the guest\n` +
    `6. Deposit is strictly non-refundable\n` +
    `7. Late arrivals will NOT receive extra time\n` +
    `8. Extensions subject to availability — request in advance\n` +
    `9. Minors (under 18) must be accompanied by a parent/guardian\n` +
    `10. Maintain sound levels within management limits\n` +
    `11. Respect staff and fellow guests at all times\n` +
    `12. Misconduct may result in immediate session termination\n` +
    `13. Management reserves the right to refuse entry or service\n\n` +
    `❌ TO CANCEL YOUR BOOKING\n` +
    `Call or message any of our admins:\n` +
    `📞 +91 90894 02122\n` +
    `📞 +91 7085766889\n` +
    `📞 +91 84138 53992\n` +
    `📞 +918787633291\n\n` +
    `Cancellations processed within 24 hours.\n` +
    `Thank you for booking with GreenHills Karaoke! 🎤`;

  return sendIndividual(customerPhone, message);
}

export async function sendAdminBookingAlert(bookingDetails: {
  guestName: string;
  customerPhone: string;
  date: string;
  startTime: number;
  duration: number;
  balanceDue: number;
  bookingId: string;
  paymentType: 'full' | 'deposit';
}) {
  const endTime = bookingDetails.startTime + bookingDetails.duration;
  const paymentStatus =
    bookingDetails.paymentType === 'full'
      ? `FULL — ₹0 due at venue`
      : `DEPOSIT — ₹${bookingDetails.balanceDue} due at venue`;

  const message =
    `🔔 NEW BOOKING — Green Hills Karaoke\n` +
    `👤 Guest: ${bookingDetails.guestName}\n` +
    `📅 Date: ${bookingDetails.date}\n` +
    `⏰ Time: ${fmtTime(bookingDetails.startTime)} – ${fmtTime(endTime)}\n` +
    `⏱️ Duration: ${fmtDuration(bookingDetails.duration)}\n` +
    `💳 Payment: ${paymentStatus}\n` +
    `📞 Phone: ${bookingDetails.customerPhone}\n` +
    `🔖 Booking ID: ${bookingDetails.bookingId}`;

  return Promise.allSettled(ADMIN_NUMBERS.map((n) => sendIndividual(n, message)));
}

export async function sendAdminCancellationAlert(bookingDetails: {
  guestName: string;
  customerPhone: string;
  date: string;
  startTime: number;
  duration: number;
  paymentType: 'full' | 'deposit';
  bookingId: string;
}) {
  const endTime = bookingDetails.startTime + bookingDetails.duration;
  const message =
    `🚫 BOOKING CANCELLED — Green Hills Karaoke\n` +
    `👤 Guest: ${bookingDetails.guestName}\n` +
    `📅 Date: ${bookingDetails.date}\n` +
    `⏰ Time: ${fmtTime(bookingDetails.startTime)} – ${fmtTime(endTime)}\n` +
    `💳 Payment type: ${bookingDetails.paymentType}\n` +
    `📞 Phone: ${bookingDetails.customerPhone}\n` +
    `🔖 Booking ID: ${bookingDetails.bookingId}`;

  return Promise.allSettled(ADMIN_NUMBERS.map((n) => sendIndividual(n, message)));
}

export async function sendCustomerCancellationAlert(
  customerPhone: string,
  bookingDetails: { date: string; startTime: number; duration: number; bookingId: string }
) {
  const endTime = bookingDetails.startTime + bookingDetails.duration;
  const message =
    `❌ BOOKING CANCELLED — Green Hills Karaoke\n` +
    `🔖 Booking ID: ${bookingDetails.bookingId}\n` +
    `📅 Date: ${bookingDetails.date}\n` +
    `⏰ Time: ${fmtTime(bookingDetails.startTime)} – ${fmtTime(endTime)}\n` +
    `⏱️ Duration: ${fmtDuration(bookingDetails.duration)}\n` +
    `💰 Note: Deposit is non-refundable\n` +
    `To rebook, visit: https://greenhillsagro.net/karaoke\n` +
    `Green Hills Karaoke`;

  return sendIndividual(customerPhone, message);
}

export async function sendAdminCheckInAlert(bookingDetails: {
  guestName: string;
  customerPhone: string;
  date: string;
  startTime: number;
  duration: number;
  balanceDue: number;
  bookingId: string;
}) {
  const endTime = bookingDetails.startTime + bookingDetails.duration;
  const balanceLine = bookingDetails.balanceDue > 0
    ? `💳 Balance Due: ₹${bookingDetails.balanceDue}`
    : `💳 Fully Paid`;
  const message =
    `🎤 GUEST CHECKED IN — Green Hills Karaoke\n` +
    `👤 Guest: ${bookingDetails.guestName}\n` +
    `📅 Date: ${bookingDetails.date}\n` +
    `⏰ Time: ${fmtTime(bookingDetails.startTime)} – ${fmtTime(endTime)}\n` +
    `${balanceLine}\n` +
    `📞 Phone: ${bookingDetails.customerPhone}\n` +
    `🔖 Booking ID: ${bookingDetails.bookingId}`;

  return Promise.allSettled(ADMIN_NUMBERS.map((n) => sendIndividual(n, message)));
}

export async function sendAdminCheckOutAlert(bookingDetails: {
  guestName: string;
  date: string;
  bookingId: string;
}) {
  const message =
    `✅ SESSION COMPLETE — Green Hills Karaoke\n` +
    `👤 Guest: ${bookingDetails.guestName}\n` +
    `📅 Date: ${bookingDetails.date}\n` +
    `🔖 Booking ID: ${bookingDetails.bookingId}`;

  return Promise.allSettled(ADMIN_NUMBERS.map((n) => sendIndividual(n, message)));
}
