import { Request, Response, NextFunction } from "express";
import admin from "../config/firebaseAdmin";

// Middleware to verify Firebase ID Token from Authorization header
export async function authGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);

    if (!decodedToken) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = decodedToken;
    next();
  } catch (err: unknown) {
    // Ensure the error is of type 'Error' before accessing its properties
    if (err instanceof Error) {
      return res.status(401).json({ message: "Unauthorized", error: err.message });
    } else {
      return res.status(401).json({ message: "Unauthorized", error: "Unknown error" });
    }
  }
}

// Middleware to check if user is admin
export async function adminOnly(req: Request, res: Response, next: NextFunction) {
  try {
    const email = req.user?.email?.toLowerCase();
    if (!email) return res.status(403).json({ message: "Missing email" });

    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
      .split(/[, \s\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ message: "Admins only" });
    }

    next();
  } catch (err: unknown) {
    // Ensure the error is of type 'Error' before accessing its properties
    if (err instanceof Error) {
      return res.status(403).json({ message: "Forbidden", error: err.message });
    } else {
      return res.status(403).json({ message: "Forbidden", error: "Unknown error" });
    }
  }
}
