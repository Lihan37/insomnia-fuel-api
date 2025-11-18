// src/routes/menu.ts
import { Router } from "express";
import { ObjectId } from "mongodb";
import { menuItems, type MenuItemInput } from "../models/MenuItem";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const items = await menuItems()
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ items });
  } catch (err) {
    console.error("GET /api/menu error:", err);
    res.status(500).json({ message: "Failed to load menu items" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = req.body as MenuItemInput;

    if (!data.name || !data.category || data.price == null) {
      return res
        .status(400)
        .json({ message: "Missing required fields" });
    }

    const now = new Date();

    const newItem = {
      ...data,
      description: data.description ?? "",
      section: data.section ?? "",
      isAvailable: data.isAvailable ?? true,
      isFeatured: data.isFeatured ?? false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await menuItems().insertOne(newItem);

    res.status(201).json({ _id: result.insertedId, ...newItem });
  } catch (err) {
    console.error("POST /api/menu error:", err);
    res.status(500).json({ message: "Failed to create menu item" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = new ObjectId(req.params.id);
    const result = await menuItems().deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ message: "Menu item deleted" });
  } catch (err) {
    console.error("DELETE /api/menu/:id error:", err);
    res.status(500).json({ message: "Delete failed" });
  }
});

export default router;
