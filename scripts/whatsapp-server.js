const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} = require('baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.WHATSAPP_SERVER_PORT || 3001;

let sock = null;
let isConnected = false;

async function initBaileys() {
  const authDir = path.join(process.cwd(), 'whatsapp_sessions');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  // Baileys ships with a hardcoded WhatsApp Web version that goes stale and
  // causes "Connection Failure" during registration. Fetch the current one.
  const { version } = await fetchLatestBaileysVersion();
  console.log('[WhatsApp] Using WA version:', version.join('.'));

  sock = makeWASocket({
    version,
    auth: state,
    browser: ['Green Hills Karaoke', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📷 Scan this QR code with WhatsApp (Settings > Linked Devices > Link a Device):\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      isConnected = true;
      console.log('✅ WhatsApp Connected');
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode
        : undefined;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log('Connection closed. Reconnecting...', shouldReconnect);

      if (shouldReconnect) {
        setTimeout(() => {
          initBaileys().catch((err) => console.error('Reconnect failed:', err.message));
        }, 3000);
      } else {
        console.error('Logged out. Delete whatsapp_sessions and re-pair.');
      }
    }
  });
}

app.get('/health', (_req, res) => {
  res.json({ connected: isConnected });
});

app.post('/send', async (req, res) => {
  try {
    const { groupId, message } = req.body;

    if (!groupId || !message) {
      return res.status(400).json({ error: 'groupId and message are required' });
    }
    if (!sock || !isConnected) {
      return res.status(503).json({ error: 'WhatsApp not connected' });
    }

    const sentMsg = await sock.sendMessage(groupId, { text: message });
    res.json({ success: true, messageId: sentMsg?.key?.id ?? null });
  } catch (err) {
    console.error('[WhatsApp] Send error:', err);
    res.status(500).json({ error: err.message });
  }
});

initBaileys()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 WhatsApp server on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to start WhatsApp server:', err.message);
    process.exit(1);
  });
