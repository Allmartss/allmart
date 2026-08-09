import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";
import { calculateOrderDiscounts, placeOrderForSession, sendPlacedEmailAndNotification } from "./orders";
import { serializeOrder } from "../lib/serializers";
import { getUserFromCookie, requireRole } from "../lib/auth";
import { sendTelegram } from "../lib/telegram";
import { buildCart } from "./cart";
import { trustedOrigins, isTrustedUrl } from "../lib/trusted-origin";
import { db, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "no-key-set");

router.post("/stripe/initialize", requireRole("buyer", "pm", "admin"), async (req: Request, res: Response) => {
  const { email, callbackUrl, shippingAddress, cashbackCode, bonusApplied } = req.body as {
    email: string;
    callbackUrl: string;
    shippingAddress: string;
    cashbackCode?: string;
    bonusApplied?: boolean;
  };

  if (!email || !callbackUrl || !shippingAddress || shippingAddress.length > 2000 || !isTrustedUrl(callbackUrl)) {
    res.status(400).json({ error: "email, shippingAddress, and a trusted callbackUrl are required" });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Stripe is not configured on this server" });
    return;
  }

  try {
    const cart = await buildCart(req.sessionId);
    if (cart.subtotal <= 0) {
      res.status(400).json({ error: "Cart is empty or total is zero" });
      return;
    }
    const userId = (req as Request & { authUser?: { id: number } }).authUser?.id;
    const discounts = await calculateOrderDiscounts(cart.subtotal, userId, {
      cashbackCode,
      bonusApplied: bonusApplied === true,
    });
    if (discounts.total <= 0) {
      res.status(400).json({ error: "The order total must be greater than zero for Stripe payment" });
      return;
    }
    const callbackOrigin = new URL(callbackUrl).origin;
    if (!trustedOrigins().has(callbackOrigin)) {
      res.status(400).json({ error: "Invalid callbackUrl" });
      return;
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "AllMart Order" },
            unit_amount: Math.round(discounts.total * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${callbackUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${callbackUrl}?cancelled=1`,
      metadata: {
        sessionId: req.sessionId,
        userId: String(userId ?? ""),
        shippingAddress,
        cashbackCode: discounts.cashbackCode ?? "",
        cashbackDiscount: String(discounts.cashbackDiscount ?? 0),
        bonusDiscount: String(discounts.bonusDiscount ?? 0),
      },
    });

    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (err) {
    res.status(502).json({ error: "Failed to create Stripe session", detail: String(err) });
  }
});

router.post("/stripe/verify", requireRole("buyer", "pm", "admin"), async (req: Request, res: Response) => {
  const { sessionId } = req.body as {
    sessionId: string;
  };

  if (!sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      res.status(402).json({ error: "Payment not completed", detail: session.payment_status });
      return;
    }

    const user = await getUserFromCookie(req);
    const metadataUserId = Number(session.metadata?.["userId"] ?? "");
    const metaSessionId = session.metadata?.["sessionId"] as string | undefined;
    const belongsToUser =
      Number.isSafeInteger(metadataUserId) && metadataUserId > 0
        ? metadataUserId === user?.id
        : metaSessionId === req.sessionId;
    if (!user || !belongsToUser) {
      res.status(403).json({ error: "Payment session does not belong to this account" });
      return;
    }

    const existing = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.stripeSessionId, sessionId))
      .limit(1);
    if (existing[0]) {
      res.status(200).json(serializeOrder(existing[0]));
      return;
    }

    const shippingAddress = session.metadata?.["shippingAddress"] as string | undefined;
    if (!shippingAddress || shippingAddress.length > 2000) {
      res.status(400).json({ error: "Shipping address is required" });
      return;
    }

    // For chat-initiated payments, bind back to the originating cart session
    // from Stripe metadata to prevent cross-session order injection.
    const orderSessionId = metaSessionId ?? req.sessionId;
    const expectedCashbackCode = session.metadata?.["cashbackCode"] || undefined;
    const expectedBonusApplied = Number(session.metadata?.["bonusDiscount"] ?? 0) > 0;

    const placed = await placeOrderForSession(orderSessionId, shippingAddress, "user", user.id, {
      paymentMethod: "stripe",
      cashbackCode: expectedCashbackCode,
      bonusApplied: expectedBonusApplied,
      deferCartClear: true,
      stripeSessionId: sessionId,
    });
    if ("error" in placed) {
      res.status(400).json({ error: placed.error });
      return;
    }

    if (user?.id) {
      try { await sendPlacedEmailAndNotification(placed.order, user.id); } catch (err) { req.log.error({ err }, "stripe order email failed"); }
    }
    // Admin Telegram alert for Stripe-paid orders
    sendTelegram(
      `🛒 <b>New AI Order</b> — Card (Stripe)\nTracking: <code>${placed.order.trackingCode}</code>\nTotal: $${placed.order.total}\nAddress: ${placed.order.shippingAddress}`,
    );

    res.status(201).json(serializeOrder(placed.order));
  } catch (err) {
    req.log.error({ err }, "Stripe verification failed");
    res.status(502).json({ error: "Stripe verification failed" });
  }
});

export default router;
