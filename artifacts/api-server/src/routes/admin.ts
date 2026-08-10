import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, ordersTable, notificationsTable } from "@workspace/db";
import { eq, desc, gte, and, sql } from "drizzle-orm";
import { UpdateUserRoleBody } from "@workspace/api-zod";
import { requireRole } from "../lib/auth";
import { serializeOrder } from "../lib/serializers";
import { sendOrderEmail } from "./email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function publicUser(u: { id: number; email: string; name: string; role: string; tier: number; country?: string | null; phone?: string | null; sex?: string | null; address?: string | null; profileComplete: boolean; emailVerified?: boolean; referralCode?: string | null; bonusBalance: number; banned?: boolean | null }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, tier: u.tier, country: u.country ?? null, phone: u.phone ?? null, sex: u.sex ?? null, address: u.address ?? null, profileComplete: u.profileComplete, emailVerified: u.emailVerified ?? false, referralCode: u.referralCode ?? null, bonusBalance: u.bonusBalance, banned: u.banned ?? false };
}

router.get("/admin/users", requireRole("admin"), async (_req: Request, res: Response) => {
  const rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(rows.map(publicUser));
});

router.patch("/admin/users/:id", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ role: parsed.data.role })
    .where(eq(usersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(publicUser(updated));
});

router.patch("/admin/users/:id/profile", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, email } = req.body as { name?: string; email?: string };
  if (!name && !email) { res.status(400).json({ error: "Provide name or email to update" }); return; }
  const updates: Record<string, string> = {};
  if (name && name.trim()) updates.name = name.trim();
  if (email && email.trim()) updates.email = email.trim().toLowerCase();
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(publicUser(updated));
});

router.delete("/admin/users/:id", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const authUser = (req as Request & { authUser: { id: number } }).authUser;
  if (authUser.id === id) {
    res.status(400).json({ error: "You can't delete your own account" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).end();
});

router.get("/admin/orders", requireRole("admin", "pm"), async (_req: Request, res: Response) => {
  const rows = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  res.json(rows.map(serializeOrder));
});

router.patch("/admin/orders/:id/verify-payment", requireRole("admin", "pm"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { status } = req.body as { status: "verified" | "rejected" | "pending" };
  if (!["verified", "rejected", "pending"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const [updated] = await db
    .update(ordersTable)
    .set({ paymentVerified: status })
    .where(eq(ordersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (updated.userId && status !== "pending") {
    try {
      const isVerified = status === "verified";
      const notifTitle = isVerified ? "✅ Payment Confirmed" : "❌ Payment Rejected";
      const notifMessage = isVerified
        ? `Great news! Your payment for order #${updated.trackingCode} has been confirmed. We're now preparing your items for dispatch.`
        : `Your payment for order #${updated.trackingCode} could not be verified. Please contact support or resubmit your proof of payment.`;

      // Always insert in-app notification
      await db.insert(notificationsTable).values({
        userId: updated.userId,
        title: notifTitle,
        message: notifMessage,
      });

      // Also send email if we have one
      const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId));
      if (userRow?.email) {
        try {
          await sendOrderEmail({
            to: userRow.email,
            name: userRow.name,
            orderStatus: isVerified ? "confirmed" : "payment_rejected",
            trackingCode: updated.trackingCode,
            total: updated.total,
            currency: updated.currency,
            shippingAddress: updated.shippingAddress,
          });
        } catch (err) { logger.error({ err }, "payment verification email failed"); }
      }
    } catch (err) {
      logger.error({ err }, "customer payment notification failed");
    }
  }

  res.json(serializeOrder(updated));
});

router.get("/admin/sales-summary", requireRole("admin", "pm"), async (_req: Request, res: Response) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const allOrders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const active = allOrders.filter(o => o.status !== "cancelled");

  const todayOrders = active.filter(o => o.createdAt >= todayStart);
  const monthOrders = active.filter(o => o.createdAt >= monthStart);

  const sum = (arr: typeof active) => arr.reduce((a, o) => a + o.total, 0);

  const last30Days: { date: string; total: number; orders: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const next = new Date(d.getTime() + 86400000);
    const dayOrders = active.filter(o => o.createdAt >= d && o.createdAt < next);
    last30Days.push({
      date: d.toISOString().slice(0, 10),
      total: sum(dayOrders),
      orders: dayOrders.length,
    });
  }

  res.json({
    todayTotal: sum(todayOrders),
    monthTotal: sum(monthOrders),
    allTimeTotal: sum(active),
    todayOrders: todayOrders.length,
    monthOrders: monthOrders.length,
    allTimeOrders: active.length,
    dailyChart: last30Days,
  });
});

export default router;
