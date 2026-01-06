// src/index.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { initMongo } from "./config/mongo";
import userRoutes from "./routes/users";
import menuRoutes from "./routes/menu";
import ordersRoutes from "./routes/orders";
import cartRoutes from "./routes/cart";
import contactRoutes from "./routes/contact";
import galleryRoutes from "./routes/gallery";

const app = express();

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
app.use(express.json());

// ===== Routes =====
app.use("/api/users", userRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/gallery", galleryRoutes);

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
    console.log(`Insomnia Fuel API running on port ${PORT}`);
  });
});
