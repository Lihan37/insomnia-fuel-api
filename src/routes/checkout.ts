// src/routes/checkout.ts
import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { authGuard } from "../middleware/auth";
import { getCartByUid } from "../models/Cart";

const router = Router();

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  throw new Error("Missing STRIPE_SECRET_KEY in .env");
}

// Stripe client
const stripe = new Stripe(stripeSecret, {
  apiVersion: "2024-06-20" as any,
});

// Where to send the customer after payment
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const CURRENCY = (process.env.STRIPE_CURRENCY || "aud").toLowerCase();

/**
 * POST /api/checkout/create-session
 * Creates a Stripe Checkout session from the current authenticated user's cart.
 * Cart must already be persisted in Mongo in the `carts` collection.
 */
router.post(
  "/create-session",
  authGuard,
  async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email ?? undefined;

      if (!uid) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // 1) Load cart from DB
      const cart = await getCartByUid(uid);
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      // 2) Build Stripe line items
      const line_items = cart.items.map((it) => ({
        price_data: {
          currency: CURRENCY,
          product_data: {
            name: it.name,
            // so webhook can recover menuItemId later
            metadata: {
              menuItemId: it.menuItemId,
            },
          },
          // Stripe amounts are in the smallest currency unit (cents)
          unit_amount: Math.round(it.price * 100),
        },
        quantity: it.quantity,
      }));

      // 3) Create the session
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        line_items,
        success_url: `${CLIENT_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${CLIENT_URL}/order`,
        metadata: {
          uid,
          // You can add more metadata here if you want
        },
      });

      return res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
      console.error("Error creating Stripe session:", err);
      return res
        .status(500)
        .json({ message: "Failed to create checkout session" });
    }
  }
);

export default router;
