// src/models/Contact.ts
import { ObjectId } from "mongodb";
import { getDb } from "../config/mongo";

export interface IContactReply {
  _id?: ObjectId;
  senderRole: "user" | "admin";
  senderName?: string;
  senderEmail?: string;
  message: string;
  createdAt: Date;
  readByUser: boolean;
  readByAdmin: boolean;
}

export interface IContactMessage {
  _id?: ObjectId;
  userId: string | null;
  name: string;
  email: string;
  message: string;
  replies: IContactReply[];
  unreadByUser: number;
  unreadByAdmin: number;
  handled: boolean;
  createdAt: Date;
  updatedAt: Date;
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
    replies: [],
    unreadByUser: 0,
    unreadByAdmin: 1,
    handled: false,
    createdAt: now,
    updatedAt: now,
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
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    contactCollection().countDocuments(),
  ]);

  return { items, total };
}

export async function markContactHandled(id: string, handled: boolean) {
  const _id = new ObjectId(id);
  await contactCollection().updateOne({ _id }, { $set: { handled } });
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listMyContactMessagesPaginated(
  uid: string,
  email: string | null,
  page = 1,
  limit = 20
): Promise<{ items: IContactMessage[]; total: number }> {
  const skip = (page - 1) * limit;
  const filters: Array<Record<string, unknown>> = [{ userId: uid }];
  if (email) {
    filters.push({
      email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
    });
  }

  const query = { $or: filters };

  const [items, total] = await Promise.all([
    contactCollection()
      .find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    contactCollection().countDocuments(query),
  ]);

  return { items, total };
}

export async function appendAdminReply(params: {
  id: string;
  senderName?: string;
  senderEmail?: string;
  message: string;
}) {
  const _id = new ObjectId(params.id);
  const now = new Date();

  const reply: IContactReply = {
    senderRole: "admin",
    senderName: params.senderName,
    senderEmail: params.senderEmail,
    message: params.message,
    createdAt: now,
    readByUser: false,
    readByAdmin: true,
  };

  await contactCollection().updateOne(
    { _id },
    {
      $push: { replies: reply },
      $set: { updatedAt: now, handled: false },
      $inc: { unreadByUser: 1 },
    }
  );
}

export async function markContactRead(params: {
  id: string;
  actor: "user" | "admin";
}) {
  const _id = new ObjectId(params.id);
  const now = new Date();

  // Backfill legacy documents created before live-chat fields existed.
  await contactCollection().updateOne(
    { _id, replies: { $exists: false } },
    { $set: { replies: [] } }
  );
  await contactCollection().updateOne(
    { _id, unreadByUser: { $exists: false } },
    { $set: { unreadByUser: 0 } }
  );
  await contactCollection().updateOne(
    { _id, unreadByAdmin: { $exists: false } },
    { $set: { unreadByAdmin: 0 } }
  );
  await contactCollection().updateOne(
    { _id, updatedAt: { $exists: false } },
    { $set: { updatedAt: now } }
  );

  if (params.actor === "user") {
    await contactCollection().updateOne(
      { _id },
      {
        $set: {
          unreadByUser: 0,
          updatedAt: now,
          "replies.$[reply].readByUser": true,
        },
      },
      { arrayFilters: [{ "reply.senderRole": "admin", "reply.readByUser": false }] }
    );
    return;
  }

  await contactCollection().updateOne(
    { _id },
    {
      $set: {
        unreadByAdmin: 0,
        updatedAt: now,
        "replies.$[reply].readByAdmin": true,
      },
    },
    { arrayFilters: [{ "reply.senderRole": "user", "reply.readByAdmin": false }] }
  );
}
