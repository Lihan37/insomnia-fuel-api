// src/models/User.ts
import { ObjectId } from "mongodb";
import { getDb } from "../config/mongo";

// ===== TYPES =====
export type UserRole = "user" | "admin";

export interface IUser {
  _id?: ObjectId;         // optional for insert
  uid: string;            // Firebase UID
  email: string;
  displayName?: string;
  photoURL?: string;
  phone?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export function usersCollection() {
  return getDb().collection<IUser>("users");
}

// ==========================================
// CREATE USER
// ==========================================
export async function createUser(data: {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  phone?: string;
  role?: UserRole;
}): Promise<IUser> {
  const now = new Date();

  const doc: IUser = {
    uid: data.uid,
    email: data.email,
    displayName: data.displayName || "",
    photoURL: data.photoURL || "",
    phone: data.phone || "",
    role: data.role || "user",
    createdAt: now,
    updatedAt: now,
  };

  const result = await usersCollection().insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

// ==========================================
// GET USER BY UID
// ==========================================
export async function getUserByUID(uid: string): Promise<IUser | null> {
  return await usersCollection().findOne({ uid });
}

// ==========================================
// GET PAGINATED USERS
// ==========================================
export async function getUsersPaginated(
  page = 1,
  limit = 20
): Promise<{ items: IUser[]; total: number }> {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    usersCollection()
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),

    usersCollection().countDocuments(),
  ]);

  return { items, total };
}

// ==========================================
// DELETE USER
// ==========================================
export async function deleteUser(uid: string): Promise<boolean> {
  const result = await usersCollection().deleteOne({ uid });
  return result.deletedCount === 1;
}
