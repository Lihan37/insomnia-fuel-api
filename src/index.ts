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
import checkoutRoutes from "./routes/checkout";
import contactRoutes from "./routes/contact";


const app = express();

// ===== Middleware =====
app.use(
  cors({
    origin: ["http://localhost:5173", "https://insomnia-fuel.netlify.app"], 
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// ===== Health Check =====
app.get("/", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    message: "Insomnia Fuel API is running",
    endpoints: ["/api/health", "/api/users", "/api/menu"],
  });
});

app.get("/api/health", (_req: Request, res: Response) =>
  res.json({ ok: true })
);

// ===== Routes =====
app.use("/api/users", userRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/contact", contactRoutes);

// ===== 404 =====
app.use((req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: "Not Found", path: req.path });
});

// ===== Global Error Handler =====
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("💥 Unhandled Error:", message);
  res.status(500).json({ ok: false, error: message });
});

const PORT = Number(process.env.PORT) || 5000;

// ===== Server Bootstrap =====
(async () => {
  try {
    await initMongo(); // initialize MongoDB once

    app.listen(PORT, () =>
      console.log(`🚀 API running on http://localhost:${PORT}`)
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Server start failed:", msg);
    process.exit(1);
  }
})();
