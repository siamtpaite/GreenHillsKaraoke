interface WhatsAppMessage {
  bookingId: string;
  customerName: string;
  date: string;
  hours: number;
  totalAmount: number;
  amountDue?: number;
  eventType:
    | 'booking_confirmed'
    | 'customer_booking_confirmed'
    | 'checked_in'
    | 'checked_out'
    | 'cancelled'
    | 'customer_checked_in'
    | 'customer_checked_out'
    | 'customer_cancelled';
}

export function formatCustomerJid(phone: string): string {
  return `91${phone.replace(/[^\d]/g, '')}@s.whatsapp.net`;
}

// The WhatsApp connection lives in a single standalone process
// (scripts/whatsapp-server.js). The Next.js app must NOT open its own Baileys
// socket — two connections sharing whatsapp_sessions get "conflict: replaced"
// and fight forever. Instead we POST to that server over HTTP.
const WHATSAPP_SERVER_URL =
  process.env.WHATSAPP_SERVER_URL || 'http://localhost:3001';

/**
 * Send a WhatsApp notification.
 * @param message  Structured event data.
 * @param recipient  Optional JID override (e.g. customer phone JID). Defaults
 *                   to the WHATSAPP_GROUP_CHAT_ID env var.
 */
export async function sendWhatsAppNotification(message: WhatsAppMessage, recipient?: string) {
  const chatId = recipient ?? process.env.WHATSAPP_GROUP_CHAT_ID;

  if (!chatId) {
    console.warn('[WhatsApp] No recipient and WHATSAPP_GROUP_CHAT_ID not set. Skipped:', message);
    return { success: false, reason: 'No recipient configured' };
  }

  const text = formatWhatsAppMessage(message);

  try {
    const res = await fetch(`${WHATSAPP_SERVER_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: chatId, message: text }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[WhatsApp] Server responded ${res.status}:`, data);
      return { success: false, reason: data?.error || `HTTP ${res.status}` };
    }

    console.log(`[WhatsApp] ✅ Sent ${message.eventType} to ${chatId}`);
    return { success: true, messageId: data?.messageId ?? null };
  } catch (error) {
    console.error('[WhatsApp] Could not reach WhatsApp server:', error);
    return { success: false, reason: 'WhatsApp server unreachable', error };
  }
}

function formatWhatsAppMessage(message: WhatsAppMessage): string {
  const events: Record<WhatsAppMessage['eventType'], string> = {
    booking_confirmed: `✅ *NEW BOOKING CONFIRMED*\n\n👤 Guest: ${message.customerName}\n📅 Date: ${message.date}\n⏱️ Duration: ${message.hours} hour(s)\n💰 Amount: ₹${message.totalAmount}\n🔖 Booking ID: ${message.bookingId}`,
    customer_booking_confirmed: `✅ *BOOKING CONFIRMED — Green Hills Karaoke*\n\n📅 Date: ${message.date}\n⏱️ Duration: ${message.hours} hour(s)\n💰 Amount Due at Venue: ₹${message.amountDue ?? message.totalAmount}\n🔖 Booking ID: ${message.bookingId}\n\n⏰ Please arrive 10–15 mins before your slot.\n\n━━━━━━━━━━━━━━━━━━━━\n📋 *RULES & REGULATIONS*\n━━━━━━━━━━━━━━━━━━━━\n1. No outside food or beverages allowed\n2. Alcohol & drugs strictly prohibited\n3. Smoking only in designated outdoor area\n4. Handle microphones & equipment with care\n5. Equipment damage will be charged to the guest\n6. ₹500 deposit is strictly non-refundable\n7. Late arrivals will NOT receive extra time\n8. Extensions subject to availability — request in advance\n9. Minors (under 18) must be accompanied by a parent/guardian\n10. Maintain sound levels within management limits\n11. Respect staff and fellow guests at all times\n12. Misconduct may result in immediate session termination\n13. Management reserves the right to refuse entry or service\n\n🎤 *See you soon — sing your heart out!*\nGreen Hills Karaoke`,
    checked_in: `✅ *GUEST CHECKED IN*\n\n👤 ${message.customerName}\n📅 ${message.date}\n⏱️ ${message.hours} hour(s)`,
    checked_out: `🏁 *SESSION COMPLETED*\n\n👤 ${message.customerName}\n💰 Final: ₹${message.totalAmount}`,
    cancelled: `❌ *BOOKING CANCELLED*\n\n👤 ${message.customerName}\n📅 ${message.date}\n💵 Refund: ₹500 (non-refundable)`,
    customer_checked_in: `✅ *CHECK-IN CONFIRMED*\n\nWelcome to Green Hills Karaoke!\n📅 ${message.date}\n⏱️ ${message.hours} hour(s)\n🔖 Booking ID: ${message.bookingId}\n\nEnjoy your session! 🎤`,
    customer_checked_out: `✅ *SESSION COMPLETED*\n\nThank you for visiting Green Hills Karaoke!\n🔖 Booking ID: ${message.bookingId}\n\nSee you again soon! 🎤`,
    customer_cancelled: `❌ *BOOKING CANCELLED*\n\nYour booking has been cancelled.\n📅 ${message.date}\n💵 Note: ₹500 deposit is non-refundable.\n🔖 Booking ID: ${message.bookingId}`,
  };

  return events[message.eventType];
}
