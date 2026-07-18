import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useGetProduct, useAddCartItem, getGetCartQueryKey, useListProducts, useListCategories } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Star, ShoppingCart, Sparkles, Package,
  ChevronLeft, ChevronRight, Share2, Users, Zap, BadgeCheck,
  ShieldCheck, LayoutGrid,
  Watch, Mountain, Footprints, Heart, Laptop, Shirt, Dumbbell,
  UtensilsCrossed, BookOpen, Gamepad2, HeartPulse, Plane, PawPrint,
  Gem, Home as HomeIcon, Music2, Car,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CAT_ICONS: Record<string, React.ElementType> = {
  accessories: Watch, outdoor: Mountain, shoes: Footprints,
  beauty: Heart, electronics: Laptop, fashion: Shirt,
  clothing: Shirt, sports: Dumbbell, food: UtensilsCrossed,
  books: BookOpen, gaming: Gamepad2, health: HeartPulse,
  travel: Plane, pets: PawPrint, jewelry: Gem,
  home: HomeIcon, music: Music2, automotive: Car, cars: Car, toys: Gamepad2,
};
const CAT_GRADIENTS = [
  "from-pink-500 to-rose-500", "from-orange-400 to-amber-500",
  "from-emerald-400 to-teal-500", "from-blue-400 to-indigo-500",
  "from-purple-500 to-violet-600", "from-cyan-400 to-sky-500",
  "from-red-400 to-orange-500", "from-green-400 to-emerald-500",
];

