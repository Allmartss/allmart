import { useState } from "react";
import { Link } from "wouter";
import { Star, Heart, ShoppingBag, Check } from "lucide-react";
import type { Product } from "@workspace/api-client-react";
import { useAddCartItem, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

function toSlug(name: string, id: number) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + id;
}

function fmtPrice(price: number, currency: string) {
  const sym = currency === "NGN" ? "₦" : currency === "USD" ? "$" : currency;
  return sym + price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── BestSellingCard ────────────────────────────────────────────────────────────
const DOT_PALETTES = [
  ["#FF6B35", "#E74C3C", "#3498DB", "#2ECC71"],
  ["#F39C12", "#E74C3C", "#9B59B6", "#1ABC9C"],
  ["#FF4081", "#FF6D00", "#00BCD4", "#4CAF50"],
  ["#E91E63", "#FF5722", "#2196F3", "#8BC34A"],
  ["#F44336", "#FF9800", "#03A9F4", "#4CAF50"],
  ["#D32F2F", "#F57C00", "#1976D2", "#388E3C"],
];

const SIZE_LABELS = ["42", "43", "44"];

export function BestSellingCard({ product }: { product: Product }) {
  const [wishlist, setWishlist] = useState(false);
  const [added, setAdded] = useState(false);
  const queryClient = useQueryClient();
  const addToCart = useAddCartItem();

  const dots = DOT_PALETTES[product.id % DOT_PALETTES.length];
  const price = fmtPrice(product.price, product.currency || "USD");

  const handleAddToBag = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await addToCart.mutateAsync({ data: { productId: product.id, quantity: 1 } });
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    } catch {}
  };

  return (
    <Link href={`/products/${toSlug(product.name, product.id)}`}>
      <div className="group cursor-pointer rounded-2xl overflow-hidden bg-[#F0F0F0] dark:bg-[#1C1C28] hover:shadow-md transition-all duration-200 flex flex-col">

        {/* ── Header: category / name / price / dots ── */}
        <div className="px-3 pt-3 pb-0">
          <p className="text-[9px] text-foreground/40 dark:text-white/30 font-medium uppercase tracking-wider leading-none mb-1">
            {product.category || "Product"}
          </p>
          <div className="flex items-start justify-between gap-1 mb-1">
            <p className="text-[11px] font-bold leading-tight line-clamp-2 text-foreground dark:text-white flex-1 min-w-0">
              {product.name}
            </p>
            <span className="text-[12px] font-extrabold text-foreground dark:text-white shrink-0 ml-1 mt-0.5">
              {price}
            </span>
          </div>
          {/* Color dots */}
          <div className="flex items-center gap-1 mb-1">
            {dots.map((color, i) => (
              <span
                key={i}
                className="h-[9px] w-[9px] rounded-full shrink-0"
                style={{ background: color }}
              />
            ))}
          </div>
        </div>

        {/* ── Product image ── */}
        <div className="flex-1 flex items-center justify-center px-3 py-2 min-h-[96px]">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-24 w-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow"
            />
          ) : (
            <span className="text-4xl text-foreground/20">🛍</span>
          )}
        </div>

        {/* ── Footer: sizes / heart / add to bag ── */}
        <div className="px-3 pb-3 flex items-center gap-1">
          {/* Size chips */}
          {SIZE_LABELS.map(s => (
            <span
              key={s}
              className="rounded-md bg-black/[0.07] dark:bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-foreground/55 dark:text-white/50"
            >
              {s}
            </span>
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Wishlist heart */}
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setWishlist(w => !w); }}
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
            aria-label="Wishlist"
          >
            <Heart
              className={`h-3.5 w-3.5 transition-colors ${
                wishlist ? "fill-red-500 text-red-500" : "text-foreground/35 dark:text-white/40"
              }`}
            />
          </button>

          {/* Add to Bag */}
          <button
            onClick={handleAddToBag}
            disabled={addToCart.isPending}
            className="flex items-center gap-1 rounded-full bg-black/[0.07] dark:bg-white/10 hover:bg-black/12 dark:hover:bg-white/20 px-2 py-1 text-[9px] font-semibold text-foreground/65 dark:text-white/65 transition-colors shrink-0 disabled:opacity-50"
            aria-label="Add to bag"
          >
            {added ? (
              <><Check className="h-2.5 w-2.5" /> Done</>
            ) : (
              <>Add to Bag <ShoppingBag className="h-2.5 w-2.5" /></>
            )}
          </button>
        </div>
      </div>
    </Link>
  );
}

interface SaleCardProps {
  product: Product;
  /** "scroll" = fixed-width horizontal list; "grid" = fills column (info below image); "flash" = fills column (all info overlaid inside image) */
  variant?: "scroll" | "grid" | "flash";
  /** Fixed pixel width for scroll variant (default 130) */
  width?: number;
}

export function SaleCard({ product, variant = "grid", width = 130 }: SaleCardProps) {
  const hasDiscount =
    product.originalPrice != null && (product.originalPrice as number) > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / (product.originalPrice as number)) * 100)
    : 0;
  const price = fmtPrice(product.price, product.currency || "USD");
  const origPrice = hasDiscount
    ? fmtPrice(product.originalPrice as number, product.currency || "USD")
    : null;

  /* ── Flash variant: everything inside the image ── */
  if (variant === "flash") {
    return (
      <Link href={`/products/${toSlug(product.name, product.id)}`}>
        <div className="group cursor-pointer rounded-2xl overflow-hidden relative aspect-square bg-muted/50 hover:shadow-lg transition-all duration-200">
          {/* Image */}
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground/30 text-4xl">🛍</div>
          )}

          {/* Discount badge — top-right */}
          {hasDiscount && discountPct > 0 && (
            <span className="absolute top-2 right-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white leading-tight z-10">
              -{discountPct}%
            </span>
          )}

          {/* Bottom gradient overlay with all info */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent pt-8 pb-2 px-2 z-10">
            <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2 mb-1">{product.name}</p>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[12px] font-extrabold text-white leading-tight">{price}</span>
                {hasDiscount && origPrice && (
                  <span className="text-[9px] text-white/60 line-through leading-tight">{origPrice}</span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-[10px] font-medium text-white/80">{product.rating.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  const inner = (
    <div
      className={`group cursor-pointer rounded-2xl overflow-hidden bg-card border border-border/40 hover:border-primary/30 hover:shadow-lg transition-all duration-200 flex flex-col${
        variant === "scroll" ? " shrink-0" : ""
      }`}
      style={variant === "scroll" ? { width } : undefined}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted/50">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground/30 text-3xl">
            🛍
          </div>
        )}

        {/* Price badge overlay — top-left */}
        <div className="absolute top-2 left-2 flex flex-col gap-0.5">
          <span className="rounded-lg bg-black/75 backdrop-blur-sm px-2 py-0.5 text-[11px] font-bold text-white leading-tight">
            {price}
          </span>
          {hasDiscount && discountPct > 0 && (
            <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white leading-tight">
              -{discountPct}%
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2 flex flex-col flex-1 gap-0.5">
        <p className="text-[11px] font-semibold leading-tight line-clamp-2 text-foreground">
          {product.name}
        </p>
        {hasDiscount && origPrice && (
          <p className="text-[10px] text-muted-foreground line-through">{origPrice}</p>
        )}
        <div className="flex items-center gap-0.5 mt-auto pt-1">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="text-[10px] font-medium text-muted-foreground">
            {product.rating.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <Link href={`/products/${toSlug(product.name, product.id)}`}>
      {inner}
    </Link>
  );
}
