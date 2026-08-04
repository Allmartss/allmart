import { useState, useEffect } from "react";
import { Link } from "wouter";
import type { Product } from "@workspace/api-client-react";
import { ArrowRight, ShoppingCart } from "lucide-react";

export function discountPctFlash(product: Product): number {
  const orig = (product as any).originalPrice ?? (product as any).compareAtPrice;
  if (!orig || orig <= product.price) return 10 + (product.id % 40);
  return Math.round(100 - (product.price / orig) * 100);
}

export function FlashDealCard({
  product,
  countdown,
}: {
  product: Product;
  countdown: { h: string; m: string; s: string };
}) {
  const pct = discountPctFlash(product);

  return (
    <Link href={`/products/${product.id}`}>
      <div
        className="relative rounded-2xl overflow-hidden cursor-pointer"
        style={{
          background: "linear-gradient(135deg, #1a1506 0%, #2d2208 60%, #3d2f0a 100%)",
          minHeight: "148px",
        }}
      >
        {/* Warm glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 80% 50%, rgba(180,130,40,0.18) 0%, transparent 70%)" }}
        />

        {/* Left content */}
        <div className="relative z-10 p-4 pr-36 flex flex-col justify-between h-full min-h-[148px]">
          <div>
            <span className="inline-block rounded-full bg-white/10 border border-white/15 px-2.5 py-0.5 text-[9px] font-semibold text-amber-200/80 uppercase tracking-wider mb-2">
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
                <span className="flex h-6 min-w-[26px] items-center justify-center rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[11px] font-bold px-1.5 font-mono">
                  {unit}
                </span>
                {i < 2 && <span className="text-amber-400/60 text-[10px] font-bold">:</span>}
              </span>
            ))}
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all px-4 py-1.5 text-[11px] font-bold text-black w-fit">
            Shop Now <ArrowRight className="h-3 w-3" />
          </div>
        </div>

        {/* Product image */}
        <div className="absolute right-0 top-0 bottom-0 w-36 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 w-10 z-10"
            style={{ background: "linear-gradient(to right, #1a1506, transparent)" }}
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
              <ShoppingCart className="h-10 w-10 text-amber-400/40" />
            </div>
          )}
          <div
            className="absolute bottom-0 left-0 right-0 h-10"
            style={{ background: "linear-gradient(to top, #1a1506, transparent)" }}
          />
        </div>
      </div>
    </Link>
  );
}

export function FlashDealsCarousel({
  products,
  countdown,
}: {
  products: Product[];
  countdown: { h: string; m: string; s: string };
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
      <FlashDealCard product={products[idx]} countdown={countdown} />
      {products.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all ${
                i === idx ? "w-4 h-1.5 bg-amber-500" : "w-1.5 h-1.5 bg-foreground/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
