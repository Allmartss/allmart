import { Router, type IRouter, type Request, type Response } from "express";
import { db, ordersTable, cartItemsTable, productsTable, usersTable, notificationsTable, cashbackCodesTable } from "@workspace/db";
import { and, eq, desc, inArray } from "drizzle-orm";
import { PlaceOrderBody, UpdateOrderStatusBody } from "@workspace/api-zod";
import { serializeOrder } from "../lib/serializers";
import { generateTrackingCode } from "../lib/tracking";
import { requireRole, getUserFromCookie } from "../lib/auth";
import { sendOrderEmail } from "./email";
import { logger } from "../lib/logger";
import { isSafeMediaUrl } from "../lib/url-validation";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAYMENT_METHODS = ["stripe", "bank_transfer", "pay_on_delivery"] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

export async function placeOrderForSession(
  sessionId: string,
  shippingAddress: string,
  placedBy: "user" | "ai",
  userId?: number,
  extras?: {
    receiverName?: string;
    receiverEmail?: string;
    receiverPhone?: string;
    cashbackCode?: string;
    paymentMethod?: PaymentMethod;
    paymentScreenshotUrl?: string;
    paymentNote?: string;
    bonusApplied?: boolean;
    deferCartClear?: boolean;
    stripeSessionId?: string;
  },
) {
  const items = await db
    .select()
    .from(cartItemsTable)
    .where(eq(cartItemsTable.sessionId, sessionId));

  if (items.length === 0) {
    return { error: "Cart is empty" as const };
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, items.map((i) => i.productId)));
  const byId = new Map(products.map((p) => [p.id, p]));

  let total = 0;
  const orderItems = items.map((i) => {
    const p = byId.get(i.productId)!;
    total += i.quantity * p.price;
    return {
      productId: p.id,
      productName: p.name,
      quantity: i.quantity,
      unitPrice: p.price,
      imageUrl: p.imageUrl,
    };
  });
  total = Math.round(total * 100) / 100;

  const discounts = await calculateOrderDiscounts(total, userId, {
    cashbackCode: extras?.cashbackCode,
    bonusApplied: extras?.bonusApplied,
  });
  total = discounts.total;

  if (discounts.cashbackCodeId) {
    await db.update(cashbackCodesTable)
      .set({ usedCount: discounts.cashbackUsedCount + 1 })
      .where(eq(cashbackCodesTable.id, discounts.cashbackCodeId));
  }

  if (discounts.bonusDiscount && userId) {
    const [updatedUser] = await db
      .update(usersTable)
      .set({
        bonusBalance: discounts.remainingBonusBalance,
      })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id });
    if (!updatedUser) {
      return { error: "Bonus balance changed. Please retry checkout." as const };
    }
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      sessionId,
      userId: userId ?? null,
      status: "placed",
      total,
      currency: "USD",
      trackingCode: generateTrackingCode(),
      shippingAddress,
      receiverName: extras?.receiverName ?? null,
      receiverEmail: extras?.receiverEmail ?? null,
      receiverPhone: extras?.receiverPhone ?? null,
      cashbackCode: discounts.cashbackCode,
      cashbackDiscount: discounts.cashbackDiscount,
      placedBy,
      items: orderItems,
      paymentMethod: extras?.paymentMethod ?? null,
      paymentScreenshotUrl: extras?.paymentScreenshotUrl ?? null,
      paymentNote: extras?.paymentNote ?? null,
      paymentVerified: "pending",
      stripeSessionId: extras?.stripeSessionId ?? null,
      bonusDiscount: discounts.bonusDiscount,
    })
    .returning();

  if (!extras?.deferCartClear) {
    await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  }

  return { order: order! };
}

