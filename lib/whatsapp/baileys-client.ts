import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from 'baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

let socket: ReturnType<typeof makeWASocket> | null = null;
let isConnecting = false;

export async function initializeWhatsApp() {
  if (socket) return socket;
  if (isConnecting) {
    let attempts = 0;
    while (!socket && attempts < 50) {
      await new Promise((r) => setTimeout(r, 100));
      attempts += 1;
    }
    return socket;
  }

  isConnecting = true;

  try {
    const authDir = getWhatsAppAuthDir();
    console.log('[WhatsApp] Auth dir:', authDir);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    // Baileys ships with a hardcoded WhatsApp Web version that goes stale and
    // causes "Connection Failure" during registration (no QR ever emitted).
    // Fetching the current version keeps the handshake working.
    const { version } = await fetchLatestBaileysVersion();
    console.log('[WhatsApp] Using WA version:', version.join('.'));

    socket = makeWASocket({
      version,
      auth: state,
      browser: ['Green Hills Karaoke', 'Chrome', '1.0.0'],
    });

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📷 Scan this QR code with WhatsApp (Settings > Linked Devices > Link a Device):\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        console.log('Connection closed. Reconnecting...', shouldReconnect);

        if (shouldReconnect) {
          socket = null;
          isConnecting = false;
          await new Promise((r) => setTimeout(r, 3000));
          await initializeWhatsApp();
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connected');
        isConnecting = false;
      }
    });

    socket.ev.on('creds.update', async () => {
      await saveCreds();
    });

    return socket;
  } catch (error) {
    console.error('WhatsApp initialization error:', error);
    isConnecting = false;
    throw error;
  }
}

function getWhatsAppAuthDir() {
  const rootCandidate = path.resolve(process.cwd(), 'whatsapp_sessions');

  if (fs.existsSync(rootCandidate)) {
    return rootCandidate;
  }

  const nextCandidate = path.resolve(process.cwd(), '..', '..', '..', 'whatsapp_sessions');
  return fs.existsSync(nextCandidate) ? nextCandidate : rootCandidate;
}

export async function getWhatsAppSocket() {
  if (!socket) {
    return await initializeWhatsApp();
  }
  return socket;
}
