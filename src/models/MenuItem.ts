// src/models/MenuItem.ts
import { ObjectId } from "mongodb";
import { getDb } from "../config/mongo";

export interface MenuSubItem {
  name: string;
  price: number;
}

export interface MenuItemDoc {
  _id?: ObjectId;
  name: string;
  description?: string;
  category: string;
  section?: string;
  price: number;
  isAvailable: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;

  // ✅ NEW: sub foods / options
  subItems?: MenuSubItem[];
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

  // ✅ NEW
  subItems?: MenuSubItem[];
}

export function menuItems() {
  return getDb().collection<MenuItemDoc>("menuitems");
}
