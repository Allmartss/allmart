import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";
import {
  db,
  chatMessagesTable,
  productsTable,
  cartItemsTable,
  settingsTable,
  ordersTable,
} from "@workspace/db";
import { and, eq, desc, asc, ilike, or, inArray, sql } from "drizzle-orm";
import { SendChatMessageBody } from "@workspace/api-zod";
import {
  chatCompletion,
  getAvailableProviders,
  serializeProvider,
  type Provider,
} from "../lib/llm";
import { serializeProduct } from "../lib/serializers";
import { buildCart } from "./cart";
import { placeOrderForSession } from "./orders";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the AllMart shopping concierge — warm, concise, and helpful.

You help shoppers discover products and, when they're ready, place orders for them entirely within this chat.
Always display prices using standard international symbols: $ for USD, € for EUR, £ for GBP. Never use ₦ or Naira in your responses.

Tools you can use:
- search_products: find products that match a shopper's need.
- get_all_products: list all available products (use when the shopper wants to browse or asks what's available).
- add_to_cart: add a specific product to the shopper's cart.
- place_order: finalize the current cart into an order. NEVER call this without the shopper's explicit confirmation AND a chosen payment method.

Behavior rules:
- If the shopper greets you with no product mention, ask warmly what they're looking for today.
- The MOMENT a shopper mentions any product category, item type, or need (even vague), CALL search_products immediately. Do not ask clarifying questions first — show them options, then refine.
- After a tool returns, briefly mention 2-3 of the best matches by name with their prices. The UI renders product cards automatically.
- If search_products returns nothing, try get_all_products and suggest what's available.
- When they say "add it" / "I'll take it" / pick a specific item, call add_to_cart, then ask if they'd like to keep shopping or check out.
- When they ask to buy / checkout / "place the order": if you have NOT yet received their explicit confirmation in this turn, summarize the cart and ask "Confirm purchase?" — do not call place_order yet.
- Only call place_order when the user clearly confirms (e.g. "yes confirm", "go ahead", or the system tells you confirmOrder=true AND paymentMethod is set).
- After ordering with bank_transfer, tell the shopper the bank details are shown below and they should send the exact amount. After pay_on_delivery, congratulate them. After stripe, tell them to click the payment button below.
- If a tool returns an error about Stripe (e.g. "stripe session failed" or "card payment unavailable"), do NOT blame the shipping address. Instead tell the shopper card payment hit an issue and suggest they try bank transfer or pay on delivery instead.
- Keep responses to 1-3 short sentences.`;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const tools = [
  {
    type: "function" as const,
    function: {
      name: "search_products",
      description:
        "Search the product catalog by free-text query. Use this as the first step whenever the shopper mentions any item, need, or category.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What the shopper is looking for (e.g. 'black running shoes', 'desk lamp under $50').",
          },
          limit: {
            type: "integer",
            description: "Max results to return (default 6).",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_all_products",
      description:
        "Retrieve all available products. Use when the shopper wants to browse, or when search_products returns no results.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Optional: filter by category slug.",
          },
          limit: {
            type: "integer",
            description: "Max results (default 12).",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_to_cart",
      description: "Add a specific product to the shopper's cart.",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "integer", description: "The product ID from search results." },
          quantity: { type: "integer", minimum: 1, description: "How many to add (default 1)." },
        },
        required: ["productId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "place_order",
      description:
        "Place an order for everything currently in the shopper's cart. ONLY call after explicit shopper confirmation.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function searchProductsTool(query: string, limit = 6) {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s$]/g, " ")
    .split(/\s+/)
    .filter(
      (t) =>
        t.length >= 3 &&
        !["the", "for", "and", "any", "with", "please", "looking", "want", "need", "find", "show", "buy"].includes(t),
    );

  const tokensToUse = tokens.length > 0 ? tokens : [query.toLowerCase()];

  const conditions = tokensToUse.map((t) => {
    const like = `%${t}%`;
    return or(
      ilike(productsTable.name, like),
      ilike(productsTable.description, like),
      ilike(productsTable.category, like),
      sql`${productsTable.tags}::text ILIKE ${like}`,
    );
  });

  return db
    .select()
    .from(productsTable)
    .where(or(...conditions))
    .limit(Math.min(limit, 20));
}

async function getAllProductsTool(category?: string, limit = 12) {
  const q = db.select().from(productsTable);
  if (category) q.where(eq(productsTable.category, category.toLowerCase()));
  return q
    .orderBy(desc(productsTable.rating))
    .limit(Math.min(limit, 30));
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** List available LLM providers (for the UI). */
router.get("/chat/providers", (_req: Request, res: Response) => {
  res.json(getAvailableProviders().map(serializeProvider));
});

router.get("/chat/messages", async (req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, req.sessionId))
    .orderBy(asc(chatMessagesTable.createdAt));

  const allSuggestionIds = Array.from(
    new Set(rows.flatMap((r) => (r.productSuggestions ?? []) as number[])),
  );
  const productMap = new Map<number, ReturnType<typeof serializeProduct>>();
  if (allSuggestionIds.length) {
    const ps = await db
      .select()
      .from(productsTable)
      .where(inArray(productsTable.id, allSuggestionIds));
    ps.forEach((p) => productMap.set(p.id, serializeProduct(p)));
  }

  res.json(
    rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      productSuggestions: ((m.productSuggestions ?? []) as number[])
        .map((id) => productMap.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p),
    })),
  );
});

router.post("/chat/reset", async (req: Request, res: Response) => {
  await db
    .delete(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, req.sessionId));
  res.status(204).end();
});

router.post("/chat/messages", async (req: Request, res: Response) => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { content, confirmOrder, shippingAddress, paymentMethod } = parsed.data;
  const sessionId = req.sessionId;

  const [userRow] = await db
    .insert(chatMessagesTable)
    .values({ sessionId, role: "user", content })
    .returning();

  const history = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, sessionId))
    .orderBy(asc(chatMessagesTable.createdAt))
    .limit(40);

  const cart = await buildCart(sessionId);
  const cartSummary =
    cart.items.length === 0
      ? "(cart is empty)"
      : cart.items
          .map((i) => `${i.quantity}x ${i.product.name} (${i.product.price})`)
          .join(", ") + ` — subtotal ${cart.subtotal}`;
  const cartTotal = cart.subtotal;

  type MessageParam = {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    tool_call_id?: string;
    tool_calls?: unknown;
  };

  // Recent orders for this session — gives the AI context so it doesn't re-ask for items the shopper already bought
  const recentOrders = await db
    .select({ id: ordersTable.id, trackingCode: ordersTable.trackingCode, status: ordersTable.status, total: ordersTable.total })
    .from(ordersTable)
    .where(eq(ordersTable.sessionId, sessionId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(3);
  const recentOrdersSummary =
    recentOrders.length === 0
      ? "(none)"
      : recentOrders.map((o) => `#${o.id} tracking=${o.trackingCode} status=${o.status} total=${o.total}`).join("; ");

  const messages: MessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `Current cart: ${cartSummary}. confirmOrder=${confirmOrder ? "true" : "false"}. shippingAddress=${shippingAddress ?? "(none provided)"}. paymentMethod=${paymentMethod ?? "(none chosen)"}. Recent orders this session: ${recentOrdersSummary}.`,
    },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const suggestedIds: number[] = [];
  const addedProductIds: number[] = [];
  let placedOrderId: number | null = null;
  let needsShippingAddress = false;
  let needsConfirmation = false;
  let stripeCheckoutUrl: string | null = null;
  let stripeError: string | null = null;
  let bankDetails: Record<string, string> | null = null;
  let assistantText = "";
  let usedProvider: Provider | null = null;

  // Tool-calling loop — up to 5 hops
  for (let hop = 0; hop < 5; hop++) {
    let result: Awaited<ReturnType<typeof chatCompletion>>;
    try {
      result = await chatCompletion(
        messages as Parameters<typeof chatCompletion>[0],
        tools,
      );
    } catch (err) {
      req.log.error({ err }, "LLM chat error — all providers failed");
      assistantText =
        "I'm having trouble reaching my brain right now — please try again in a moment.";
      break;
    }

    const { completion, provider } = result;
    usedProvider ??= provider;

    const choice = completion.choices[0];
    if (!choice) break;

    const msg = choice.message;
    const toolCalls = (
      msg as unknown as {
        tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
      }
    ).tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      assistantText = msg.content?.toString() ?? "";
      break;
    }

    // Add assistant tool-call message to context
    messages.push({
      role: "assistant",
      content: msg.content?.toString() ?? "",
      tool_calls: toolCalls,
    });

    // Execute each tool call
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }

      // ── search_products ─────────────────────────────────────────────────
      if (call.function.name === "search_products") {
        const query = String(args["query"] ?? "");
        const limit = typeof args["limit"] === "number" ? args["limit"] : 6;
        const found = await searchProductsTool(query, limit);
        found.forEach((p) => {
          if (!suggestedIds.includes(p.id)) suggestedIds.push(p.id);
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(
            found.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              category: p.category,
              rating: p.rating,
              stock: p.stock,
              description: p.description?.slice(0, 120),
            })),
          ),
        });

      // ── get_all_products ─────────────────────────────────────────────────
      } else if (call.function.name === "get_all_products") {
        const category = typeof args["category"] === "string" ? args["category"] : undefined;
        const limit = typeof args["limit"] === "number" ? args["limit"] : 12;
        const found = await getAllProductsTool(category, limit);
        found.forEach((p) => {
          if (!suggestedIds.includes(p.id)) suggestedIds.push(p.id);
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(
            found.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              category: p.category,
              rating: p.rating,
              stock: p.stock,
            })),
          ),
        });

      // ── add_to_cart ──────────────────────────────────────────────────────
      } else if (call.function.name === "add_to_cart") {
        const productId = Number(args["productId"]);
        const quantity = Math.max(1, Number(args["quantity"] ?? 1));
        const [p] = await db
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, productId));
        if (!p) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "product not found" }),
          });
        } else {
          const [existing] = await db
            .select()
            .from(cartItemsTable)
            .where(
              and(
                eq(cartItemsTable.sessionId, sessionId),
                eq(cartItemsTable.productId, productId),
              ),
            );
          if (existing) {
            await db
              .update(cartItemsTable)
              .set({ quantity: existing.quantity + quantity })
              .where(
                and(
                  eq(cartItemsTable.sessionId, sessionId),
                  eq(cartItemsTable.productId, productId),
                ),
              );
          } else {
            await db.insert(cartItemsTable).values({ sessionId, productId, quantity });
          }
          addedProductIds.push(productId);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ added: { id: p.id, name: p.name, quantity } }),
          });
        }

      // ── place_order ──────────────────────────────────────────────────────
      } else if (call.function.name === "place_order") {
        if (!confirmOrder) {
          needsConfirmation = true;
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              status: "awaiting_confirmation",
              note: "Summarize the cart, ask the shopper to confirm and choose a payment method (stripe / bank_transfer / pay_on_delivery).",
            }),
          });
        } else if (!shippingAddress) {
          needsShippingAddress = true;
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ status: "awaiting_shipping_address" }),
          });
        } else if (paymentMethod === "stripe") {
          // Create a Stripe checkout session; order is placed after payment via /stripe/verify
          if (!process.env.STRIPE_SECRET_KEY) {
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ error: "Stripe is not configured on this server" }),
            });
          } else {
            try {
              const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
              // Recompute cart total fresh at placement time (cart may have changed during tool loop)
              const freshCart = await buildCart(sessionId);
              const freshTotal = freshCart.subtotal;
              if (freshTotal <= 0) {
                messages.push({
                  role: "tool",
                  tool_call_id: call.id,
                  content: JSON.stringify({ error: "Cart is empty or total is zero" }),
                });
                break;
              }
              const host = req.get("host") ?? "localhost";
              const proto = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
              const origin = `${proto}://${host}`;
              const callbackUrl = `${origin}/payment-callback`;
              const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                mode: "payment",
                line_items: [
                  {
                    price_data: {
                      currency: "usd",
                      product_data: { name: "AllMart Order" },
                      unit_amount: Math.round(freshTotal * 100),
                    },
                    quantity: 1,
                  },
                ],
                success_url: `${callbackUrl}?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${callbackUrl}?cancelled=1`,
                // sessionId in metadata lets /stripe/verify bind back to this cart/session
                metadata: { sessionId, shippingAddress },
              });
              stripeCheckoutUrl = session.url!;
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({
                  status: "stripe_session_created",
                  note: "Tell the shopper to click the 'Pay with Card' button below to complete payment on Stripe. The order will be confirmed after payment.",
                }),
              });
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              stripeError = `Could not start card payment: ${errMsg}`;
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify({ error: stripeError }),
              });
            }
          }
        } else if (paymentMethod === "bank_transfer") {
          const result = await placeOrderForSession(sessionId, shippingAddress, "ai");
          if ("error" in result) {
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ error: result.error }),
            });
          } else {
            placedOrderId = result.order.id;
            const [bankSetting] = await db
              .select()
              .from(settingsTable)
              .where(eq(settingsTable.key, "bank_details"));
            bankDetails = bankSetting
              ? (JSON.parse(bankSetting.value) as Record<string, string>)
              : null;
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({
                orderId: result.order.id,
                trackingCode: result.order.trackingCode,
                total: result.order.total,
                paymentMethod: "bank_transfer",
                bankDetails,
                note: "Order placed. Tell the shopper the bank details are displayed below — they should transfer the exact total and reference their tracking code.",
              }),
            });
          }
        } else {
          // pay_on_delivery (or no paymentMethod — default)
          const result = await placeOrderForSession(sessionId, shippingAddress, "ai");
          if ("error" in result) {
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ error: result.error }),
            });
          } else {
            placedOrderId = result.order.id;
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({
                orderId: result.order.id,
                trackingCode: result.order.trackingCode,
                total: result.order.total,
                paymentMethod: "pay_on_delivery",
              }),
            });
          }
        }

      // ── unknown tool ─────────────────────────────────────────────────────
      } else {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ error: "unknown tool" }),
        });
      }
    }
  }

  if (!assistantText) assistantText = "Got it.";

  // Some LLM providers (e.g. GROQ, Nvidia) embed function-call XML in msg.content
  // alongside structured tool_calls. Strip those leaking tags before saving.
  assistantText = assistantText
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, "")
    .replace(/<function\([^)]*\)[\s\S]*?<\/function>/g, "")
    .replace(/<invoke\b[\s\S]*?<\/invoke>/g, "")
    .trim();
  if (!assistantText) assistantText = "Got it.";

  const [assistantRow] = await db
    .insert(chatMessagesTable)
    .values({
      sessionId,
      role: "assistant",
      content: assistantText,
      productSuggestions: suggestedIds,
    })
    .returning();

  // Hydrate suggested products
  const suggestedProducts = suggestedIds.length
    ? (
        await db
          .select()
          .from(productsTable)
          .where(inArray(productsTable.id, suggestedIds))
      ).map(serializeProduct)
    : [];

  // Build addedToCart payload
  const updatedCart = await buildCart(sessionId);
  const addedToCart = updatedCart.items.filter((ci) =>
    addedProductIds.includes(ci.productId),
  );

  let placedOrder: ReturnType<typeof import("../lib/serializers").serializeOrder> | undefined;
  if (placedOrderId) {
    const [o] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, placedOrderId));
    if (o) {
      const { serializeOrder } = await import("../lib/serializers");
      placedOrder = serializeOrder(o);
    }
  }

  res.json({
    userMessage: {
      id: userRow!.id,
      role: "user",
      content: userRow!.content,
      createdAt: userRow!.createdAt.toISOString(),
      productSuggestions: [],
    },
    assistantMessage: {
      id: assistantRow!.id,
      role: "assistant",
      content: assistantRow!.content,
      createdAt: assistantRow!.createdAt.toISOString(),
      productSuggestions: suggestedProducts,
    },
    suggestedProducts,
    addedToCart,
    placedOrder,
    needsConfirmation,
    needsShippingAddress,
    stripeCheckoutUrl,
    stripeError,
    bankDetails,
    // Provider info — which LLM generated this response
    provider: usedProvider ? serializeProvider(usedProvider) : null,
  });
});

export default router;
