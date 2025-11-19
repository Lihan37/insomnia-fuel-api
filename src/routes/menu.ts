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

/** --------------------------------------------------
 * PUT /api/menu/:id  – update existing menu item
 * ------------------------------------------------- */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return res.status(400).json({ message: "Invalid id" });
    }

    const data = req.body as Partial<MenuItemInput>;
    const now = new Date();

    const update: any = {
      updatedAt: now,
    };

    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined)
      update.description = data.description ?? "";
    if (data.section !== undefined) update.section = data.section ?? "";
    if (data.category !== undefined) update.category = data.category;
    if (data.price !== undefined) update.price = Number(data.price);
    if (data.isAvailable !== undefined)
      update.isAvailable = !!data.isAvailable;
    if (data.isFeatured !== undefined)
      update.isFeatured = !!data.isFeatured;

    const col = menuItems();
    await col.updateOne({ _id }, { $set: update });

    const updated = await col.findOne({ _id });
    if (!updated) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json(updated);
  } catch (err) {
    console.error("PUT /api/menu/:id error:", err);
    res.status(500).json({ message: "Failed to update menu item" });
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
