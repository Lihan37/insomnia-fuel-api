// src/routes/contact.ts
import { Router, type Request, type Response } from "express";
import {
  appendAdminReply,
  createContactMessage,
  listContactMessagesPaginated,
  listMyContactMessagesPaginated,
  markContactRead,
  markContactHandled,
} from "../models/Contact";
import { authGuard, adminOnly } from "../middleware/auth";
import admin from "../config/firebaseAdmin";

const router = Router();

function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(/[, \s\n]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

async function getOptionalAuth(req: Request): Promise<{
  uid: string;
  email: string | null;
} | null> {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email?.toLowerCase() ?? null };
  } catch {
    return null;
  }
}

/**
 * Public: POST /api/contact
 * Used by website contact form
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, email, message } = req.body as {
      name?: string;
      email?: string;
      message?: string;
    };

    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ message: "Name, email and message are required." });
    }

    // Optional auth: if a valid bearer token is sent, bind message to that user.
    const optionalAuth = await getOptionalAuth(req);
    const userId: string | null = optionalAuth?.uid ?? null;
    const normalizedEmail = optionalAuth?.email || email.trim();

    const doc = await createContactMessage({
      userId,
      name: name.trim(),
      email: normalizedEmail,
      message: message.trim(),
    });

    return res.status(201).json({ ok: true, message: "Saved", contact: doc });
  } catch (err) {
    console.error("POST /api/contact error:", err);
    return res.status(500).json({ message: "Failed to send message." });
  }
});

/**
 * Admin: list all contact messages
 * GET /api/contact
 */
router.get(
  "/",
  authGuard,
  adminOnly,
  async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page ?? 1) || 1;
      const limit = Number(req.query.limit ?? 20) || 20;

      const result = await listContactMessagesPaginated(page, limit);
      return res.json(result);
    } catch (err) {
      console.error("GET /api/contact error:", err);
      return res
        .status(500)
        .json({ message: "Failed to load contact messages." });
    }
  }
);

/**
 * Authenticated user: list own live-chat threads
 * GET /api/contact/my
 */
router.get("/my", authGuard, async (req: Request, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ message: "Not authenticated" });

    const page = Number(req.query.page ?? 1) || 1;
    const limit = Number(req.query.limit ?? 20) || 20;
    const email = req.user?.email?.toLowerCase() ?? null;

    const result = await listMyContactMessagesPaginated(uid, email, page, limit);
    return res.json(result);
  } catch (err) {
    console.error("GET /api/contact/my error:", err);
    return res.status(500).json({ message: "Failed to load your messages." });
  }
});

/**
 * Admin: mark a message as handled / unhandled
 * PATCH /api/contact/:id
 */
router.patch(
  "/:id",
  authGuard,
  adminOnly,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { handled } = req.body as { handled?: boolean };

      if (typeof handled !== "boolean") {
        return res.status(400).json({ message: "Missing handled flag" });
      }

      await markContactHandled(id, handled);
      return res.json({ message: "Updated" });
    } catch (err) {
      console.error("PATCH /api/contact/:id error:", err);
      return res
        .status(500)
        .json({ message: "Failed to update message state." });
    }
  }
);

/**
 * Admin: reply to a contact thread
 * POST /api/contact/:id/reply
 */
router.post(
  "/:id/reply",
  authGuard,
  adminOnly,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { message } = req.body as { message?: string };
      if (!message?.trim()) {
        return res.status(400).json({ message: "Reply message is required." });
      }

      await appendAdminReply({
        id,
        senderName: req.user?.name || req.user?.email || "Admin",
        senderEmail: req.user?.email || undefined,
        message: message.trim(),
      });

      return res.status(201).json({ message: "Reply sent." });
    } catch (err) {
      console.error("POST /api/contact/:id/reply error:", err);
      return res.status(500).json({ message: "Failed to send reply." });
    }
  }
);

/**
 * User/Admin: mark a thread as read
 * POST /api/contact/:id/read
 */
router.post("/:id/read", authGuard, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bodyActor = (req.body as { actor?: "user" | "admin" })?.actor;
    const requesterEmail = req.user?.email?.toLowerCase() ?? null;
    const requesterIsAdmin = isAdminEmail(requesterEmail);

    const actor: "user" | "admin" =
      bodyActor === "admin" && requesterIsAdmin ? "admin" : "user";

    await markContactRead({ id, actor });
    return res.json({ message: "Read state updated." });
  } catch (err) {
    console.error("POST /api/contact/:id/read error:", err);
    return res.status(500).json({ message: "Failed to update read state." });
  }
});

export default router;
