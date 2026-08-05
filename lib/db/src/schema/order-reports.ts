import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const orderReportsTable = pgTable("order_reports", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  userId: integer("user_id"),
  orderTrackingCode: text("order_tracking_code").notNull(),
  reason: text("reason").notNull(),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("reviewing"), // reviewing | reviewed | resolved
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrderReport = typeof orderReportsTable.$inferSelect;
