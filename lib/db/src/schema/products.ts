import { pgTable, serial, text, integer, real, jsonb, boolean } from "drizzle-orm/pg-core";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  detailNote: text("detail_note").notNull().default(""),
  category: text("category").notNull(),
  price: real("price").notNull(),
  originalPrice: real("original_price"),
  shippingFee: real("shipping_fee"),
  currency: text("currency").notNull().default("USD"),
  imageUrl: text("image_url").notNull(),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  colors: jsonb("colors").$type<string[]>().notNull().default([]),
  productType: text("product_type").notNull().default(""),
  rating: real("rating").notNull().default(4.5),
  stock: integer("stock").notNull().default(50),
  sellerName: text("seller_name").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  freeShipping: boolean("free_shipping").notNull().default(false),
  hidden: boolean("hidden").notNull().default(false),
});

export type Product = typeof productsTable.$inferSelect;
