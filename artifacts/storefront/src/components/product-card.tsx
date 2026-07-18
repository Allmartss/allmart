import { useState } from "react";
import { Link } from "wouter";
import type { Product } from "@workspace/api-client-react";
import { Star, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

function toSlug(name: string, id: number) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + id;
}

function ShareDropdown({ product }: { product: Product }) {
  const { toast } = useToast();
  const url = `${window.location.origin}/products/${toSlug(product.name, product.id)}`;
  const text = `Check out ${product.name} on AllMart!`;

  function share(platform: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
    } else if (platform === "x") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: `Paste it on ${platform}!` });
    }
  }

  return (
    <div
      className="absolute bottom-8 right-0 z-30 bg-card border border-border/60 rounded-xl shadow-xl p-1.5 flex flex-col gap-0.5 min-w-[160px]"
      onClick={e => { e.preventDefault(); e.stopPropagation(); }}
    >
      {[
        { id: "facebook", label: "Facebook", color: "text-blue-600" },
        { id: "x", label: "X / Twitter", color: "text-foreground" },
        { id: "instagram", label: "Instagram (copy)", color: "text-pink-600" },
        { id: "tiktok", label: "TikTok (copy)", color: "text-foreground" },
      ].map(s => (
        <button
          key={s.id}
          onClick={e => share(s.id, e)}
          className={`text-left text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-muted transition-colors ${s.color}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const [shareOpen, setShareOpen] = useState(false);
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency || "USD" });
  const hasDiscount = product.originalPrice != null && (product.originalPrice as number) > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / (product.originalPrice as number)) * 100)
    : 0;

  return (
    <Link href={`/products/${toSlug(product.name, product.id)}`}>
      {/* Card is purely the image — text overlaid at bottom */}
      <div className="group relative aspect-square overflow-hidden rounded-xl cursor-pointer shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 bg-muted/30">
        {/* Image — fills 100% */}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />

        {/* Top badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
          <Badge variant="secondary" className="bg-black/50 backdrop-blur-sm text-white border-0 font-semibold text-[10px]">
            {fmt.format(product.price)}
          </Badge>
          {hasDiscount && (
            <Badge className="bg-primary text-primary-foreground font-bold text-[10px] px-1.5 py-0.5">
              -{discountPct}%
            </Badge>
          )}
        </div>

        {product.stock < 5 && product.stock > 0 && (
          <div className="absolute top-2 left-2 z-10">
            <Badge variant="destructive" className="font-semibold shadow-sm text-[10px]">
              Only {product.stock} left
            </Badge>
          </div>
        )}

        {/* Bottom overlay: name + rating + share */}
        <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-2 pt-6 pb-2">
          <h3 className="font-semibold text-[11px] text-white line-clamp-1 leading-tight">
            {product.name}
          </h3>
          <div className="flex items-center justify-between mt-0.5">
            <div className="flex items-center gap-0.5 text-amber-400">
              <Star className="h-3 w-3 fill-current" />
              <span className="text-[10px] font-medium text-white/90">{product.rating.toFixed(1)}</span>
            </div>
            <div className="relative">
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setShareOpen(o => !o); }}
                className="p-1 rounded-full hover:bg-white/20 transition-colors text-white/70 hover:text-white"
                aria-label="Share"
              >
                <Share2 className="h-3 w-3" />
              </button>
              {shareOpen && <ShareDropdown product={product} />}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
