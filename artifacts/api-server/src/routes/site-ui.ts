import { Router, type IRouter, type Request, type Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireRole } from "../lib/auth";

const router: IRouter = Router();

// ── Storage keys ──────────────────────────────────────────────────────────────
const KEY_HEADER = "site_ui_header";
const KEY_FOOTER = "site_ui_footer";
const KEY_THEMES = "site_ui_themes";
const KEY_ACTIVE_THEME = "site_ui_active_theme";

// ── Types ────────────────────────────────────────────────────────────────────
export type NavLink = { label: string; href: string };

export type HeaderConfig = {
  siteName: string;
  tagline: string;
  sticky: boolean;
  showSearch: boolean;
  navLinks: NavLink[];
};

export type FooterConfig = {
  tagline: string;
  copyrightText: string;
  showNewsletter: boolean;
  columns: { title: string; links: NavLink[] }[];
  socialLinks: { platform: string; url: string }[];
};

export type ThemeColorSet = {
  primary: string;       // hex e.g. "#7c3aed"
  background: string;    // hex
  foreground: string;    // hex
  accent: string;        // hex
  muted: string;         // hex
  border: string;        // hex
};

export type SiteTheme = {
  id: string;
  name: string;
  radius: string;        // e.g. "0.5rem"
  light: ThemeColorSet;
  dark: ThemeColorSet;
};

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_HEADER: HeaderConfig = {
  siteName: "AllMart",
  tagline: "Shop smarter, live better",
  sticky: true,
  showSearch: true,
  navLinks: [
    { label: "All Products", href: "/products" },
    { label: "Featured", href: "/products?sort=featured" },
    { label: "New Arrivals", href: "/products?sort=new" },
    { label: "Sale", href: "/products?sort=sale" },
  ],
};

const DEFAULT_FOOTER: FooterConfig = {
  tagline: "Shop smarter, live better.",
  copyrightText: `© ${new Date().getFullYear()} AllMart. All rights reserved.`,
  showNewsletter: true,
  columns: [
    {
      title: "Shop",
      links: [
        { label: "All Products", href: "/products" },
        { label: "Featured", href: "/products?sort=featured" },
        { label: "New Arrivals", href: "/products?sort=new" },
        { label: "Sale", href: "/products?sort=sale" },
      ],
    },
    {
      title: "Account",
      links: [
        { label: "Sign In", href: "/account" },
        { label: "My Orders", href: "/orders" },
        { label: "Support", href: "/support" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Terms of Service", href: "/terms" },
        { label: "Privacy Policy", href: "/privacy" },
      ],
    },
  ],
  socialLinks: [],
};

const DEFAULT_THEMES: SiteTheme[] = [
  {
    id: "purple-default",
    name: "Purple (Default)",
    radius: "1rem",
    light: {
      primary: "#6d28d9",
      background: "#ffffff",
      foreground: "#1a0a2e",
      accent: "#ede9fe",
      muted: "#f3f0fb",
      border: "#ddd6fe",
    },
    dark: {
      primary: "#a78bfa",
      background: "#130a2e",
      foreground: "#f8fafc",
      accent: "#3b1f6e",
      muted: "#231552",
      border: "#3b2370",
    },
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    radius: "0.75rem",
    light: {
      primary: "#2563eb",
      background: "#ffffff",
      foreground: "#0f172a",
      accent: "#dbeafe",
      muted: "#f0f5ff",
      border: "#bfdbfe",
    },
    dark: {
      primary: "#60a5fa",
      background: "#0f1729",
      foreground: "#f1f5f9",
      accent: "#1e3a6e",
      muted: "#172040",
      border: "#1e3a6e",
    },
  },
  {
    id: "emerald-fresh",
    name: "Emerald Fresh",
    radius: "0.5rem",
    light: {
      primary: "#059669",
      background: "#ffffff",
      foreground: "#052e16",
      accent: "#d1fae5",
      muted: "#f0fdf4",
      border: "#a7f3d0",
    },
    dark: {
      primary: "#34d399",
      background: "#042f1a",
      foreground: "#f0fdf4",
      accent: "#064e2e",
      muted: "#053d24",
      border: "#065f3a",
    },
  },
  {
    id: "rose-warm",
    name: "Rose Warm",
    radius: "1.5rem",
    light: {
      primary: "#e11d48",
      background: "#ffffff",
      foreground: "#1c0a10",
      accent: "#ffe4e6",
      muted: "#fff0f1",
      border: "#fecdd3",
    },
    dark: {
      primary: "#fb7185",
      background: "#1c0a10",
      foreground: "#fdf2f4",
      accent: "#5e1a27",
      muted: "#3b0f1a",
      border: "#6b2030",
    },
  },
];

// ── DB helpers ────────────────────────────────────────────────────────────────
async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) return fallback;
  try { return { ...fallback as object, ...JSON.parse(row.value) } as T; } catch { return fallback; }
}

async function getSettingRaw<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}

async function saveSetting(key: string, value: unknown) {
  const json = JSON.stringify(value);
  await db
    .insert(settingsTable)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: json, updatedAt: new Date() } });
}

// ── Public: full site config ───────────────────────────────────────────────
router.get("/site-ui", async (_req: Request, res: Response) => {
  const [header, footer, themes, activeThemeId] = await Promise.all([
    getSetting<HeaderConfig>(KEY_HEADER, DEFAULT_HEADER),
    getSetting<FooterConfig>(KEY_FOOTER, DEFAULT_FOOTER),
    getSettingRaw<SiteTheme[]>(KEY_THEMES, DEFAULT_THEMES),
    getSettingRaw<string | null>(KEY_ACTIVE_THEME, null),
  ]);

  const allThemes = themes.length ? themes : DEFAULT_THEMES;
  const activeTheme = allThemes.find((t) => t.id === activeThemeId) ?? null;

  res.json({ header, footer, themes: allThemes, activeTheme, activeThemeId });
});

