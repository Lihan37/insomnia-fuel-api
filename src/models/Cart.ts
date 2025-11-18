// src/models/Cart.ts
import { ObjectId } from "mongodb";
import { getDb } from "../config/mongo";

export interface ICartItem {
  menuItemId: string; // MenuItem _id as string
  name: string;
  price: number;
  quantity: number;
}

export interface ICart {
  _id?: ObjectId;
  uid: string;          // Firebase uid
  items: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
}

export function cartsCollection() {
  return getDb().collection<ICart>("carts");
}

// -------------------------
// Get cart by user uid
// -------------------------
export async function getCartByUid(uid: string): Promise<ICart | null> {
  return await cartsCollection().findOne({ uid });
}

// -------------------------
// Create empty cart
// -------------------------
export async function createEmptyCart(uid: string): Promise<ICart> {
  const now = new Date();
  const doc: ICart = {
    uid,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
  const result = await cartsCollection().insertOne(doc);
  return { _id: result.insertedId, ...doc };
}

// -------------------------
// Upsert single cart item
// (set quantity; if 0 => remove)
// -------------------------
export async function upsertCartItem(params: {
  uid: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number; // 0 = remove
}): Promise<ICart> {
  const { uid, menuItemId, name, price, quantity } = params;

  // ensure cart exists
  let cart = await getCartByUid(uid);
  if (!cart) {
    cart = await createEmptyCart(uid);
  }

  const items = [...cart.items];
  const idx = items.findIndex((i) => i.menuItemId === menuItemId);

  if (quantity <= 0) {
    // remove
    if (idx !== -1) items.splice(idx, 1);
  } else if (idx === -1) {
    // add
    items.push({ menuItemId, name, price, quantity });
  } else {
    // update
    items[idx] = { ...items[idx], name, price, quantity };
  }

  const now = new Date();

  await cartsCollection().updateOne(
    { _id: cart._id },
    { $set: { items, updatedAt: now } }
  );

  return { ...cart, items, updatedAt: now };
}

// -------------------------
// Remove a single item
// -------------------------
export async function removeCartItem(uid: string, menuItemId: string) {
  const cart = await getCartByUid(uid);
  if (!cart) return null;

  const items = cart.items.filter((i) => i.menuItemId !== menuItemId);
  const now = new Date();

  await cartsCollection().updateOne(
    { _id: cart._id },
    { $set: { items, updatedAt: now } }
  );

  return { ...cart, items, updatedAt: now } as ICart;
}

// -------------------------
// Clear whole cart (keep doc)
// -------------------------
export async function clearCart(uid: string) {
  const cart = await getCartByUid(uid);
  if (!cart) return null;

  const now = new Date();
  await cartsCollection().updateOne(
    { _id: cart._id },
    { $set: { items: [], updatedAt: now } }
  );

  return { ...cart, items: [], updatedAt: now } as ICart;
}

// -------------------------
// Clear cart by uid (delete doc)
// Used by Stripe order completion
// -------------------------
export async function clearCartByUid(uid: string): Promise<void> {
  await cartsCollection().deleteOne({ uid });
}
