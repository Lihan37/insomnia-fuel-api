// src/routes/users.ts
import { Router, type Request, type Response } from "express";
import {
  createUser,
  getUserByUID,
  getUsersPaginated,
  deleteUser,
} from "../models/User";
import { authGuard, adminOnly } from "../middleware/auth";

const router = Router();

/**
 * GET /api/users
 * Admin: paginated list of users
 * Response: { items, total, page, limit }
 */
router.get(
  "/",
  authGuard,
  adminOnly,
  async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page ?? 1) || 1;
      const limit = Number(req.query.limit ?? 20) || 20;

      const result = await getUsersPaginated(page, limit);
      return res.json({ ...result, page, limit });
    } catch (err) {
      console.error("GET /api/users error:", err);
      return res.status(500).json({ message: "Failed to load users" });
    }
  }
);

/**
 * GET /api/users/me
 * Get current logged-in user from DB (by Firebase uid)
 */
router.get("/me", authGuard, async (req: Request, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await getUserByUID(uid);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (err) {
    console.error("GET /api/users/me error:", err);
    return res.status(500).json({ message: "Failed to load current user" });
  }
});

/**
 * POST /api/users
 * Create a user document right after Firebase signup.
 * Called from the Register form on the client.
 *
 * Body can contain: displayName, name, photoURL, phone
 */
router.post("/", authGuard, async (req: Request, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email;

    if (!uid || !email) {
      return res.status(400).json({ message: "Missing uid or email" });
    }

    // If already exists, just return existing record
    const existing = await getUserByUID(uid);
    if (existing) {
      return res.json(existing);
    }

    const {
      displayName,
      name,
      photoURL,
      phone,
    }: {
      displayName?: string;
      name?: string;
      photoURL?: string;
      phone?: string;
    } = req.body ?? {};

    const newUser = await createUser({
      uid,
      email,
      displayName: displayName || name || "",
      photoURL: photoURL || "",
      phone: phone || "",
    });

    return res.status(201).json(newUser);
  } catch (err) {
    console.error("POST /api/users error:", err);
    return res.status(500).json({ message: "Failed to create user" });
  }
});

/**
 * POST /api/users/sync
 * Optional: create user in DB on first login.
 * Can be used by client on login instead of signup if you want.
 */
router.post("/sync", authGuard, async (req: Request, res: Response) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email;

    if (!uid || !email) {
      return res.status(400).json({ message: "Missing uid or email" });
    }

    const existing = await getUserByUID(uid);
    if (existing) {
      return res.json(existing);
    }

    const {
      displayName,
      name,
      photoURL,
      phone,
    }: {
      displayName?: string;
      name?: string;
      photoURL?: string;
      phone?: string;
    } = req.body ?? {};

    const newUser = await createUser({
      uid,
      email,
      displayName: displayName || name || "",
      photoURL: photoURL || "",
      phone: phone || "",
    });

    return res.status(201).json(newUser);
  } catch (err) {
    console.error("POST /api/users/sync error:", err);
    return res.status(500).json({ message: "Failed to sync user" });
  }
});

/**
 * DELETE /api/users/:uid
 * Admin: delete a user document
 */
router.delete(
  "/:uid",
  authGuard,
  adminOnly,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req.params;
      const ok = await deleteUser(uid);

      if (!ok) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({ message: "User deleted" });
    } catch (err) {
      console.error("DELETE /api/users/:uid error:", err);
      return res.status(500).json({ message: "Failed to delete user" });
    }
  }
);



export default router;