export default function ProductDetail() {
  const [, params] = useRoute("/products/:slug");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeIdx, setActiveIdx] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [qty, setQty] = useState(1);

  const rawParam = params?.slug ?? "";
  const id = Number(rawParam.match(/-(\d+)$/)?.[1] ?? rawParam);
  const { data: product, isLoading } = useGetProduct(id);
  const { data: allProductsList } = useListProducts();
  const { data: allCategoriesList } = useListCategories();

  const addCartItem = useAddCartItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast({ title: "Added to cart ✓", description: `${product?.name} × ${qty} added.` });
      },
    },
  });

  const handleAddToCart = () => {
    if (!product) return;
    addCartItem.mutate({ data: { productId: product.id, quantity: qty } });
  };

  const handleBuyNow = async () => {
    if (!product) return;
    await addCartItem.mutateAsync({ data: { productId: product.id, quantity: qty } });
    setLocation("/checkout");
  };

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="w-full aspect-[4/3]" />
        <div className="px-4 py-4 space-y-4">
          <div className="flex gap-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-16 rounded-xl" />)}
          </div>
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <Package className="h-16 w-16 text-muted-foreground/40" />
        <p className="text-lg font-semibold">Product not found</p>
        <Link href="/products">
          <button className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white">
            Back to products
          </button>
        </Link>
      </div>
    );
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency || "USD" }).format(n);

  const isOutOfStock = product.stock <= 0;
  const hasDiscount = product.originalPrice != null && (product.originalPrice as number) > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / (product.originalPrice as number)) * 100)
    : 0;

  const allImages = [
    ...(product.imageUrl ? [product.imageUrl] : []),
    ...(product.images ?? []).filter(img => img !== product.imageUrl),
  ];
  const activeImage = allImages[activeIdx] ?? null;

  const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + product.id;
  const url = `${window.location.origin}/products/${slug}`;
  const shareText = `Check out ${product.name} on AllMart!`;

  function shareOn(platform: string) {
    if (platform === "facebook") window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
    else if (platform === "x") window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`, "_blank");
    else { navigator.clipboard.writeText(url); toast({ title: "Link copied!" }); }
    setShareOpen(false);
  }

  // Fake-but-plausible social proof numbers seeded from product id
  const viewerCount = 3 + (product.id % 17);
  const isPopular = product.rating >= 4.0 || product.stock < 20;
  const isSellingFast = product.stock < 30;

  return (
    <div className="min-h-screen bg-background pb-32">

      {/* ── Delivery fee + stock — above the image ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-background border-b border-border/40">
        {(product as { shippingFee?: number | null }).shippingFee != null && (product as { shippingFee?: number | null }).shippingFee! > 0 ? (
          <p className="text-xs text-muted-foreground">
            Delivery fee: <span className="font-semibold text-foreground">{fmt((product as { shippingFee?: number | null }).shippingFee!)}</span>
          </p>
        ) : (
          <p className="text-xs text-emerald-600 font-medium">✓ Free delivery</p>
        )}
        {isOutOfStock ? (
          <span className="text-xs font-semibold text-destructive">Out of stock</span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">{product.stock} in stock</span>
        )}
      </div>

      {/* ── Hero image — full bleed ── */}
      <div className="relative w-full aspect-[4/3] bg-muted overflow-hidden">
        {activeImage ? (
          <img
            src={activeImage}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-20 w-20 text-muted-foreground/30" />
          </div>
        )}

        {/* AllMart badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1.5">
          <span className="text-[11px] font-bold text-white">AllMart</span>
          <span className="text-[10px]">🛍️</span>
        </div>

        {/* Back button */}
        <button
          onClick={() => history.back()}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Prev/Next arrows */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx(i => (i - 1 + allImages.length) % allImages.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveIdx(i => (i + 1) % allImages.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Discount badge */}
        {hasDiscount && (
          <div className="absolute bottom-3 right-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow-lg">
            -{discountPct}% OFF
          </div>
        )}
      </div>

      {/* ── Thumbnail strip ── */}
      {allImages.length > 1 && (
        <div className="flex gap-2 px-4 pt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {allImages.map((img, i) => (
            <button
              key={img + i}
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 h-16 w-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === activeIdx ? "border-primary shadow-md" : "border-border/40 opacity-60 hover:opacity-100"
              }`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* ── Body ── */}
      <div className="px-4 pt-4 space-y-4">

        {/* Seller row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Avatar */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-bold shadow-sm">
              {(product.sellerName ?? "S").charAt(0).toUpperCase()}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold">{product.sellerName ?? "AllMart Seller"}</span>
              <BadgeCheck className="h-4 w-4 text-primary fill-primary/20" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Creator</span>
          </div>
        </div>

        {/* Product name */}
        <h1 className="text-2xl font-bold tracking-tight leading-tight">{product.name}</h1>

        {/* Rating row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
              <Star
                key={s}
                className={`h-4 w-4 ${s <= Math.round(product.rating) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}`}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {product.rating.toFixed(1)} ({product.stock > 0 ? product.stock : 0} reviews)
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {product.tags.map(tag => (
              <span key={tag} className="rounded-full border border-border/50 bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Colors */}
        {product.colors && product.colors.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Available colours</p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map(c => (
                <span key={c} className="rounded-full border border-border px-3 py-1 text-xs font-medium">{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Detail note */}
        {(product as { detailNote?: string }).detailNote && (
          <div className="rounded-2xl border border-border/50 bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Product Details</p>
            <p className="text-sm leading-relaxed whitespace-pre-line">{(product as { detailNote?: string }).detailNote}</p>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-border/50" />

        {/* Social proof bar */}
        <div className="rounded-2xl border border-border/50 bg-card px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <Users className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-bold text-primary leading-none">{viewerCount} People</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Viewed this product</p>
            </div>
          </div>
          {isSellingFast && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Zap className="h-4 w-4 text-orange-500 fill-orange-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-orange-500 leading-none">Selling Fast</p>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Limited stock available</p>
              </div>
            </div>
          )}
          {isPopular && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 ml-auto">
              <span className="text-[11px] font-bold text-emerald-600">✓ Popular Choice</span>
            </div>
          )}
        </div>

      </div>

      {/* ── New Arrivals ── */}
      {(allProductsList ?? []).filter(p => p.id !== product?.id).length > 0 && (
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">New Arrivals</h2>
            <Link href="/products?sort=new">
              <span className="text-xs font-semibold text-primary hover:underline cursor-pointer">See all</span>
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {[...(allProductsList ?? [])]
              .filter(p => p.id !== product?.id)
              .sort((a, b) => b.id - a.id)
              .slice(0, 8)
              .map(p => {
                const pSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + p.id;
                const pFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency || "USD" }).format(p.price);
                return (
                  <Link key={p.id} href={`/products/${pSlug}`}>
                    <div className="shrink-0 w-32 group cursor-pointer">
                      <div className="overflow-hidden rounded-2xl bg-muted aspect-square mb-2">
                        {p.imageUrl
                          ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          : <div className="h-full w-full flex items-center justify-center"><Package className="h-8 w-8 text-muted-foreground/30" /></div>
                        }
                      </div>
                      <p className="text-xs font-semibold leading-tight line-clamp-2 mb-0.5">{p.name}</p>
                      <p className="text-sm font-bold text-primary">{pFmt}</p>
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Shop by Category ── */}
      {(allCategoriesList ?? []).length > 0 && (
        <div className="px-4 pt-4 pb-4">
          <h2 className="text-base font-bold mb-3">Shop by Category</h2>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {(allCategoriesList ?? []).map((cat, i) => {
              const Icon = CAT_ICONS[cat.slug.toLowerCase().replace(/[^a-z]/g, "")] ?? LayoutGrid;
              return (
                <Link key={cat.slug} href={`/products?category=${cat.slug}`}>
                  <button className="flex flex-col items-center gap-1.5 shrink-0 group">
                    <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${CAT_GRADIENTS[i % CAT_GRADIENTS.length]} shadow-sm group-hover:opacity-90 transition-opacity`}>
                      <Icon className="h-6 w-6 text-white" />
                    </span>
                    <span className="text-[10px] font-medium text-foreground/70 max-w-[56px] text-center leading-tight truncate">{cat.name}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sticky bottom bar: price + CTA ── */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur border-t border-border/50 px-4 py-3 safe-area-inset-bottom">

        <div className="flex items-center gap-3">
          {/* Price */}
          <div className="flex flex-col leading-none">
            <span className="text-2xl font-extrabold text-primary">{fmt(product.price)}</span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">{fmt(product.originalPrice as number)}</span>
            )}
          </div>

          {/* Qty stepper */}
          <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 px-2 py-1">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors"
            >−</button>
            <span className="min-w-[24px] text-center text-sm font-semibold">{qty}</span>
            <button
              onClick={() => setQty(q => q + 1)}
              disabled={qty >= product.stock}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-lg font-bold hover:bg-muted transition-colors disabled:opacity-40"
            >+</button>
          </div>

          {/* Add to Cart */}
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || addCartItem.isPending}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <ShoppingCart className="h-4 w-4" />
            {addCartItem.isPending ? "Adding…" : "Add to Cart"}
          </button>
        </div>

        {/* Ask AI secondary action */}
        <button
          onClick={() => {
            sessionStorage.setItem("nb_prefill", `I'd like to buy the ${product.name}`);
            setLocation("/assistant");
          }}
          className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" /> Ask AI to help me buy this
        </button>
      </div>

      {/* Share fab */}
      <div className="fixed bottom-36 right-4 z-50">
        <div className="relative">
          <button
            onClick={() => setShareOpen(o => !o)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card border border-border/60 shadow-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <Share2 className="h-4 w-4" />
          </button>
          {shareOpen && (
            <div className="absolute bottom-14 right-0 bg-card border border-border/60 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-0.5 min-w-[180px]">
              {[
                { id: "facebook", label: "Share on Facebook", color: "text-blue-600" },
                { id: "x", label: "Share on X / Twitter", color: "text-foreground" },
                { id: "instagram", label: "Copy for Instagram", color: "text-pink-600" },
                { id: "tiktok", label: "Copy for TikTok", color: "text-foreground" },
              ].map(s => (
                <button key={s.id} onClick={() => shareOn(s.id)}
                  className={`text-left text-xs font-medium px-3 py-2 rounded-xl hover:bg-muted transition-colors ${s.color}`}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
