import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export type EmailBlock =
  | { type: "header"; text: string; size: "h1" | "h2" | "h3"; align: "left" | "center" | "right"; color: string }
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt: string; link?: string }
  | { type: "button"; text: string; url: string; bgColor: string; align: "left" | "center" | "right" }
  | { type: "divider" }
  | { type: "product"; productId: number; name: string; price: number; imageUrl: string };

export const emailCampaignsTable = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  blocks: jsonb("blocks").$type<EmailBlock[]>().notNull().default([]),
  status: text("status").notNull().default("draft"), // "draft" | "sent"
  recipientType: text("recipient_type").notNull().default("all"), // "all" | "selected"
  recipientIds: jsonb("recipient_ids").$type<number[]>().notNull().default([]),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
