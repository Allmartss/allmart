import { Router, type IRouter, type Request, type Response } from "express";
import { db, orderReportsTable, ordersTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireRole, getUserFromCookie } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// User: submit a report for an order
router.post("/order-reports", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }

  const { orderId, reason } = req.body as { orderId?: number; reason?: string };
  if (!orderId || !reason?.trim()) {
    res.status(400).json({ error: "orderId and reason are required" });
    return;
  }

  // Verify order belongs to user
  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.userId, user.id)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [report] = await db.insert(orderReportsTable).values({
    orderId,
    userId: user.id,
    orderTrackingCode: order.trackingCode,
    reason: reason.trim(),
  }).returning();

  // Notify admins
  try {
    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    if (admins.length > 0) {
      await db.insert(notificationsTable).values(
        admins.map((a) => ({
          userId: a.id,
          title: `⚠️ Order Report — #${order.trackingCode}`,
          message: `A customer reported an issue with order #${order.trackingCode}: "${reason.trim().slice(0, 120)}"`,
        }))
      );
    }
  } catch (err) { logger.error({ err }, "order report admin notification failed"); }

  res.status(201).json(report);
});

// User: get own reports
router.get("/order-reports/mine", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  const rows = await db.select().from(orderReportsTable)
    .where(eq(orderReportsTable.userId, user.id))
    .orderBy(desc(orderReportsTable.createdAt));
  res.json(rows);
});

// Admin: get all reports
router.get("/admin/order-reports", requireRole("admin"), async (_req: Request, res: Response) => {
  const rows = await db.select().from(orderReportsTable)
    .orderBy(desc(orderReportsTable.createdAt));
  res.json(rows);
});

// Admin: update report status / add note
router.patch("/admin/order-reports/:id", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status, adminNote } = req.body as { status?: string; adminNote?: string };
  const [updated] = await db.update(orderReportsTable)
    .set({
      ...(status && { status }),
      ...(adminNote !== undefined && { adminNote }),
    })
    .where(eq(orderReportsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

export default router;
