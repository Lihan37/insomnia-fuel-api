import admin from "../config/firebaseAdmin";
import "dotenv/config";

async function seedAdmins() {
  const list = process.env.ADMIN_EMAILS;
  if (!list) {
    console.error("❌ No ADMIN_EMAILS found in .env");
    process.exit(1);
  }

  const emails = list.split(/[ ,\n]+/).filter(Boolean);

  console.log("Setting admin claims for:", emails);

 for (const email of emails) {
  try {
    const user = await admin.auth().getUserByEmail(email);

    await admin.auth().setCustomUserClaims(user.uid, {
      role: "admin",
    });

    console.log(`✅ Claim set → ${email}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Failed for ${email}:`, msg);
  }
}


  console.log("Done.");
  process.exit(0);
}

seedAdmins();
