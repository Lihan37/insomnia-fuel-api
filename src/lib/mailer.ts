// src/lib/mailer.ts
import nodemailer from "nodemailer";
import type { IOrder } from "../models/Order";

type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

function getMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const from = process.env.SMTP_FROM;

  if (!host || !port || !from) return null;

  return {
    host,
    port,
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from,
  };
}

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(/[,\s\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function formatOrderLines(order: IOrder) {
  const items = order.items
    .map(
      (it) =>
        `- ${it.name} x${it.quantity} @ $${it.price.toFixed(2)} = $${(
          it.price * it.quantity
        ).toFixed(2)}`
    )
    .join("\n");

  const orderId = order._id?.toString() || "unknown";

  return [
    `Order ID: ${orderId}`,
    `Customer: ${order.userName || "Guest"} (${order.email || "n/a"})`,
    `Total: $${order.total.toFixed(2)} ${order.currency.toUpperCase()}`,
    `Status: ${order.status}`,
    "",
    "Items:",
    items,
  ].join("\n");
}

export async function sendNewOrderEmail(order: IOrder) {
  const mailConfig = getMailConfig();
  if (!mailConfig) {
    console.warn("Email not sent: missing SMTP configuration.");
    return;
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    console.warn("Email not sent: ADMIN_EMAILS is empty.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    connectionTimeout: Number(process.env.SMTP_CONNECT_TIMEOUT_MS || 8000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 8000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 8000),
    auth:
      mailConfig.user && mailConfig.pass
        ? { user: mailConfig.user, pass: mailConfig.pass }
        : undefined,
  });

  const subject = `New order received${order._id ? ` (#${order._id})` : ""}`;
  const text = formatOrderLines(order);

  await transporter.sendMail({
    from: mailConfig.from,
    to: adminEmails,
    subject,
    text,
  });
}
