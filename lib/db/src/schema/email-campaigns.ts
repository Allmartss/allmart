import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export type ProductItem = { productId: number; name: string; price: number; imageUrl: string };

export type EmailBlock =
  | { type: "header"; text: string; size: "h1" | "h2" | "h3"; align: "left" | "center" | "right"; color: string }
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt: string; link?: string }
  | { type: "button"; text: string; url: string; bgColor: string; align: "left" | "center" | "right" }
  | { type: "divider" }
  // Multi-product block (new) — products array; old single-product fields kept for backward compat
  | { type: "product"; products: ProductItem[]; productId?: number; name?: string; price?: number; imageUrl?: string };

export type CampaignFooter = {
  message: string;
  address: string;
  social: {
    instagram: string;
    twitter: string;
    facebook: string;
    tiktok: string;
    youtube: string;
    linkedin: string;
    whatsapp: string;
  };
  links: { label: string; url: string }[];
  bgColor: string;
  textColor: string;
};

export const DEFAULT_FOOTER: CampaignFooter = {
  message: "You received this because you have an account at AllMart.",
  address: "",
  social: { instagram: "", twitter: "", facebook: "", tiktok: "", youtube: "", linkedin: "", whatsapp: "" },
  links: [],
  bgColor: "#f9fafb",
  textColor: "#9ca3af",
};

export const emailCampaignsTable = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  headerLogoUrl: text("header_logo_url").notNull().default(""),
  blocks: jsonb("blocks").$type<EmailBlock[]>().notNull().default([]),
  footer: jsonb("footer").$type<CampaignFooter>().notNull().default(DEFAULT_FOOTER),
  status: text("status").notNull().default("draft"), // "draft" | "sent"
  recipientType: text("recipient_type").notNull().default("all"), // "all" | "selected"
  recipientIds: jsonb("recipient_ids").$type<number[]>().notNull().default([]),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
