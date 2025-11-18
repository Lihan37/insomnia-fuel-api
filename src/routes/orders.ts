// src/routes/orders.ts
import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import {
  getOrdersPaginated,
  updateOrderStatus,
  type OrderStatus,
  createOrderFromCartOnce,
  type IOrderItem,
  ordersCollection,
} from "../models/Order";
import { authGuard, adminOnly } from "../middleware/auth";
import { getCartByUid, clearCartByUid } from "../models/Cart";

const router = Router();

/** ---------- Stripe client ---------- */
const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  throw new Error("Missing STRIPE_SECRET_KEY in .env");
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2024-06-20" as any,
});

const FALLBACK_CURRENCY = (process.env.STRIPE_CURRENCY || "aud").toLowerCase();

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
/** ------------------------------------------------------------------
 *  Logged-in user: my own orders
 *  GET /api/orders/my
 * ------------------------------------------------------------------ */
router.get(
  "/my",
  authGuard,
  async (req: Request, res: Response) => {
    try {
      // authGuard might attach uid in different shapes, so handle them all
      const anyReq = req as any;
      const uid: string | undefined =
        anyReq.uid ||
        anyReq.userId ||
        anyReq.user?.uid ||
        anyReq.user?.id;

      if (!uid) {
        console.warn("⚠️ /api/orders/my called without uid on request");
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
 *  Admin: update kitchen status
 *  PUT /api/orders/:id
 * ------------------------------------------------------------------ */
router.put(
  "/:id",
  authGuard,
  adminOnly,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status?: OrderStatus };

      if (!status) {
        return res.status(400).json({ message: "Missing status" });
      }

      await updateOrderStatus(id, status);
      return res.json({ message: "Status updated" });
    } catch (err) {
      console.error("PUT /api/orders/:id error:", err);
      return res.status(500).json({ message: "Failed to update status" });
    }
  }
);

/** ------------------------------------------------------------------
 *  Stripe success → create order from cart (idempotent)
 *  GET /api/orders/:sessionId
 *  Called from CheckoutSuccess page.
 * ------------------------------------------------------------------ */
router.get("/:sessionId", async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res
      .status(400)
      .json({ ok: false, message: "Missing sessionId parameter" });
  }

  try {
    // 1) Verify session with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.id !== sessionId) {
      return res
        .status(404)
        .json({ ok: false, message: "Stripe session not found" });
    }

    // 2) Extract uid & email from session (we set metadata.uid in checkout.ts)
    const uid =
      (session.metadata && (session.metadata as any).uid) ||
      session.client_reference_id ||
      null;

    const email =
      (session.customer_details && session.customer_details.email) ||
      session.customer_email ||
      null;

    // If we can't map to a user/cart, still return Stripe session
    if (!uid) {
      return res.json({ ok: true, session, order: null });
    }

    // 3) Load cart from DB
    const cart = await getCartByUid(uid);
    if (!cart || cart.items.length === 0) {
      // Cart might already be cleared; still return session
      return res.json({ ok: true, session, order: null });
    }

    // 4) Build order items from cart
    const items: IOrderItem[] = cart.items.map((it) => ({
      menuItemId: it.menuItemId,
      name: it.name,
      price: it.price,
      quantity: it.quantity,
    }));

    // 5) Create order ONCE for this session id
    const order = await createOrderFromCartOnce({
      userId: uid,
      userName: null,
      email,
      items,
      currency: session.currency || FALLBACK_CURRENCY,
      stripeSessionId: sessionId,
    });

    // 6) Clear cart now that order exists
    await clearCartByUid(uid);

    return res.json({ ok: true, session, order });
  } catch (err: any) {
    console.error("Error in GET /api/orders/:sessionId:", err);
    const statusCode = err?.statusCode || err?.raw?.statusCode;
    if (statusCode === 404) {
      return res
        .status(404)
        .json({ ok: false, message: "Stripe session not found" });
    }

    return res
      .status(500)
      .json({ ok: false, message: "Failed to verify payment" });
  }
});

export default router;
