// src/routes/orders.ts
import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import {
  getOrdersPaginated,
  updateOrderStatus,
  type OrderStatus,
  updatePaymentStatus,
  createOrderFromCart,
  ordersCollection,
} from "../models/Order";
import { authGuard, adminOnly } from "../middleware/auth";
import { getUserByUID } from "../models/User";
import { getCartByUid, clearCart } from "../models/Cart";

const router = Router();

function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(/[,\s\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

/** ------------------------------------------------------------------
 *  Admin: list all orders (paginated)
 *  GET /api/orders
 * ------------------------------------------------------------------ */
router.get(
  "/",
  authGuard,
  adminOnly,
  async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page ?? 1) || 1;
      const limit = Number(req.query.limit ?? 20) || 20;

      const result = await getOrdersPaginated(page, limit);
      return res.json(result);
    } catch (err) {
      console.error("GET /api/orders error:", err);
      return res.status(500).json({ message: "Failed to load orders" });
    }
  }
);

/** ------------------------------------------------------------------
 *  Logged-in user: my own orders
 *  GET /api/orders/my
 * ------------------------------------------------------------------ */
router.get(
  "/my",
  authGuard,
  async (req: Request, res: Response) => {
    try {
      const anyReq = req as any;
      const uid: string | undefined =
        anyReq.uid ||
        anyReq.userId ||
        anyReq.user?.uid ||
        anyReq.user?.id;

      if (!uid) {
        console.warn("/api/orders/my called without uid on request");
        return res
          .status(401)
          .json({ ok: false, message: "Unauthenticated" });
      }

      const col = ordersCollection();
      const orders = await col
        .find({ userId: uid })
        .sort({ createdAt: -1 })
        .toArray();

      return res.json({ ok: true, orders });
    } catch (err) {
      console.error("GET /api/orders/my error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Failed to load user orders" });
    }
  }
);

/** ------------------------------------------------------------------
 *  Logged-in user: create order from cart
 *  POST /api/orders
 * ------------------------------------------------------------------ */
router.post(
  "/",
  authGuard,
  async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const cart = await getCartByUid(uid);
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      const userDoc = await getUserByUID(uid);
      const order = await createOrderFromCart({
        userId: uid,
        userName: userDoc?.displayName || null,
        email: userDoc?.email || req.user?.email || null,
        items: cart.items,
        currency: (process.env.ORDER_CURRENCY || "aud").toLowerCase(),
      });

      await clearCart(uid);

      return res.status(201).json({ ok: true, order });
    } catch (err) {
      console.error("POST /api/orders error:", err);
      return res.status(500).json({ message: "Failed to place order" });
    }
  }
);

/** ------------------------------------------------------------------
 *  Logged-in user or admin: fetch a single order
 *  GET /api/orders/:id
 * ------------------------------------------------------------------ */
router.get(
  "/:id",
  authGuard,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid order id" });
      }

      const order = await ordersCollection().findOne({ _id: new ObjectId(id) });
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const uid = req.user?.uid;
      if (!uid) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const email = req.user?.email?.toLowerCase() || null;
      const isAdmin = isAdminEmail(email);

      if (!isAdmin && order.userId !== uid) {
        return res.status(403).json({ message: "Forbidden" });
      }

      return res.json({ ok: true, order });
    } catch (err) {
      console.error("GET /api/orders/:id error:", err);
      return res.status(500).json({ message: "Failed to load order" });
    }
  }
);

/** ------------------------------------------------------------------
 *  Admin: update kitchen workflow status
 *  PUT /api/orders/:id
 * ------------------------------------------------------------------ */
router.put(
  "/:id",
  authGuard,
  adminOnly,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, paymentStatus } = req.body as {
        status?: OrderStatus;
        paymentStatus?: "paid" | "unpaid";
      };

      if (!status && !paymentStatus) {
        return res
          .status(400)
          .json({ message: "Missing status or paymentStatus" });
      }

      if (status) {
        await updateOrderStatus(id, status);
      }
      if (paymentStatus) {
        await updatePaymentStatus(id, paymentStatus);
      }
      return res.json({ message: "Order updated" });
    } catch (err) {
      console.error("PUT /api/orders/:id error:", err);
      return res.status(500).json({ message: "Failed to update order" });
    }
  }
);

export default router;
