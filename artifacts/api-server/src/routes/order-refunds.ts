import { Router, type IRouter, type Request, type Response } from "express";
import { db, orderRefundsTable, ordersTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireRole, getUserFromCookie } from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// User: request a refund for an order
router.post("/order-refunds", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }

  const { orderId, reason, description, imageUrl } = req.body as {
    orderId?: number;
    reason?: string;
    description?: string;
    imageUrl?: string;
  };

  if (!orderId || !reason?.trim() || !description?.trim() || !imageUrl?.trim()) {
    res.status(400).json({ error: "orderId, reason, description, and proof image are required" });
    return;
  }

  // Verify order belongs to user
  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.userId, user.id)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  // Check if refund already requested for this order
  const [existing] = await db.select().from(orderRefundsTable)
    .where(eq(orderRefundsTable.orderId, orderId));
  if (existing) {
    res.status(409).json({ error: "A refund request already exists for this order" });
    return;
  }

  const [refund] = await db.insert(orderRefundsTable).values({
    orderId,
    userId: user.id,
    orderTrackingCode: order.trackingCode,
    reason: reason.trim(),
    description: description.trim(),
    imageUrl: imageUrl.trim(),
  }).returning();

  // Notify admins
  try {
    const admins = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    if (admins.length > 0) {
      await db.insert(notificationsTable).values(
        admins.map((a) => ({
          userId: a.id,
          title: `💸 Refund Request — #${order.trackingCode}`,
          message: `Customer requested a refund for order #${order.trackingCode}. Reason: "${reason.trim().slice(0, 100)}"`,
        }))
      );
    }
  } catch (err) { logger.error({ err }, "order refund admin notification failed"); }

  // Notify user
  try {
    await db.insert(notificationsTable).values({
      userId: user.id,
      title: "Refund request received",
      message: `Your refund request for order #${order.trackingCode} has been submitted. We'll review it and get back to you soon.`,
    });
  } catch (err) { logger.error({ err }, "order refund user notification failed"); }

  res.status(201).json(refund);
});

// User: get own refund requests
router.get("/order-refunds/mine", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  const rows = await db.select().from(orderRefundsTable)
    .where(eq(orderRefundsTable.userId, user.id))
    .orderBy(desc(orderRefundsTable.createdAt));
  res.json(rows);
});

// Admin: get all refund requests
router.get("/admin/order-refunds", requireRole("admin"), async (_req: Request, res: Response) => {
  const rows = await db.select().from(orderRefundsTable)
    .orderBy(desc(orderRefundsTable.createdAt));
  res.json(rows);
});

// Admin: update refund status / add note
router.patch("/admin/order-refunds/:id", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status, adminNote } = req.body as { status?: string; adminNote?: string };

  const [existing] = await db.select().from(orderRefundsTable).where(eq(orderRefundsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(orderRefundsTable)
    .set({
      ...(status && { status }),
      ...(adminNote !== undefined && { adminNote }),
      ...((status === "approved" || status === "rejected") && { resolvedAt: new Date() }),
    })
    .where(eq(orderRefundsTable.id, id))
    .returning();

  // Notify user if status changed
  if (status && existing.userId && status !== existing.status) {
    try {
      const msg = status === "approved"
        ? `Your refund request for order #${existing.orderTrackingCode} has been approved.`
        : status === "rejected"
        ? `Your refund request for order #${existing.orderTrackingCode} has been reviewed. Unfortunately it was not approved${adminNote ? `: ${adminNote}` : "."}`
        : `Your refund request for order #${existing.orderTrackingCode} status is now: ${status}.`;
      await db.insert(notificationsTable).values({
        userId: existing.userId,
        title: `Refund ${status === "approved" ? "Approved ✅" : status === "rejected" ? "Not Approved ❌" : "Updated"}`,
        message: msg,
      });
    } catch (err) { logger.error({ err }, "order refund user status notification failed"); }
  }

  res.json(updated);
});

export default router;
