import admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Ensure Firebase Admin is initialized only once
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'); // Handle newline characters

    if (!projectId || !clientEmail || !privateKey) {
      console.error('❌ Missing Firebase Admin credentials in environment variables');
      throw new Error('Firebase Admin initialization failed: missing credentials');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    console.log('✅ Firebase Admin initialized successfully');
  } catch (err) {
    console.error('❌ Firebase Admin initialization failed:', err);
    process.exit(1);  // Exit the process in case of failure
  }
}

export default admin;
