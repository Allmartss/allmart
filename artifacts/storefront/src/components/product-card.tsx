import { useState } from "react";
import { Link } from "wouter";
import type { Product } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Share2 } from "lucide-react";
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
      <Card className="group h-full overflow-hidden border-border/50 bg-card hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer flex flex-col relative">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted/30">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            <Badge variant="secondary" className="bg-background/85 backdrop-blur-sm font-semibold text-xs">
              {fmt.format(product.price)}
            </Badge>
            {hasDiscount && (
              <Badge className="bg-primary text-primary-foreground font-bold text-[10px] px-1.5 py-0.5">
                -{discountPct}%
              </Badge>
            )}
          </div>
          {product.stock < 5 && product.stock > 0 && (
            <div className="absolute top-2 left-2">
              <Badge variant="destructive" className="font-semibold shadow-sm text-[10px]">
                Only {product.stock} left
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-2 flex-1 flex flex-col">
          <h3 className="font-sans font-semibold text-xs line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          {hasDiscount && (
            <span className="text-[10px] text-muted-foreground line-through mt-0.5">
              {fmt.format(product.originalPrice!)}
            </span>
          )}
        </CardContent>

        <CardFooter className="p-2 pt-0 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-amber-500 font-medium">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span className="text-xs">{product.rating.toFixed(1)}</span>
          </div>
          <div className="relative">
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); setShareOpen(o => !o); }}
              className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Share"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
            {shareOpen && <ShareDropdown product={product} />}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
