import { Router, type IRouter, type Request, type Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth";
import { isSafeMediaUrl, isSafeHttpUrl } from "../lib/url-validation";

const router: IRouter = Router();

const KEYS = { 1: "popup_ad", 2: "popup_ad_2" } as const;

export type PopupAd = {
  enabled: boolean;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  bgColor: string;
  // Slot-1 only: display type
  popType: "pop" | "slide";
  slideDirection: "left" | "right" | "bottom";
  // Timing
  displayDelay: number; // seconds before the popup appears (0 = immediate)
  autoClose: number;   // seconds before auto-closing (0 = never)
};

const DEFAULT_POPUP: PopupAd = {
  enabled: false,
  title: "",
  body: "",
  ctaText: "Shop Now",
  ctaUrl: "/products",
  imageUrl: "",
  bgColor: "#7c3aed",
  popType: "pop",
  slideDirection: "bottom",
  displayDelay: 2,
  autoClose: 0,
};

async function getPopup(slot: 1 | 2): Promise<PopupAd> {
  const key = KEYS[slot];
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) return { ...DEFAULT_POPUP };
  try { return { ...DEFAULT_POPUP, ...JSON.parse(row.value) }; } catch { return { ...DEFAULT_POPUP }; }
}

async function savePopup(slot: 1 | 2, data: PopupAd) {
  const key = KEYS[slot];
  const value = JSON.stringify(data);
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

// ── Public ─────────────────────────────────────────────────────────────────────
// Returns both popups if enabled (with full config for the modal to render)
router.get("/popup-ad", async (_req: Request, res: Response) => {
  const [p1, p2] = await Promise.all([getPopup(1), getPopup(2)]);
  res.json({
    popup1: p1.enabled && p1.title ? p1 : null,
    popup2: p2.enabled && p2.title ? p2 : null,
  });
});

// ── Admin: read ────────────────────────────────────────────────────────────────
router.get("/admin/popup-ad", requireRole("admin"), async (_req: Request, res: Response) => {
  const [p1, p2] = await Promise.all([getPopup(1), getPopup(2)]);
  res.json({ popup1: p1, popup2: p2 });
});

// ── Admin: save slot ───────────────────────────────────────────────────────────
router.post("/admin/popup-ad/:slot", requireRole("admin"), async (req: Request, res: Response) => {
  const slot = Number(req.params.slot) as 1 | 2;
  if (slot !== 1 && slot !== 2) { res.status(400).json({ error: "Invalid slot (1 or 2)" }); return; }

  const current = await getPopup(slot);
  const body = req.body as Partial<PopupAd>;
  const updated: PopupAd = {
    enabled: body.enabled ?? current.enabled,
    title: body.title ?? current.title,
    body: body.body ?? current.body,
    ctaText: body.ctaText ?? current.ctaText,
    ctaUrl: body.ctaUrl ?? current.ctaUrl,
    imageUrl: body.imageUrl ?? current.imageUrl,
    bgColor: body.bgColor ?? current.bgColor,
    popType: body.popType ?? current.popType,
    slideDirection: body.slideDirection ?? current.slideDirection,
    displayDelay: body.displayDelay ?? current.displayDelay,
    autoClose: body.autoClose ?? current.autoClose,
  };
  if (updated.imageUrl && !isSafeMediaUrl(updated.imageUrl)) {
    res.status(400).json({ error: "Popup image must be uploaded through the store" });
    return;
  }
  if (updated.ctaUrl && !updated.ctaUrl.startsWith("/") && !isSafeHttpUrl(updated.ctaUrl)) {
    res.status(400).json({ error: "CTA URL must be a safe HTTPS URL or local path" });
    return;
  }
  await savePopup(slot, updated);
  res.json(updated);
});

// ── Legacy: keep old POST /admin/popup-ad working (maps to slot 1) ────────────
router.post("/admin/popup-ad", requireRole("admin"), async (req: Request, res: Response) => {
  const current = await getPopup(1);
  const body = req.body as Partial<PopupAd>;
  const updated: PopupAd = { ...current, ...body };
  if (updated.imageUrl && !isSafeMediaUrl(updated.imageUrl)) {
    res.status(400).json({ error: "Popup image must be uploaded through the store" });
    return;
  }
  if (updated.ctaUrl && !updated.ctaUrl.startsWith("/") && !isSafeHttpUrl(updated.ctaUrl)) {
    res.status(400).json({ error: "CTA URL must be a safe HTTPS URL or local path" });
    return;
  }
  await savePopup(1, updated);
  res.json(updated);
});

export default router;
