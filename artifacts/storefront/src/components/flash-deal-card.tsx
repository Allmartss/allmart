import { useState, useEffect } from "react";
import { Link } from "wouter";
import type { Product } from "@workspace/api-client-react";
import { ArrowRight, ShoppingCart } from "lucide-react";

export function discountPctFlash(product: Product): number {
  const orig = (product as any).originalPrice ?? (product as any).compareAtPrice;
  if (!orig || orig <= product.price) return 10 + (product.id % 40);
  return Math.round(100 - (product.price / orig) * 100);
}

// ── Color themes ───────────────────────────────────────────────────────────────
export const FLASH_COLOR_THEMES = [
  {
    id: "amber",
    label: "Amber",
    bg: "linear-gradient(135deg, #1a1506 0%, #2d2208 60%, #3d2f0a 100%)",
    glow: "radial-gradient(ellipse at 80% 50%, rgba(180,130,40,0.18) 0%, transparent 70%)",
    fadeLeft: "#1a1506",
    fadeBottom: "#1a1506",
    badge: "text-amber-200/80",
    countdown: "bg-amber-500/20 border-amber-400/30 text-amber-300",
    colon: "text-amber-400/60",
    btn: "bg-amber-400 hover:bg-amber-300 text-black",
  },
  {
    id: "blue",
    label: "Blue",
    bg: "linear-gradient(135deg, #050d1a 0%, #082240 60%, #0a2e55 100%)",
    glow: "radial-gradient(ellipse at 80% 50%, rgba(40,100,220,0.20) 0%, transparent 70%)",
    fadeLeft: "#050d1a",
    fadeBottom: "#050d1a",
    badge: "text-blue-200/80",
    countdown: "bg-blue-500/20 border-blue-400/30 text-blue-300",
    colon: "text-blue-400/60",
    btn: "bg-blue-500 hover:bg-blue-400 text-white",
  },
  {
    id: "purple",
    label: "Purple",
    bg: "linear-gradient(135deg, #100818 0%, #1e0d38 60%, #2a1250 100%)",
    glow: "radial-gradient(ellipse at 80% 50%, rgba(140,60,220,0.20) 0%, transparent 70%)",
    fadeLeft: "#100818",
    fadeBottom: "#100818",
    badge: "text-purple-200/80",
    countdown: "bg-purple-500/20 border-purple-400/30 text-purple-300",
    colon: "text-purple-400/60",
    btn: "bg-purple-500 hover:bg-purple-400 text-white",
  },
  {
    id: "rose",
    label: "Rose",
    bg: "linear-gradient(135deg, #1a0610 0%, #380d1e 60%, #500a24 100%)",
    glow: "radial-gradient(ellipse at 80% 50%, rgba(220,40,100,0.20) 0%, transparent 70%)",
    fadeLeft: "#1a0610",
    fadeBottom: "#1a0610",
    badge: "text-rose-200/80",
    countdown: "bg-rose-500/20 border-rose-400/30 text-rose-300",
    colon: "text-rose-400/60",
    btn: "bg-rose-500 hover:bg-rose-400 text-white",
  },
  {
    id: "emerald",
    label: "Emerald",
    bg: "linear-gradient(135deg, #041610 0%, #082e1e 60%, #0a3d28 100%)",
    glow: "radial-gradient(ellipse at 80% 50%, rgba(20,180,100,0.18) 0%, transparent 70%)",
    fadeLeft: "#041610",
    fadeBottom: "#041610",
    badge: "text-emerald-200/80",
    countdown: "bg-emerald-500/20 border-emerald-400/30 text-emerald-300",
    colon: "text-emerald-400/60",
    btn: "bg-emerald-500 hover:bg-emerald-400 text-white",
  },
] as const;

export type FlashColorThemeId = (typeof FLASH_COLOR_THEMES)[number]["id"];

function getTheme(id?: string | null) {
  return FLASH_COLOR_THEMES.find(t => t.id === id) ?? FLASH_COLOR_THEMES[0];
}

export function FlashDealCard({
  product,
  countdown,
  colorThemeId,
}: {
  product: Product;
  countdown: { h: string; m: string; s: string };
  colorThemeId?: string | null;
}) {
  const pct = discountPctFlash(product);
  const theme = getTheme(colorThemeId);

  return (
    <Link href={`/products/${product.id}`}>
      <div
        className="relative rounded-2xl overflow-hidden cursor-pointer"
        style={{ background: theme.bg, minHeight: "188px" }}
      >
        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: theme.glow }} />

        {/* Left content */}
        <div className="relative z-10 p-4 pr-40 flex flex-col justify-between h-full min-h-[188px]">
          <div>
            <span className={`inline-block rounded-full bg-white/10 border border-white/15 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider mb-2 ${theme.badge}`}>
              Limited Time Offer
            </span>
            <p className="text-2xl font-black text-white leading-none mb-0.5">
              Up to {pct}% Off
            </p>
            <p className="text-[11px] text-white/50 mb-3">On selected items</p>
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-1 mb-3">
            {[countdown.h, countdown.m, countdown.s].map((unit, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className={`flex h-6 min-w-[26px] items-center justify-center rounded-md border text-[11px] font-bold px-1.5 font-mono ${theme.countdown}`}>
                  {unit}
                </span>
                {i < 2 && <span className={`text-[10px] font-bold ${theme.colon}`}>:</span>}
              </span>
            ))}
          </div>

          <div className={`inline-flex items-center gap-1.5 rounded-full active:scale-95 transition-all px-4 py-1.5 text-[11px] font-bold w-fit ${theme.btn}`}>
            Shop Now <ArrowRight className="h-3 w-3" />
          </div>
        </div>

        {/* Product image */}
        <div className="absolute right-0 top-0 bottom-0 w-36 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 w-10 z-10"
            style={{ background: `linear-gradient(to right, ${theme.fadeLeft}, transparent)` }}
          />
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover object-center"
              style={{ filter: "brightness(0.92) contrast(1.05)" }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <ShoppingCart className="h-10 w-10 text-white/20" />
            </div>
          )}
          <div
            className="absolute bottom-0 left-0 right-0 h-10"
            style={{ background: `linear-gradient(to top, ${theme.fadeBottom}, transparent)` }}
          />
        </div>
      </div>
    </Link>
  );
}

export function FlashDealsCarousel({
  products,
  countdown,
  colorThemeId,
}: {
  products: Product[];
  countdown: { h: string; m: string; s: string };
  colorThemeId?: string | null;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (products.length <= 1) return;
    const id = setInterval(() => setIdx(i => (i + 1) % products.length), 3500);
    return () => clearInterval(id);
  }, [products.length]);

  if (products.length === 0) return null;

  return (
    <div className="relative">
      <FlashDealCard product={products[idx]} countdown={countdown} colorThemeId={colorThemeId} />
      {products.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all ${
                i === idx ? "w-4 h-1.5 bg-white/60" : "w-1.5 h-1.5 bg-foreground/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
