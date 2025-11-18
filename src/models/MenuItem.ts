// src/models/MenuItem.ts
import { ObjectId } from "mongodb";
import { getDb } from "../config/mongo";  // ✅ correct import

export interface MenuItemDoc {
  _id?: ObjectId;            // optional for inserts
  name: string;
  description?: string;
  category: string;
  section?: string;
  price: number;
  isAvailable: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// data coming from client when creating/updating
export interface MenuItemInput {
  name: string;
  description?: string;
  category: string;
  section?: string;
  price: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
}

export function menuItems() {
  return getDb().collection<MenuItemDoc>("menuitems");
}
