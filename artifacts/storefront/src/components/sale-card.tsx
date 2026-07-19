import { Link } from "wouter";
import { Star } from "lucide-react";
import type { Product } from "@workspace/api-client-react";

function toSlug(name: string, id: number) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + id;
}

function fmtPrice(price: number, currency: string) {
  const sym = currency === "NGN" ? "₦" : currency === "USD" ? "$" : currency;
  return sym + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
