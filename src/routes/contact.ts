// src/routes/contact.ts
import { Router, type Request, type Response } from "express";
import {
  createContactMessage,
  listContactMessagesPaginated,
  markContactHandled,
} from "../models/Contact";
import { authGuard, adminOnly } from "../middleware/auth";

const router = Router();

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

    // try to read userId from auth middleware if token present (optional)
    const anyReq = req as any;
    const userId: string | null =
      anyReq.uid || anyReq.userId || anyReq.user?.uid || null;

    const doc = await createContactMessage({
      userId,
      name: name.trim(),
      email: email.trim(),
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

export default router;
