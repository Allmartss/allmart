import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

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
  primary: string;
  background: string;
  foreground: string;
  accent: string;
  muted: string;
  border: string;
};

export type SiteTheme = {
  id: string;
  name: string;
  radius: string;
  light: ThemeColorSet;
  dark: ThemeColorSet;
};

export type SiteConfig = {
  header: HeaderConfig;
  footer: FooterConfig;
  themes: SiteTheme[];
  activeTheme: SiteTheme | null;
  activeThemeId: string | null;
};

/** Converts a hex color string to HSL values string like "262 83% 57%" */
export function hexToHslValues(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Determines if a hex color is "light" (for foreground contrast) */
function isLightColor(hex: string): boolean {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/** Returns "0 0% 100%" for dark primary, "0 0% 0%" for light primary */
function getPrimaryForeground(primaryHex: string): string {
  return isLightColor(primaryHex) ? "0 0% 0%" : "0 0% 100%";
}

function applyTheme(theme: SiteTheme, isDark: boolean) {
  const root = document.documentElement;
  const colors = isDark ? theme.dark : theme.light;

  const vars: Record<string, string> = {
    "--primary": hexToHslValues(colors.primary),
    "--primary-foreground": getPrimaryForeground(colors.primary),
    "--background": hexToHslValues(colors.background),
    "--foreground": hexToHslValues(colors.foreground),
    "--card": hexToHslValues(colors.background),
    "--card-foreground": hexToHslValues(colors.foreground),
    "--popover": hexToHslValues(colors.background),
    "--popover-foreground": hexToHslValues(colors.foreground),
    "--secondary": hexToHslValues(colors.muted),
    "--secondary-foreground": hexToHslValues(colors.foreground),
    "--muted": hexToHslValues(colors.muted),
    "--muted-foreground": hexToHslValues(colors.foreground).split(" ").map((v, i) => {
      if (i === 2) return `${Math.max(30, parseInt(v) - 20)}%`;
      return v;
    }).join(" "),
    "--accent": hexToHslValues(colors.accent),
    "--accent-foreground": hexToHslValues(colors.foreground),
    "--border": hexToHslValues(colors.border),
    "--input": hexToHslValues(colors.border),
    "--ring": hexToHslValues(colors.primary),
    "--sidebar": hexToHslValues(colors.muted),
    "--sidebar-foreground": hexToHslValues(colors.foreground),
    "--sidebar-border": hexToHslValues(colors.border),
    "--sidebar-primary": hexToHslValues(colors.primary),
    "--sidebar-primary-foreground": getPrimaryForeground(colors.primary),
    "--sidebar-accent": hexToHslValues(colors.accent),
    "--sidebar-accent-foreground": hexToHslValues(colors.foreground),
    "--sidebar-ring": hexToHslValues(colors.primary),
    "--chart-1": hexToHslValues(colors.primary),
    "--radius": theme.radius,
  };

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

function clearTheme() {
  const vars = [
    "--primary", "--primary-foreground", "--background", "--foreground",
    "--card", "--card-foreground", "--popover", "--popover-foreground",
    "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
    "--accent", "--accent-foreground", "--border", "--input", "--ring",
    "--sidebar", "--sidebar-foreground", "--sidebar-border", "--sidebar-primary",
    "--sidebar-primary-foreground", "--sidebar-accent", "--sidebar-accent-foreground",
    "--sidebar-ring", "--chart-1", "--radius",
  ];
  const root = document.documentElement;
  for (const v of vars) root.style.removeProperty(v);
}

export function useSiteConfig() {
  return useQuery<SiteConfig>({
    queryKey: ["site-config"],
    queryFn: async () => {
      const res = await fetch("/api/site-ui");
      if (!res.ok) throw new Error("Failed to load site config");
      return res.json() as Promise<SiteConfig>;
    },
    staleTime: 1000 * 60 * 5, // 5 min
    gcTime: 1000 * 60 * 10,
  });
}

/** Drop this component into App.tsx — it applies the active theme whenever it changes */
export function SiteThemeApplier() {
  const { data } = useSiteConfig();

  useEffect(() => {
    if (!data?.activeTheme) {
      clearTheme();
      return;
    }

    const isDark = document.documentElement.classList.contains("dark");
    applyTheme(data.activeTheme, isDark);

    // Watch for dark/light mode switches
    const observer = new MutationObserver(() => {
      if (!data?.activeTheme) return;
      const dark = document.documentElement.classList.contains("dark");
      applyTheme(data.activeTheme, dark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [data?.activeTheme]);

  return null;
}
