import admin from "firebase-admin";

// Avoid re-initializing Firebase Admin on hot reloads (e.g., dev)
if (!admin.apps.length) {
  try {
    // Attempt to initialize Firebase Admin with default application credentials
    admin.initializeApp({
      credential: admin.credential.applicationDefault(), // Uses GOOGLE_APPLICATION_CREDENTIALS or local emulator credentials
    });
    console.log("✅ Firebase Admin initialized with applicationDefault()");
  } catch (err) {
    // Fallback to manual service account config via .env if applicationDefault fails
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"); // Handle newline escape for private key

    // Ensure required environment variables are present
    if (!projectId || !clientEmail || !privateKey) {
      console.error("❌ Missing Firebase Admin credentials in environment variables");
      throw new Error("Firebase Admin initialization failed: missing credentials");
    }

    // Initialize Firebase Admin with service account credentials from .env
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log("✅ Firebase Admin initialized with service account from env");
  }
}

// Export the auth instance and app (for reuse)
export const adminAuth = admin.auth();
export default admin.app();

// Function to set custom claims for a user (make them admin)
async function setAdminClaim(uid: string) {
  try {
    // Verify that the UID is valid before proceeding
    const user = await admin.auth().getUser(uid);
    if (!user) {
      console.error(`❌ User with UID: ${uid} does not exist`);
      return;
    }

    // Set the custom claim 'admin' to true
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`✅ User with UID: ${uid} is now an admin.`);
  } catch (error) {
    console.error("❌ Error setting custom claims:", error);
  }
}

// Example usage: Replace with the UID of the user you want to make admin
const userUID = "USER_UID_HERE";  // Replace with the UID of the user you want to make admin
setAdminClaim(userUID); // Run the function to set admin claim for a user