export async function calculateOrderDiscounts(
  baseTotal: number,
  userId: number | undefined,
  options: { cashbackCode?: string; bonusApplied?: boolean },
) {
  let total = Math.round(baseTotal * 100) / 100;
  let cashbackCode: string | null = null;
  let cashbackDiscount: number | null = null;
  let cashbackCodeId: number | null = null;
  let cashbackUsedCount = 0;

  if (options.cashbackCode) {
    const [cb] = await db
      .select()
      .from(cashbackCodesTable)
      .where(eq(cashbackCodesTable.code, options.cashbackCode.trim().toUpperCase()));
    if (cb && cb.isActive && cb.usedCount < cb.maxUses) {
      cashbackCode = cb.code;
      cashbackCodeId = cb.id;
      cashbackUsedCount = cb.usedCount;
      cashbackDiscount = Math.min(cb.amount, total);
      total = Math.max(0, Math.round((total - cashbackDiscount) * 100) / 100);
    }
  }

  let bonusDiscount: number | null = null;
  let remainingBonusBalance: number | null = null;
  if (options.bonusApplied && userId) {
    const [userRow] = await db
      .select({ bonusBalance: usersTable.bonusBalance })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (userRow && userRow.bonusBalance > 0) {
      bonusDiscount = Math.min(userRow.bonusBalance, total);
      total = Math.max(0, Math.round((total - bonusDiscount) * 100) / 100);
      remainingBonusBalance = Math.round((userRow.bonusBalance - bonusDiscount) * 100) / 100;
    }
  }

  return {
    total,
    cashbackCode,
    cashbackDiscount,
    cashbackCodeId,
    cashbackUsedCount,
    bonusDiscount,
    remainingBonusBalance,
  };
}

const ORDER_STATUS_COPY: Record<string, { title: string; message: (trackingCode: string, total?: number, currency?: string) => string }> = {
  placed: {
    title: "🎉 Order Placed",
    message: (t, total, currency) => `Your order #${t} has been placed successfully. Total: ${new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(total ?? 0)}. We'll notify you once payment is confirmed.`,
  },
  confirmed: {
    title: "✅ Payment Confirmed",
    message: (t) => `Great news! Your payment for order #${t} has been confirmed. We're now preparing your items for dispatch.`,
  },
  dispatched: {
    title: "🚚 Order On the Way",
    message: (t) => `Your order #${t} has been dispatched and is on its way to you. Keep an eye out for your delivery!`,
  },
  delivered: {
    title: "📦 Order Delivered",
    message: (t) => `Your order #${t} has been delivered. We hope you love your purchase! Please reach out if you need any help.`,
  },
  cancelled: {
    title: "❌ Order Cancelled",
    message: (t) => `Your order #${t} has been cancelled. If this was unexpected, please contact our support team.`,
  },
};

export async function sendPlacedEmailAndNotification(
  order: { trackingCode: string; total: number; currency: string; shippingAddress: string },
  userId: number,
) {
  const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!userRow) return;

  const copy = ORDER_STATUS_COPY.placed;
  // Always insert the in-app notification
  await db.insert(notificationsTable).values({
    userId: userRow.id,
    title: copy.title,
    message: copy.message(order.trackingCode, order.total, order.currency),
  });

  // Email is best-effort — don't let it block the notification
  if (userRow.email) {
    try {
      await sendOrderEmail({
        to: userRow.email,
        name: userRow.name,
        orderStatus: "placed",
        trackingCode: order.trackingCode,
        total: order.total,
        currency: order.currency,
        shippingAddress: order.shippingAddress,
      });
    } catch (err) { logger.error({ err }, "order placed email failed"); }
  }
}

router.get("/orders", async (req: Request, res: Response) => {
  const user = await getUserFromCookie(req);
  const rows = await db
    .select()
    .from(ordersTable)
    .where(
      user
        ? eq(ordersTable.userId, user.id)
        : eq(ordersTable.sessionId, req.sessionId)
    )
    .orderBy(desc(ordersTable.createdAt));
  res.json(rows.map(serializeOrder));
});

