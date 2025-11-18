// src/scripts/checkAdminClaims.ts
import admin from "../config/firebaseAdmin"; // adjust path if needed
import "dotenv/config";

async function main() {
  const email = "eanurlihan10@gmail.com";

  try {
    const user = await admin.auth().getUserByEmail(email);
    console.log("UID:", user.uid);
    console.log("Email:", user.email);
    console.log("Custom claims:", user.customClaims || {});
  } catch (err) {
    console.error("Error fetching user:", err);
  }
}

main();
