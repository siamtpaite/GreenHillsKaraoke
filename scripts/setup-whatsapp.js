require('tsx/cjs');
const { initializeWhatsApp } = require('../lib/whatsapp/baileys-client.ts');

console.log('🔄 Initializing WhatsApp...');
console.log('A QR code will appear below shortly.');
console.log('Scan it with your phone (Settings > Linked Devices > Link a Device).');
console.log('\nThis runs on the phone number from your WhatsApp account.\n');

async function setup() {
  const sock = await initializeWhatsApp();

  // initializeWhatsApp() resolves as soon as the socket is created, so we must
  // wait here for the connection to actually open before exiting.
  await new Promise((resolve, reject) => {
    sock.ev.on('connection.update', (update) => {
      if (update.connection === 'open') {
        console.log('\n✅ WhatsApp connected! Session saved.');
        console.log('You can now close this script. Messages will auto-send on next restart.');
        resolve();
      }
      if (update.connection === 'close') {
        const statusCode = update.lastDisconnect?.error?.output?.statusCode;
        // 401 = logged out; anything else is a transient reconnect, keep waiting.
        if (statusCode === 401) {
          reject(new Error('Logged out. Delete whatsapp_sessions and try again.'));
        }
      }
    });
  });
}

setup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  });
