import { Router } from "express";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import https from "https";
import { authGuard, adminOnly } from "../middleware/auth";
import { galleryImages, type GalleryImageInput } from "../models/Gallery";

const router = Router();

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
  const folder = process.env.CLOUDINARY_FOLDER || "insomnia-fuel/gallery";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Missing Cloudinary environment variables");
  }

  return { cloudName, apiKey, apiSecret, folder };
}

function signCloudinary(
  params: Record<string, string | number>,
  apiSecret: string
) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(sorted + apiSecret).digest("hex");
}

async function destroyCloudinaryAsset(publicId: string) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signCloudinary(
    { public_id: publicId, timestamp },
    apiSecret
  );

  const body = new URLSearchParams({
    public_id: publicId,
    api_key: apiKey,
    timestamp: String(timestamp),
    signature,
  }).toString();

  return new Promise<void>((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: "api.cloudinary.com",
        path: `/v1_1/${cloudName}/image/destroy`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          const status = res.statusCode || 0;
          if (status < 200 || status >= 300) {
            return reject(
              new Error(`Cloudinary destroy failed (${status}): ${data}`)
            );
          }

          try {
            const json = JSON.parse(data || "{}");
            const result = String(json.result || "");
            if (result === "ok" || result === "not found") {
              return resolve();
            }
            return reject(
              new Error(`Cloudinary destroy failed (result: ${result})`)
            );
          } catch (err) {
            return reject(err);
          }
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * GET /api/gallery
 * Public list of gallery items (newest first)
 */
router.get("/", async (_req, res) => {
  try {
    const items = await galleryImages()
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    return res.json({ items });
  } catch (err) {
    console.error("GET /api/gallery error:", err);
    return res.status(500).json({ message: "Failed to fetch gallery" });
  }
});

/**
 * POST /api/gallery/signature
 * Admin: returns a signed payload for direct Cloudinary upload
 */
router.post("/signature", authGuard, adminOnly, (_req, res) => {
  try {
    const { cloudName, apiKey, apiSecret, folder } = getCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signCloudinary({ folder, timestamp }, apiSecret);
    return res.json({ signature, timestamp, cloudName, apiKey, folder });
  } catch (err) {
    console.error("POST /api/gallery/signature error:", err);
    return res.status(500).json({ message: "Failed to sign upload" });
  }
});

/**
 * POST /api/gallery
 * Admin: store Cloudinary upload result
 */
router.post("/", authGuard, adminOnly, async (req, res) => {
  try {
    const data = req.body as GalleryImageInput;

    if (!data.publicId || (!data.secureUrl && !data.url)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const now = new Date();
    const doc = {
      publicId: data.publicId,
      url: data.secureUrl || data.url,
      secureUrl: data.secureUrl || data.url,
      width: Number(data.width || 0),
      height: Number(data.height || 0),
      format: data.format || "",
      bytes: Number(data.bytes || 0),
      alt: data.alt || "",
      createdAt: now,
      updatedAt: now,
    };

    const result = await galleryImages().insertOne(doc);
    return res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (err) {
    console.error("POST /api/gallery error:", err);
    return res.status(500).json({ message: "Failed to create gallery item" });
  }
});

/**
 * DELETE /api/gallery/:id
 * Admin: remove Cloudinary asset + DB record
 */
router.delete("/:id", authGuard, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const _id = new ObjectId(id);
    const item = await galleryImages().findOne({ _id });
    if (!item) {
      return res.status(404).json({ message: "Not found" });
    }

    await destroyCloudinaryAsset(item.publicId);
    await galleryImages().deleteOne({ _id });

    return res.json({ message: "Gallery item deleted" });
  } catch (err) {
    console.error("DELETE /api/gallery/:id error:", err);
    return res.status(500).json({ message: "Failed to delete gallery item" });
  }
});

export default router;
