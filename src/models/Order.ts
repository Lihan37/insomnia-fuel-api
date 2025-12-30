// src/models/Order.ts
import { ObjectId } from "mongodb";
import { getDb } from "../config/mongo";

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid" | "refunded" | "disputed";

export interface IOrderItem {
  menuItemId: string; // MenuItem _id as string
  name: string;
  price: number;
  quantity: number;
}

export interface IOrder {
  _id?: ObjectId;

  // who placed it
  userId: string | null;
  userName: string | null;
  email: string | null;

  // cart data
  items: IOrderItem[];

  subtotal: number; // sum of item.price * qty
  serviceFee: number; // for now 0 - can change later
  total: number; // subtotal + serviceFee
  currency: string; // "aud", "bdt", etc

  // status
  status: OrderStatus; // kitchen flow: pending -> preparing -> ready -> completed / cancelled
  paymentStatus: PaymentStatus; // unpaid until paid at cafe

  completedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export function ordersCollection() {
  return getDb().collection<IOrder>("orders");
}

export async function createOrderFromCart(params: {
  userId: string | null;
  userName: string | null;
  email: string | null;
  items: IOrderItem[];
  currency: string;
  paymentStatus?: PaymentStatus;
}): Promise<IOrder> {
  const safeUserName =
    (params.userName && params.userName.trim()) ||
    (params.email ? params.email.split("@")[0] : "") ||
    "Guest";

  const subtotal = params.items.reduce(
    (sum, it) => sum + it.price * it.quantity,
    0
  );
  const serviceFee = 0;
  const total = subtotal + serviceFee;
  const now = new Date();

  const doc: IOrder = {
    userId: params.userId,
    userName: safeUserName,
    email: params.email,
    items: params.items,
    subtotal,
    serviceFee,
    total,
    currency: params.currency.toLowerCase(),
    status: "pending",
    paymentStatus: params.paymentStatus ?? "unpaid",
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const res = await ordersCollection().insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

/**
 * Paginated list for admin.
 */
export async function getOrdersPaginated(
  page = 1,
  limit = 20
): Promise<{ items: IOrder[]; total: number }> {
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    ordersCollection()
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    ordersCollection().countDocuments(),
  ]);

  return { items, total };
}

/**
 * Update kitchen status only.
 */
export async function updateOrderStatus(id: string, status: OrderStatus) {
  const _id = new ObjectId(id);
  const now = new Date();

  const update: any = {
    status,
    updatedAt: now,
  };

  // if we mark as completed, store completedAt
  if (status === "completed") {
    update.completedAt = now;
  }

  await ordersCollection().updateOne({ _id }, { $set: update });
}

export async function updatePaymentStatus(
  id: string,
  paymentStatus: PaymentStatus
) {
  const _id = new ObjectId(id);
  const now = new Date();

  await ordersCollection().updateOne(
    { _id },
    { $set: { paymentStatus, updatedAt: now } }
  );
}
