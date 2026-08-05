import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const orderRatingsTable = pgTable("order_ratings", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().unique(), // one rating per order
  userId: integer("user_id"),
  orderTrackingCode: text("order_tracking_code").notNull(),
  rating: integer("rating").notNull(), // 1–5
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrderRating = typeof orderRatingsTable.$inferSelect;
