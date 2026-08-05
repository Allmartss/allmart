import { pgTable, serial, text, real, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export type OrderItemJson = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string;
};

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id"),
  status: text("status").notNull().default("placed"),
  total: real("total").notNull(),
  currency: text("currency").notNull().default("NGN"),
  trackingCode: text("tracking_code").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  receiverName: text("receiver_name"),
  receiverEmail: text("receiver_email"),
  receiverPhone: text("receiver_phone"),
  shippingFee: real("shipping_fee").notNull().default(0),
  cashbackCode: text("cashback_code"),
  cashbackDiscount: real("cashback_discount"),
  placedBy: text("placed_by").notNull().default("user"),
  items: jsonb("items").$type<OrderItemJson[]>().notNull(),
  paymentMethod: text("payment_method"),
  paymentScreenshotUrl: text("payment_screenshot_url"),
  paymentNote: text("payment_note"),
  paymentVerified: text("payment_verified").notNull().default("pending"),
  stripeSessionId: text("stripe_session_id").unique(),
  bonusDiscount: real("bonus_discount"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;
