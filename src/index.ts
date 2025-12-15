// src/index.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import Stripe from "stripe";

import { initMongo } from "./config/mongo";
import userRoutes from "./routes/users";
import menuRoutes from "./routes/menu";
import ordersRoutes from "./routes/orders";
import cartRoutes from "./routes/cart";
import checkoutRoutes from "./routes/checkout";
import contactRoutes from "./routes/contact";

import {
  createOrderFromStripeSessionOnce,
  type IOrderItem,
} from "./models/Order";
import { clearCartByUid } from "./models/Cart";
import { getUserByUID } from "./models/User";

const app = express();

// ----- Stripe setup -----
const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  throw new Error("Missing STRIPE_SECRET_KEY in .env");
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2024-06-20" as any,
});

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// ===== Middleware (global) =====
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://insomnia-fuel.netlify.app",
      "https://insomniafuel.com.au",
    ],
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(cookieParser());

/**
 * Stripe Webhook
 *
 * IMPORTANT:
 *  - This MUST use express.raw
 *  - It MUST be declared BEFORE app.use(express.json())
 */
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    if (!stripeWebhookSecret) {
      console.error("⚠️ STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).send("Webhook not configured");
    }

    const sig = req.headers["stripe-signature"] as string | undefined;
    if (!sig) {
      return res.status(400).send("Missing Stripe-Signature header");
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        stripeWebhookSecret
      );
    } catch (err: any) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

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
            menuItemId:
              (li.price?.metadata?.menuItemId as string | undefined) || "",
            name: li.description || li.price?.nickname || "Item",
            price: (li.price?.unit_amount ?? 0) / 100,
            quantity: li.quantity ?? 1,
          }));

          await createOrderFromStripeSessionOnce({
            userId: uid,
            userName,
            email,
            items,
            currency: session.currency || "aud",
            stripeSessionId: session.id,
            paymentStatus:
              session.payment_status === "paid" ? "paid" : "unpaid",
          });

          if (uid) {
            await clearCartByUid(uid);
          }

          break;
        }

        case "charge.refunded": {
          // TODO: optionally update paymentStatus to "refunded" here
          break;
        }

        default:
          // Ignore other events for now
          break;
      }

      res.json({ received: true });
    } catch (err) {
      console.error("❌ Error handling Stripe webhook:", err);
      res.status(500).send("Webhook handler error");
    }
  }
);

// ---- JSON body parser comes AFTER webhook ----
app.use(express.json());

// ===== Routes =====
app.use("/api/users", userRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/contact", contactRoutes);

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
});

// Error handler
app.use(
  (err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Server error" });
  }
);

// ===== Start server =====
const PORT = Number(process.env.PORT) || 4000;

initMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Insomnia Fuel API running on port ${PORT}`);
  });
});