// ── Admin: full config ─────────────────────────────────────────────────────
router.get("/admin/site-ui", requireRole("admin"), async (_req: Request, res: Response) => {
  const [header, footer, themes, activeThemeId] = await Promise.all([
    getSetting<HeaderConfig>(KEY_HEADER, DEFAULT_HEADER),
    getSetting<FooterConfig>(KEY_FOOTER, DEFAULT_FOOTER),
    getSettingRaw<SiteTheme[]>(KEY_THEMES, DEFAULT_THEMES),
    getSettingRaw<string | null>(KEY_ACTIVE_THEME, null),
  ]);

  const allThemes = themes.length ? themes : DEFAULT_THEMES;
  const activeTheme = allThemes.find((t) => t.id === activeThemeId) ?? null;

  // Prevent 304 / empty-body responses — admin data must always be fresh
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.json({ header, footer, themes: allThemes, activeTheme, activeThemeId });
});

// ── Admin: save header ─────────────────────────────────────────────────────
router.post("/admin/site-ui/header", requireRole("admin"), async (req: Request, res: Response) => {
  const current = await getSetting<HeaderConfig>(KEY_HEADER, DEFAULT_HEADER);
  const body = req.body as Partial<HeaderConfig>;
  const updated: HeaderConfig = {
    siteName: body.siteName ?? current.siteName,
    tagline: body.tagline ?? current.tagline,
    sticky: body.sticky ?? current.sticky,
    showSearch: body.showSearch ?? current.showSearch,
    navLinks: body.navLinks ?? current.navLinks,
  };
  await saveSetting(KEY_HEADER, updated);
  res.json({ ok: true, header: updated });
});

// ── Admin: save footer ─────────────────────────────────────────────────────
router.post("/admin/site-ui/footer", requireRole("admin"), async (req: Request, res: Response) => {
  const current = await getSetting<FooterConfig>(KEY_FOOTER, DEFAULT_FOOTER);
  const body = req.body as Partial<FooterConfig>;
  const updated: FooterConfig = {
    tagline: body.tagline ?? current.tagline,
    copyrightText: body.copyrightText ?? current.copyrightText,
    showNewsletter: body.showNewsletter ?? current.showNewsletter,
    columns: body.columns ?? current.columns,
    socialLinks: body.socialLinks ?? current.socialLinks,
  };
  await saveSetting(KEY_FOOTER, updated);
  res.json({ ok: true, footer: updated });
});

// ── Admin: list themes ─────────────────────────────────────────────────────
router.get("/admin/site-ui/themes", requireRole("admin"), async (_req: Request, res: Response) => {
  const themes = await getSettingRaw<SiteTheme[]>(KEY_THEMES, DEFAULT_THEMES);
  const activeThemeId = await getSettingRaw<string | null>(KEY_ACTIVE_THEME, null);
  res.json({ themes: themes.length ? themes : DEFAULT_THEMES, activeThemeId });
});

// ── Admin: save (create/update) a theme ───────────────────────────────────
router.post("/admin/site-ui/themes", requireRole("admin"), async (req: Request, res: Response) => {
  const themes = await getSettingRaw<SiteTheme[]>(KEY_THEMES, DEFAULT_THEMES);
  const all = themes.length ? themes : [...DEFAULT_THEMES];
  const body = req.body as SiteTheme;

  if (!body.id || !body.name) {
    res.status(400).json({ error: "id and name are required" });
    return;
  }

  const idx = all.findIndex((t) => t.id === body.id);
  if (idx >= 0) {
    all[idx] = body;
  } else {
    all.push(body);
  }

  await saveSetting(KEY_THEMES, all);
  res.json({ ok: true, theme: body, themes: all });
});

// ── Admin: delete a theme ──────────────────────────────────────────────────
router.delete("/admin/site-ui/themes/:id", requireRole("admin"), async (req: Request, res: Response) => {
  const { id } = req.params;
  const themes = await getSettingRaw<SiteTheme[]>(KEY_THEMES, DEFAULT_THEMES);
  const all = themes.length ? themes : [...DEFAULT_THEMES];
  const filtered = all.filter((t) => t.id !== id);

  if (filtered.length === all.length) {
    res.status(404).json({ error: "Theme not found" });
    return;
  }

  await saveSetting(KEY_THEMES, filtered);

  // Deactivate if the deleted theme was active
  const activeThemeId = await getSettingRaw<string | null>(KEY_ACTIVE_THEME, null);
  if (activeThemeId === id) {
    await saveSetting(KEY_ACTIVE_THEME, null);
  }

  res.json({ ok: true, themes: filtered });
});

// ── Admin: activate a theme ────────────────────────────────────────────────
router.post("/admin/site-ui/themes/:id/activate", requireRole("admin"), async (req: Request, res: Response) => {
  const { id } = req.params;
  const themes = await getSettingRaw<SiteTheme[]>(KEY_THEMES, DEFAULT_THEMES);
  const all = themes.length ? themes : DEFAULT_THEMES;
  const theme = all.find((t) => t.id === id);

  if (!theme) {
    res.status(404).json({ error: "Theme not found" });
    return;
  }

  await saveSetting(KEY_ACTIVE_THEME, id);
  res.json({ ok: true, activeThemeId: id, theme });
});

// ── Admin: deactivate (reset to default) ─────────────────────────────────
router.post("/admin/site-ui/themes/deactivate", requireRole("admin"), async (_req: Request, res: Response) => {
  await saveSetting(KEY_ACTIVE_THEME, null);
  res.json({ ok: true, activeThemeId: null });
});

export default router;
