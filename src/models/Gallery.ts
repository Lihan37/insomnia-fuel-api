import { ObjectId } from "mongodb";
import { getDb } from "../config/mongo";

export interface GalleryImageDoc {
  _id?: ObjectId;
  publicId: string;
  url: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  alt?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GalleryImageInput {
  publicId: string;
  url: string;
  secureUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  alt?: string;
}

export function galleryImages() {
  return getDb().collection<GalleryImageDoc>("gallery");
}
