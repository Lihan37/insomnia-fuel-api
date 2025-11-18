// src/config/mongo.ts
import { MongoClient, Db } from "mongodb";
import "dotenv/config";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function initMongo(): Promise<Db> {
  if (db) return db; // if already connected, reuse

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ Missing MONGODB_URI in .env");
    process.exit(1);
  }

  try {
    client = new MongoClient(uri);
    await client.connect();

    // Use your database name (change if needed)
    db = client.db("insomniaFuel");

    console.log("🟢 MongoDB connected successfully");
    return db;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ MongoDB connection failed:", msg);
    process.exit(1);
  }
}

export function getDb(): Db {
  if (!db) {
    throw new Error("❗ MongoDB not initialized. Call initMongo() first.");
  }
  return db;
}
