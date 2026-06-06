require('tsx/cjs');
const { initializeWhatsApp } = require('../lib/whatsapp/baileys-client.ts');

async function waitForConnection(sock, timeoutMs = 20000) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out waiting for WhatsApp connection')),
      timeoutMs,
    );

    const onUpdate = (update) => {
      if (update.connection === 'open') {
        clearTimeout(timer);
        sock.ev.off('connection.update', onUpdate);
        resolve();
      }
    };

    sock.ev.on('connection.update', onUpdate);
  });
}

async function getGroupId() {
  console.log('🔄 Connecting to WhatsApp...');

  const sock = await initializeWhatsApp();
  await waitForConnection(sock);

  try {
    let participating;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        participating = await sock.groupFetchAllParticipating();
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    const groups = Object.entries(participating).map(([id, meta]) => ({
      id,
      name: meta.subject,
    }));

    if (groups.length === 0) {
      console.log('❌ No groups found on this account.');
      process.exit(1);
    }

    console.log('\n📱 Your WhatsApp Groups:\n');

    groups.forEach((group, i) => {
      console.log(`${i + 1}. ${group.name || 'Unnamed'}`);
      console.log(`   Chat ID: ${group.id}`);
      console.log('');
    });

    console.log('✅ Copy the Chat ID for "Green Hills Karaoke Booking"');
    console.log('Add to .env.local: WHATSAPP_GROUP_CHAT_ID=<the-id>\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getGroupId();
