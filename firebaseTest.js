import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';

// Simulate __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correct path to your service account key
const serviceAccount = path.join(__dirname, 'serviceAccountKey.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Test Firebase Admin SDK by verifying a dummy ID token
const testToken = '<INSERT_ID_TOKEN_HERE>';  // Use a valid Firebase ID token for testing

admin.auth().verifyIdToken(testToken)
  .then((decodedToken) => {
    console.log('Token verified successfully:', decodedToken);
  })
  .catch((error) => {
    console.error('Error verifying token:', error);
  });
