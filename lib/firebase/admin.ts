import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const sdkJson = process.env.FIREBASE_ADMIN_SDK_JSON;
  let credential: admin.credential.Credential;

  if (sdkJson) {
    let parsed: admin.ServiceAccount;
    const isBase64 = sdkJson.startsWith('eyJ') || (() => { try { JSON.parse(sdkJson); return false; } catch { return true; } })();
    if (isBase64) {
      parsed = JSON.parse(Buffer.from(sdkJson, 'base64').toString('utf-8')) as admin.ServiceAccount;
      console.log('[firebase/admin] using FIREBASE_ADMIN_SDK_JSON (base64-decoded)');
    } else {
      parsed = JSON.parse(sdkJson) as admin.ServiceAccount;
      console.log('[firebase/admin] using FIREBASE_ADMIN_SDK_JSON (plain JSON)');
    }
    credential = admin.credential.cert(parsed);
  } else {
    console.log('[firebase/admin] FIREBASE_ADMIN_SDK_JSON not set — falling back to application default credentials');
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

export default admin;
