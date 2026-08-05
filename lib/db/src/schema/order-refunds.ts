import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const orderRefundsTable = pgTable("order_refunds", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  userId: integer("user_id"),
  orderTrackingCode: text("order_tracking_code").notNull(),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"), // proof image
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export type OrderRefund = typeof orderRefundsTable.$inferSelect;
