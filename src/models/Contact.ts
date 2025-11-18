// src/models/Contact.ts
import { ObjectId } from "mongodb";
import { getDb } from "../config/mongo";

export interface IContactMessage {
  _id?: ObjectId;
  userId: string | null;
  name: string;
  email: string;
  message: string;
  handled: boolean;
  createdAt: Date;
}

export function contactCollection() {
  return getDb().collection<IContactMessage>("contactMessages");
}

export async function createContactMessage(params: {
  userId: string | null;
  name: string;
  email: string;
  message: string;
}): Promise<IContactMessage> {
  const now = new Date();
  const doc: IContactMessage = {
    userId: params.userId,
    name: params.name,
    email: params.email,
    message: params.message,
    handled: false,
    createdAt: now,
  };

  const res = await contactCollection().insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

export async function listContactMessagesPaginated(
  page = 1,
  limit = 20
): Promise<{ items: IContactMessage[]; total: number }> {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    contactCollection()
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    contactCollection().countDocuments(),
  ]);

  return { items, total };
}

export async function markContactHandled(id: string, handled: boolean) {
  const _id = new ObjectId(id);
  await contactCollection().updateOne(
    { _id },
    { $set: { handled } }
  );
}