router.post("/orders", async (req: Request, res: Response) => {
  const parsed = PlaceOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const user = await getUserFromCookie(req);
  if (!user) {
    res.status(401).json({ error: "Sign in required to place an order" });
    return;
  }
  if (!user.emailVerified) {
    res.status(403).json({ error: "Please verify your email before placing an order" });
    return;
  }
  const placedBy = (parsed.data.placedBy as "user" | "ai" | undefined) ?? "user";
  const body = req.body as {
    receiverName?: string;
    receiverEmail?: string;
    receiverPhone?: string;
    cashbackCode?: string;
    paymentMethod?: PaymentMethod;
    paymentScreenshotUrl?: string;
    paymentNote?: string;
    bonusApplied?: boolean;
    deferCartClear?: boolean;
  };
  if (body.receiverEmail && !EMAIL_RE.test(body.receiverEmail.trim())) {
    res.status(400).json({ error: "receiverEmail must be a valid email address" });
    return;
  }
  if (body.paymentMethod && !PAYMENT_METHODS.includes(body.paymentMethod)) {
    res.status(400).json({ error: "Invalid payment method" });
    return;
  }
  if (body.paymentScreenshotUrl && !isSafeMediaUrl(body.paymentScreenshotUrl)) {
    res.status(400).json({ error: "Invalid payment screenshot URL" });
    return;
  }
  if (body.paymentNote && body.paymentNote.length > 2000) {
    res.status(400).json({ error: "Payment note is too long" });
    return;
  }
  const result = await placeOrderForSession(req.sessionId, parsed.data.shippingAddress, placedBy, user?.id, {
    receiverName: body.receiverName,
    receiverEmail: body.receiverEmail,
    receiverPhone: body.receiverPhone,
    cashbackCode: body.cashbackCode,
    paymentMethod: body.paymentMethod,
    paymentScreenshotUrl: body.paymentScreenshotUrl,
    paymentNote: body.paymentNote,
    bonusApplied: body.bonusApplied,
    deferCartClear: body.deferCartClear,
  });
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (user?.id) {
    try { await sendPlacedEmailAndNotification(result.order, user.id); } catch (err) { logger.error({ err }, "order placed email failed"); }
  }
  if (result.order.paymentScreenshotUrl) {
    try {
      const adminUsers = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.role, "admin"));
      if (adminUsers.length > 0) {
        await db.insert(notificationsTable).values(
          adminUsers.map((a) => ({
            userId: a.id,
            title: `Payment screenshot — Order ${result.order.trackingCode}`,
            message: `A customer has uploaded a payment screenshot for order ${result.order.trackingCode} (${new Intl.NumberFormat("en-US", { style: "currency", currency: result.order.currency }).format(result.order.total)}). Please review and verify.`,
          }))
        );
      }
    } catch (err) { logger.error({ err }, "admin payment notification failed"); }
  }
  res.status(201).json(serializeOrder(result.order));
});

router.patch(
  "/orders/:id/status",
  requireRole("admin", "pm"),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateOrderStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const [updated] = await db
      .update(ordersTable)
      .set({ status: parsed.data.status })
      .where(eq(ordersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (updated.userId) {
      try {
        const [userRow] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, updated.userId));

        if (userRow) {
          const copy = ORDER_STATUS_COPY[updated.status] ?? {
            title: `Order #${updated.trackingCode} Updated`,
            message: (t: string) => `Your order #${t} status is now: ${updated.status}.`,
          };

          // Always send in-app notification
          await db.insert(notificationsTable).values({
            userId: userRow.id,
            title: copy.title,
            message: copy.message(updated.trackingCode, updated.total, updated.currency),
          });

          // Email is best-effort
          if (userRow.email) {
            try {
              await sendOrderEmail({
                to: userRow.email,
                name: userRow.name,
                orderStatus: updated.status,
                trackingCode: updated.trackingCode,
                total: updated.total,
                currency: updated.currency,
                shippingAddress: updated.shippingAddress,
              });
            } catch (err) { logger.error({ err }, "order status email failed"); }
          }
        }
      } catch (err) { logger.error({ err }, "order status notification failed"); }
    }

    res.json(serializeOrder(updated));
  },
);

router.patch("/orders/:id/resubmit-payment", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { paymentScreenshotUrl, paymentNote } = req.body as {
    paymentScreenshotUrl?: string;
    paymentNote?: string;
  };
  if (!paymentScreenshotUrl) {
    res.status(400).json({ error: "paymentScreenshotUrl required" });
    return;
  }
  if (!isSafeMediaUrl(paymentScreenshotUrl)) {
    res.status(400).json({ error: "Invalid payment screenshot URL" });
    return;
  }

  const [existing] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.sessionId, req.sessionId)));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (existing.paymentVerified !== "rejected") {
    res.status(400).json({ error: "Only rejected payments can be resubmitted" });
    return;
  }

  const [updated] = await db
    .update(ordersTable)
    .set({
      paymentScreenshotUrl,
      paymentNote: paymentNote ?? null,
      paymentVerified: "pending",
    })
    .where(eq(ordersTable.id, id))
    .returning();

  try {
    const adminUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));
    if (adminUsers.length > 0) {
      await db.insert(notificationsTable).values(
        adminUsers.map((a) => ({
          userId: a.id,
          title: `Resubmitted screenshot — Order ${updated.trackingCode}`,
          message: `A customer has resubmitted their payment screenshot for order ${updated.trackingCode}. Please review and verify.`,
        }))
      );
    }
  } catch (err) { logger.error({ err }, "admin resubmit notification failed"); }

  res.json(serializeOrder(updated!));
});

router.get("/orders/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.sessionId, req.sessionId)));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeOrder(row));
});

export default router;
