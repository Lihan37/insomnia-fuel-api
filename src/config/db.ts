import { MongoClient, Db } from "mongodb";
import "dotenv/config";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function initMongo(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in .env");

  client = new MongoClient(uri);
  await client.connect();

  db = client.db("insomniaFuel");
  console.log("🟢 MongoDB connected");

  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("MongoDB not initialized");
  return db;
}
