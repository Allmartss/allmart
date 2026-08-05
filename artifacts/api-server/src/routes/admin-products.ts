import { Router, type IRouter, type Request, type Response } from "express";
import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth";
import { serializeProduct } from "../lib/serializers";
import { chatCompletion } from "../lib/llm";
import { isSafeMediaUrl } from "../lib/url-validation";

const router: IRouter = Router();

router.get("/admin/products", requireRole("admin", "pm"), async (_req: Request, res: Response) => {
  const rows = await db.select().from(productsTable).orderBy(productsTable.id);
  res.json(rows.map(serializeProduct));
});

router.patch("/admin/products/:id", requireRole("admin", "pm"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const {
    name, description, detailNote, category, price, originalPrice, shippingFee, stock,
    imageUrl, images, colors, productType, tags, rating, freeShipping, hidden,
  } = req.body as {
    name?: string; description?: string; detailNote?: string; category?: string;
    price?: number; originalPrice?: number | null; shippingFee?: number | null; stock?: number; imageUrl?: string;
    images?: string[]; colors?: string[]; productType?: string; tags?: string[];
    rating?: number; freeShipping?: boolean; hidden?: boolean;
  };
  if (imageUrl !== undefined && !isSafeMediaUrl(imageUrl)) {
    res.status(400).json({ error: "Product image must be uploaded through the store" });
    return;
  }
  if (images !== undefined && (!Array.isArray(images) || images.some((url) => !isSafeMediaUrl(url)))) {
    res.status(400).json({ error: "All product images must be uploaded through the store" });
    return;
  }

  const [updated] = await db
    .update(productsTable)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(detailNote !== undefined && { detailNote }),
      ...(category !== undefined && { category }),
      ...(price !== undefined && { price }),
      ...(originalPrice !== undefined && { originalPrice: originalPrice ?? null }),
      ...(shippingFee !== undefined && { shippingFee: shippingFee ?? null }),
      ...(stock !== undefined && { stock }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(images !== undefined && { images }),
      ...(colors !== undefined && { colors }),
      ...(productType !== undefined && { productType }),
      ...(tags !== undefined && { tags }),
      ...(rating !== undefined && { rating }),
      ...(freeShipping !== undefined && { freeShipping }),
      ...(hidden !== undefined && { hidden }),
    })
    .where(eq(productsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeProduct(updated));
});

router.delete("/admin/products/:id", requireRole("admin", "pm"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.status(204).end();
});

/**
 * POST /admin/ai/generate-description
 * Generate a product description using the configured LLM provider.
 * Body: { name: string; category?: string; lines?: number }
 */
router.post("/admin/ai/generate-description", requireRole("admin", "pm"), async (req: Request, res: Response) => {
  const { name, category = "general", lines = 3 } = req.body as {
    name?: string;
    category?: string;
    lines?: number;
  };

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const lineCount = Math.min(Math.max(Number(lines) || 3, 1), 20);

  try {
    const { completion } = await chatCompletion(
      [
        {
          role: "user",
          content:
            `Write a compelling product description for an e-commerce store listing.\n` +
            `Product name: "${name.trim()}"\n` +
            `Category: "${category.trim() || "general"}"\n` +
            `Write exactly ${lineCount} sentences. Be specific, engaging, and highlight key benefits and features. ` +
            `Write in plain prose — no bullet points, no headings, no markdown. Just flowing sentences.`,
        },
      ],
      [], // no tools needed
    );

    const description = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ description });
  } catch (err) {
    req.log.error({ err }, "AI description generation failed");
    res.status(503).json({ error: "AI unavailable — make sure an API key is configured." });
  }
});

export default router;
