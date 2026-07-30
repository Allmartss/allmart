import { Router, type IRouter, type Request, type Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth";

const router: IRouter = Router();
const POPUP_KEY = "popup_ad";

type PopupAd = {
  enabled: boolean;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  bgColor: string;
};

const DEFAULT_POPUP: PopupAd = {
  enabled: false,
  title: "",
  body: "",
  ctaText: "Shop Now",
  ctaUrl: "/products",
  imageUrl: "",
  bgColor: "#7c3aed",
};

async function getPopup(): Promise<PopupAd> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, POPUP_KEY));
  if (!row) return DEFAULT_POPUP;
  try { return { ...DEFAULT_POPUP, ...JSON.parse(row.value) }; } catch { return DEFAULT_POPUP; }
}

// Public — storefront fetches this to decide whether to show the popup
router.get("/popup-ad", async (_req: Request, res: Response) => {
  const popup = await getPopup();
  res.json(popup.enabled ? popup : { enabled: false });
});

// Admin — full config read
router.get("/admin/popup-ad", requireRole("admin"), async (_req: Request, res: Response) => {
  res.json(await getPopup());
});

// Admin — save config
router.post("/admin/popup-ad", requireRole("admin"), async (req: Request, res: Response) => {
  const { enabled, title, body, ctaText, ctaUrl, imageUrl, bgColor } = req.body as Partial<PopupAd>;
  const current = await getPopup();
  const updated: PopupAd = {
    enabled: enabled ?? current.enabled,
    title: title ?? current.title,
    body: body ?? current.body,
    ctaText: ctaText ?? current.ctaText,
    ctaUrl: ctaUrl ?? current.ctaUrl,
    imageUrl: imageUrl ?? current.imageUrl,
    bgColor: bgColor ?? current.bgColor,
  };
  const value = JSON.stringify(updated);
  await db
    .insert(settingsTable)
    .values({ key: POPUP_KEY, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
  res.json(updated);
});

export default router;
