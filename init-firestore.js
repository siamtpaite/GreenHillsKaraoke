const admin = require('firebase-admin');
const serviceAccount = require('./greenhills-karaoke-firebase-adminsdk-fbsvc-6bfecb78be.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function initializeFirestore() {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  for (const day of days) {
    await db.collection('operatingHours').doc(day).set({
      open: 12,
      close: 22,
      isOpen: true,
    });
  }
  
  console.log('✓ Operating hours initialized');
  process.exit(0);
}

initializeFirestore().catch(err => {
  console.error(err);
  process.exit(1);
});
