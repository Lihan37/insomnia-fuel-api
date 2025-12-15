// src/routes/orders.ts
import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import {
  getOrdersPaginated,
  updateOrderStatus,
  type OrderStatus,
  getOrderByStripeSessionId,
  createOrderFromStripeSessionOnce,
  type IOrderItem,
  ordersCollection,
} from "../models/Order";
import { authGuard, adminOnly } from "../middleware/auth";
import { getUserByUID } from "../models/User";
import { clearCartByUid } from "../models/Cart";

const router = Router();

// ----- Stripe client for this route file -----
const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  throw new Error("Missing STRIPE_SECRET_KEY in .env");
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2024-06-20" as any,
});

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
 *  Stripe success fallback → ensure order exists
 *  GET /api/orders/:sessionId
 *  Called from CheckoutSuccess page.
 *
 *  - Verifies session with Stripe
 *  - Ensures payment_status === "paid"
 *  - Tries to find an order created by webhook
 *  - If not found, creates order once from Stripe line_items
 *
 *  This is safe to keep even when webhook is active because
 *  createOrderFromStripeSessionOnce is idempotent.
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
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    if (!session || session.id !== sessionId) {
      return res
        .status(404)
        .json({ ok: false, message: "Stripe session not found" });
    }

    // 2) Only treat as success if Stripe says it's paid
    if (session.payment_status !== "paid") {
      return res.status(400).json({
        ok: false,
        message: "Payment is not completed yet.",
        session,
      });
    }

    // 3) Try to find an existing order (webhook or previous call)
    let order = await getOrderByStripeSessionId(sessionId);

    // 4) If missing, create it *once* from Stripe line_items
    if (!order) {
      const uid =
        (session.metadata && (session.metadata as any).uid) ||
        session.client_reference_id ||
        null;

      const email =
        session.customer_details?.email || session.customer_email || null;

      const userDoc = uid ? await getUserByUID(uid) : null;
      const userName = userDoc?.displayName || null;

      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id,
        { limit: 100 }
      );

      const items: IOrderItem[] = lineItems.data.map((li) => ({
        // menuItemId was stored as price_data.product_data.metadata.menuItemId
        menuItemId:
          (li.price?.metadata?.menuItemId as string | undefined) || "",
        name: li.description || li.price?.nickname || "Item",
        price: (li.price?.unit_amount ?? 0) / 100, // cents → dollars
        quantity: li.quantity ?? 1,
      }));

      order = await createOrderFromStripeSessionOnce({
        userId: uid,
        userName,
        email,
        items,
        currency: session.currency || "aud",
        stripeSessionId: session.id,
        paymentStatus: "paid",
      });

      // Optional but nice: clear cart once we've recorded the order
      if (uid) {
        await clearCartByUid(uid);
      }
    }

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
