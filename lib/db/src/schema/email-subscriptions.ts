import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const emailSubscriptionsTable = pgTable("email_subscriptions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
});

export type EmailSubscription = typeof emailSubscriptionsTable.$inferSelect;
