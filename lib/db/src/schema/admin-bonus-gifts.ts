import { pgTable, serial, integer, real, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const adminBonusGiftsTable = pgTable("admin_bonus_gifts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: real("amount").notNull(),
  reason: text("reason"),
  claimed: boolean("claimed").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminBonusGift = typeof adminBonusGiftsTable.$inferSelect;
