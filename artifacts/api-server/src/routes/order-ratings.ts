import { Router, type IRouter, type Request, type Response } from "express";
import { db, orderRatingsTable, ordersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireRole, getUserFromCookie } from "../lib/auth";

const router: IRouter = Router();

// User: rate a delivered order
router.post("/order-ratings", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }

  const { orderId, rating, comment } = req.body as {
    orderId?: number;
    rating?: number;
    comment?: string;
  };

  if (!orderId || rating == null || rating < 1 || rating > 5) {
    res.status(400).json({ error: "orderId and rating (1–5) are required" });
    return;
  }

  // Verify order belongs to user
  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.userId, user.id)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  // Upsert: one rating per order (unique constraint on order_id)
  const existing = await db.select().from(orderRatingsTable)
    .where(eq(orderRatingsTable.orderId, orderId));

  let result;
  if (existing.length > 0) {
    const [updated] = await db.update(orderRatingsTable)
      .set({ rating: Math.round(rating), comment: comment?.trim() ?? null })
      .where(eq(orderRatingsTable.orderId, orderId))
      .returning();
    result = updated;
  } else {
    const [inserted] = await db.insert(orderRatingsTable).values({
      orderId,
      userId: user.id,
      orderTrackingCode: order.trackingCode,
      rating: Math.round(rating),
      comment: comment?.trim() ?? null,
    }).returning();
    result = inserted;
  }

  res.status(201).json(result);
});

// User: check if order already rated
router.get("/order-ratings/order/:orderId", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  if (!user) { res.status(401).json({ error: "Sign in required" }); return; }
  const orderId = Number(req.params.orderId);
  const [row] = await db.select().from(orderRatingsTable)
    .where(and(eq(orderRatingsTable.orderId, orderId), eq(orderRatingsTable.userId, user.id)));
  res.json(row ?? null);
});

// Admin: get all ratings
router.get("/admin/order-ratings", requireRole("admin"), async (_req: Request, res: Response) => {
  const rows = await db.select().from(orderRatingsTable)
    .orderBy(desc(orderRatingsTable.createdAt));
  res.json(rows);
});

export default router;
