import { pgTable, serial, text, integer, timestamp, boolean, real } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("buyer"),
  tier: integer("tier").notNull().default(0),
  country: text("country"),
  phone: text("phone"),
  sex: text("sex"),
  address: text("address"),
  profileComplete: boolean("profile_complete").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationCode: text("email_verification_code"),
  emailVerificationExpiry: timestamp("email_verification_expiry", { withTimezone: true }),
  referralCode: text("referral_code").unique(),
  bonusBalance: real("bonus_balance").notNull().default(0),
  pendingAdminBonus: real("pending_admin_bonus").notNull().default(0),
  banned: boolean("banned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = typeof usersTable.$inferSelect;
