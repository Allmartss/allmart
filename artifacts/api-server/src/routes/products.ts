import { Router, type IRouter, type Request, type Response } from "express";
import { db, productsTable } from "@workspace/db";
import { and, eq, ilike, or, sql, desc, ne } from "drizzle-orm";
import { CreateProductBody } from "@workspace/api-zod";
import { serializeProduct } from "../lib/serializers";
import { requireRole } from "../lib/auth";
import { isSafeMediaUrl } from "../lib/url-validation";

const router: IRouter = Router();

router.post("/products", requireRole("admin", "pm"), async (req: Request, res: Response) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  if (!isSafeMediaUrl(d.imageUrl)) {
    res.status(400).json({ error: "Product image must be uploaded through the store" });
    return;
  }
  const body = req.body as { originalPrice?: number; rating?: number };
  const [created] = await db
    .insert(productsTable)
    .values({
      name: d.name,
      description: d.description,
      category: d.category.toLowerCase(),
      price: d.price,
      originalPrice: body.originalPrice ?? null,
      currency: d.currency ?? "USD",
      imageUrl: d.imageUrl,
      stock: d.stock,
      sellerName: d.sellerName,
      rating: body.rating ?? 4.5,
      tags: d.tags ?? [],
    })
    .returning();
  res.status(201).json(serializeProduct(created!));
});

router.get("/products", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const freeShipping = req.query.freeShipping === "true" ? true : undefined;

  const filters = [ne(productsTable.hidden, true)] as ReturnType<typeof eq>[];
  if (category) filters.push(eq(productsTable.category, category));
  if (freeShipping) filters.push(eq(productsTable.freeShipping, true));
  if (q) {
    const like = `%${q}%`;
    filters.push(
      // @ts-expect-error or returns SQL
      or(
        ilike(productsTable.name, like),
        ilike(productsTable.description, like),
        ilike(productsTable.category, like),
      ),
    );
  }

  const rows = await db
    .select()
    .from(productsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(productsTable.rating));

  res.json(rows.map(serializeProduct));
});

router.get("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.select().from(productsTable).where(and(eq(productsTable.id, id), ne(productsTable.hidden, true)));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeProduct(row));
});

router.get("/categories", async (_req, res) => {
  const rows = await db
    .select({
      slug: productsTable.category,
      productCount: sql<number>`count(*)::int`,
    })
    .from(productsTable)
    .groupBy(productsTable.category)
    .orderBy(desc(sql`count(*)`));

  res.json(
    rows.map((r) => ({
      slug: r.slug,
      name: r.slug.charAt(0).toUpperCase() + r.slug.slice(1),
      productCount: r.productCount,
    })),
  );
});

router.get("/storefront/summary", async (_req, res) => {
  const featured = await db
    .select()
    .from(productsTable)
    .orderBy(desc(productsTable.rating))
    .limit(8);

  const cats = await db
    .select({
      slug: productsTable.category,
      productCount: sql<number>`count(*)::int`,
    })
    .from(productsTable)
    .groupBy(productsTable.category)
    .orderBy(desc(sql`count(*)`))
    .limit(6);

  res.json({
    featured: featured.map(serializeProduct),
    topCategories: cats.map((r) => ({
      slug: r.slug,
      name: r.slug.charAt(0).toUpperCase() + r.slug.slice(1),
      productCount: r.productCount,
    })),
    trendingSearches: [
      "black running shoes",
      "wireless headphones",
      "minimalist desk lamp",
      "ceramic coffee mug",
      "leather wallet",
      "linen shirt",
    ],
  });
});

export default router;
