// src/lib/mailer.ts
import type { IOrder } from "../models/Order";
import { Resend } from "resend";

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return null;
  return { apiKey, from };
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
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    console.warn("Email not sent: ADMIN_EMAILS is empty.");
    return;
  }

  const subject = `New order received${order._id ? ` (#${order._id})` : ""}`;
  const text = formatOrderLines(order);

  const resendConfig = getResendConfig();
  if (resendConfig) {
    const resend = new Resend(resendConfig.apiKey);
    await resend.emails.send({
      from: resendConfig.from,
      to: adminEmails,
      subject,
      text,
    });
    return;
  }

  console.warn("Email not sent: missing RESEND configuration.");
}
