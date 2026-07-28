import { Router, type IRouter, type Request, type Response } from "express";
import { db, landingPagesTable, productsTable } from "@workspace/db";
import { eq, inArray, desc } from "drizzle-orm";
import { requireRole } from "../lib/auth";
import { serializeProduct } from "../lib/serializers";

const router: IRouter = Router();

router.get("/admin/landing-pages", requireRole("admin"), async (_req: Request, res: Response) => {
  const rows = await db.select().from(landingPagesTable).orderBy(desc(landingPagesTable.createdAt));
  res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/admin/landing-pages", requireRole("admin"), async (req: Request, res: Response) => {
  const { slug, title, description, productIds } = req.body as {
    slug?: string; title?: string; description?: string; productIds?: number[];
  };
  if (!slug || !title || !productIds) {
    res.status(400).json({ error: "slug, title and productIds required" });
    return;
  }
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  try {
    const [row] = await db.insert(landingPagesTable).values({
      slug: cleanSlug, title: title.trim(),
      description: (description ?? "").trim(),
      productIds: productIds as number[],
    }).returning();
    res.status(201).json({ ...row!, createdAt: row!.createdAt.toISOString() });
  } catch {
    res.status(400).json({ error: "Slug already exists" });
  }
});

router.patch("/admin/landing-pages/:id", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { slug, title, description, productIds } = req.body as {
    slug?: string; title?: string; description?: string; productIds?: number[];
  };
  if (!slug && !title && !description && !productIds) {
    res.status(400).json({ error: "Nothing to update" }); return;
  }
  const updates: Record<string, unknown> = {};
  if (slug) updates.slug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (title) updates.title = title.trim();
  if (description !== undefined) updates.description = description.trim();
  if (productIds) updates.productIds = productIds;
  try {
    const [row] = await db.update(landingPagesTable).set(updates).where(eq(landingPagesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch {
    res.status(400).json({ error: "Slug already exists" });
  }
});

router.delete("/admin/landing-pages/:id", requireRole("admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(landingPagesTable).where(eq(landingPagesTable.id, id));
  res.status(204).end();
});

/** Public: list all landing pages (basic info only, no products). Used for the carousel. */
router.get("/landing-pages", async (_req: Request, res: Response) => {
  const rows = await db.select().from(landingPagesTable).orderBy(desc(landingPagesTable.createdAt));
  res.json(rows.map(r => ({
    id: r.id, slug: r.slug, title: r.title, description: r.description,
    productCount: (r.productIds as number[]).length,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.get("/landing-pages/:slug", async (req: Request, res: Response) => {
  const slug = String(req.params.slug ?? "");
  const [page] = await db.select().from(landingPagesTable)
    .where(eq(landingPagesTable.slug, slug));
  if (!page) { res.status(404).json({ error: "Not found" }); return; }
  const ids = page.productIds as number[];
  const prods = ids.length > 0
    ? await db.select().from(productsTable).where(inArray(productsTable.id, ids))
    : [];
  const orderedProds = ids.map(id => prods.find(p => p.id === id)).filter(Boolean);
  res.json({
    id: page.id, slug: page.slug, title: page.title, description: page.description,
    products: orderedProds.map(p => serializeProduct(p!)),
    createdAt: page.createdAt.toISOString(),
  });
});

export default router;
