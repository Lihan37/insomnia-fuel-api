// src/routes/cart.ts
import { Router, type Request, type Response } from "express";
import { authGuard } from "../middleware/auth";
import {
  getCartByUid,
  createEmptyCart,
  upsertCartItem,
  removeCartItem,
  clearCart,
  type ICart,
} from "../models/Cart";

const router = Router();

// Helper: shape response with subtotal
function buildCartResponse(cart: ICart | null) {
  if (!cart) {
    return { items: [], subtotal: 0 };
  }
  const subtotal = cart.items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );
  return {
    uid: cart.uid,
    items: cart.items,
    subtotal,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
}

/**
 * GET /api/cart
 * Get current user's cart (create empty if missing)
 */
router.get("/", authGuard, async (req: Request, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    let cart = await getCartByUid(uid);
    if (!cart) {
      cart = await createEmptyCart(uid);
    }

    return res.json(buildCartResponse(cart));
  } catch (err) {
    console.error("GET /api/cart error:", err);
    return res.status(500).json({ message: "Failed to load cart" });
  }
});

/**
 * POST /api/cart
 * Add or update an item in the cart.
 * Body: { menuItemId, name, price, quantity }
 * quantity > 0 => set quantity
 * quantity = 0 => remove item
 */
router.post("/", authGuard, async (req: Request, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { menuItemId, name, price, quantity } = req.body as {
      menuItemId?: string;
      name?: string;
      price?: number;
      quantity?: number;
    };

    if (!menuItemId || !name || typeof price !== "number" || typeof quantity !== "number") {
      return res.status(400).json({ message: "Missing or invalid cart item data" });
    }

    const cart = await upsertCartItem({
      uid,
      menuItemId,
      name,
      price,
      quantity,
    });

    return res.json(buildCartResponse(cart));
  } catch (err) {
    console.error("POST /api/cart error:", err);
    return res.status(500).json({ message: "Failed to update cart" });
  }
});

/**
 * DELETE /api/cart/:menuItemId
 * Remove a single item from cart
 */
router.delete(
  "/:menuItemId",
  authGuard,
  async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { menuItemId } = req.params;
      const cart = await removeCartItem(uid, menuItemId);
      return res.json(buildCartResponse(cart));
    } catch (err) {
      console.error("DELETE /api/cart/:menuItemId error:", err);
      return res.status(500).json({ message: "Failed to remove item" });
    }
  }
);

/**
 * DELETE /api/cart
 * Clear entire cart
 */
router.delete("/", authGuard, async (req: Request, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const cart = await clearCart(uid);
    return res.json(buildCartResponse(cart));
  } catch (err) {
    console.error("DELETE /api/cart error:", err);
    return res.status(500).json({ message: "Failed to clear cart" });
  }
});

export default router;
