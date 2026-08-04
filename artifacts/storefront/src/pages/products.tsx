import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch, Link } from "wouter";
import {
  useListProducts,
  useListCategories,
  useGetStorefrontSummary,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { SaleCard, BestSellingCard } from "@/components/sale-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, X, LayoutGrid,
  Watch, Mountain, Footprints, Heart, Laptop, Shirt, Dumbbell,
  UtensilsCrossed, BookOpen, Gamepad2, HeartPulse, Plane, PawPrint,
  Gem, Home as HomeIcon, Music2, Car, ArrowRight, ChevronLeft, ChevronRight, Tag,
} from "lucide-react";

// ── Category icon + colour mapping ─────────────────────────────────────────────
type LucideIcon = React.ElementType;
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  accessories: Watch,
  outdoor: Mountain,
  shoes: Footprints,
  beauty: Heart,
  electronics: Laptop,
  fashion: Shirt,
  clothing: Shirt,
  sports: Dumbbell,
  food: UtensilsCrossed,
  books: BookOpen,
  gaming: Gamepad2,
  health: HeartPulse,
  travel: Plane,
  pets: PawPrint,
  jewelry: Gem,
  home: HomeIcon,
  music: Music2,
  automotive: Car,
  cars: Car,
  toys: Gamepad2,
};
const CATEGORY_COLORS = [
  "from-pink-500 to-rose-500",
  "from-orange-400 to-amber-500",
  "from-emerald-400 to-teal-500",
  "from-blue-400 to-indigo-500",
  "from-purple-500 to-violet-600",
  "from-cyan-400 to-sky-500",
  "from-red-400 to-orange-500",
  "from-green-400 to-emerald-500",
];
function getCategoryIcon(slug: string): LucideIcon {
  const key = slug.toLowerCase().replace(/[^a-z]/g, "");
  return CATEGORY_ICONS[key] ?? LayoutGrid;
}

// ── Featured Slider (828×582: image 500px left, content 328px right) ─────────
type FeaturedProduct = { id: number; name: string; description?: string | null; imageUrl?: string | null; price: number; originalPrice?: number | null; currency?: string | null; category?: string | null };

function FeaturedSlider({ products }: { products: FeaturedProduct[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const items = products.slice(0, 10);

  const next = useCallback(() => setCurrent(c => (c + 1) % Math.max(items.length, 1)), [items.length]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1)), [items.length]);

  useEffect(() => {
    if (items.length < 2 || paused) return;
    const id = setInterval(next, 4500);
    return () => clearInterval(id);
  }, [next, items.length, paused]);

  if (items.length === 0) return null;

  const p = items[current]!;
  const fmt = (n: number) => {
    const sym = p.currency === "NGN" ? "₦" : (p.currency ?? "$");
    return `${sym}${n.toLocaleString()}`;
  };
  const discountPct = p.originalPrice && p.originalPrice > p.price
    ? Math.round((1 - p.price / p.originalPrice) * 100)
    : null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold tracking-tight">Featured</h2>
        {items.length > 1 && (
          <div className="flex gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all duration-300 ${i === current ? "w-6 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-primary/25"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card: 828×582 proportions — fluid on mobile, capped at 828px */}
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm"
        style={{ maxWidth: "828px", aspectRatio: "828/582" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <Link href={`/products/${p.id}`} className="flex h-full w-full">

          {/* Image side — 500px / 828px ≈ 60.4% */}
          <div className="relative overflow-hidden bg-muted/20" style={{ width: "60.4%" }}>
            {p.imageUrl ? (
              <img
                key={p.id}
                src={p.imageUrl}
                alt={p.name}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 hover:scale-105"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted">
                <Tag className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
            {discountPct && (
              <div className="absolute top-3 left-3 bg-primary text-primary-foreground font-bold text-xs px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                <Tag className="h-3 w-3" /> -{discountPct}%
              </div>
            )}
          </div>

          {/* Content side — 328px / 828px ≈ 39.6% */}
          <div className="flex flex-col justify-between p-5 sm:p-8" style={{ width: "39.6%" }}>
            <div className="flex flex-col gap-2 sm:gap-3">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-primary">
                {p.category ?? "Featured"}
              </span>
              <h3 className="font-serif text-base sm:text-xl lg:text-2xl font-bold leading-snug line-clamp-3">
                {p.name}
              </h3>
              {p.description && (
                <p className="text-muted-foreground text-[11px] sm:text-sm line-clamp-3 sm:line-clamp-4">
                  {p.description}
                </p>
              )}
              <div className="flex items-baseline gap-2 flex-wrap mt-1">
                <span className="text-base sm:text-xl font-bold text-primary">{fmt(p.price)}</span>
                {p.originalPrice && p.originalPrice > p.price && (
                  <span className="text-xs sm:text-sm text-muted-foreground line-through">{fmt(p.originalPrice)}</span>
                )}
              </div>
            </div>
            <button
              onClick={e => e.preventDefault()}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors w-fit"
            >
              Shop now <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </Link>

        {/* Prev / Next arrows */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); prev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 border border-border/40 flex items-center justify-center hover:bg-background shadow transition-colors z-10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); next(); }}
              className="absolute right-[39.6%] top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 border border-border/40 flex items-center justify-center hover:bg-background shadow transition-colors z-10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Products() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const qParam = searchParams.get("q") || undefined;
  const freeShippingParam = searchParams.get("freeShipping") === "true";

  const [searchInput, setSearchInput] = useState(qParam || "");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => { setSearchInput(qParam || ""); }, [qParam]);

  const { data: allProducts, isLoading: isProductsLoading } = useListProducts(
    freeShippingParam ? { freeShipping: true } as any : { q: qParam }
  );
  const { data: categories, isLoading: isCategoriesLoading } = useListCategories();
  const { data: summary } = useGetStorefrontSummary();

  // Group products by category (only categories that have products)
  const categoryGroups: { slug: string; name: string; products: Product[] }[] = (() => {
    if (!allProducts || !categories) return [];
    const map = new Map<string, Product[]>();
    for (const p of allProducts) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return categories
      .filter(c => (map.get(c.slug)?.length ?? 0) > 0)
      .map(c => ({ slug: c.slug, name: c.name, products: map.get(c.slug)! }));
  })();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchString);
    if (searchInput.trim()) params.set("q", searchInput.trim());
    else params.delete("q");
    const s = params.toString();
    setLocation(s ? `/products?${s}` : "/products");
  };

  const scrollToCategory = (slug: string) => {
    setActiveSlug(slug);
    const el = sectionRefs.current[slug];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Track which section is in view to highlight active pill
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    categoryGroups.forEach(({ slug }) => {
      const el = sectionRefs.current[slug];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSlug(slug); },
        { threshold: 0.3 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [categoryGroups.length]);

  return (
    <div className="container max-w-screen-xl mx-auto py-10 px-4">

      {/* ── Title + Search ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {freeShippingParam ? "Free Shipping" : qParam ? `Results for "${qParam}"` : "All Products"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {freeShippingParam
              ? `${allProducts?.length ?? 0} products with free delivery`
              : categoryGroups.length > 0
              ? `${allProducts?.length ?? 0} products across ${categoryGroups.length} categories`
              : "Discover our complete collection."}
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex w-full sm:w-auto max-w-sm gap-2">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search products..."
              className="pl-9 pr-10 w-full"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); const p = new URLSearchParams(searchString); p.delete("q"); const s = p.toString(); setLocation(s ? `/products?${s}` : "/products"); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit">Search</Button>
        </form>
      </div>

      {/* ── Category avatar pills — horizontal scroll ── */}
      {categoryGroups.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-3 mb-8" style={{ scrollbarWidth: "none" }}>
          {categoryGroups.map(({ slug, name, products: catProducts }, idx) => {
            const Icon = getCategoryIcon(slug);
            const gradient = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
            const isActive = activeSlug === slug;
            const firstImg = catProducts.find(p => p.imageUrl)?.imageUrl;
            return (
              <button
                key={slug}
                onClick={() => scrollToCategory(slug)}
                className="flex flex-col items-center gap-1.5 shrink-0 group"
              >
                <div
                  className={`h-16 w-16 rounded-2xl overflow-hidden bg-muted shadow-sm transition-all duration-200 ${
                    isActive ? "ring-2 ring-offset-2 ring-primary scale-110 shadow-md" : "group-hover:shadow-md group-hover:scale-105"
                  }`}
                >
                  {firstImg ? (
                    <img
                      src={firstImg}
                      alt={name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className={`h-full w-full flex items-center justify-center bg-gradient-to-br ${gradient}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  )}
                </div>
                <span className={`text-[11px] font-medium max-w-[64px] text-center leading-tight transition-colors ${isActive ? "text-primary font-semibold" : "text-foreground/70"}`}>
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Featured Slider ── */}
      {(summary?.featured ?? []).length > 0 && (
        <FeaturedSlider products={summary!.featured} />
      )}

      {/* ── New Arrivals ── */}
      {(summary?.featured ?? []).length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight">New Arrivals</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {(summary?.featured ?? []).map(p => (
              <SaleCard key={p.id} product={p} variant="scroll" width={140} />
            ))}
          </div>
        </div>
      )}

      {/* ── Category sections ── */}
      {isProductsLoading || isCategoriesLoading ? (
        <div className="space-y-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-6 w-40 mb-4 rounded" />
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="aspect-square rounded-2xl" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-7 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : categoryGroups.length === 0 ? (
        <div className="text-center py-24 bg-muted/30 rounded-2xl border border-border/50">
          <Search className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No products found</h3>
          <p className="text-muted-foreground mb-6">Try a different search term.</p>
          <Button onClick={() => { setSearchInput(""); setLocation("/products"); }} variant="outline">
            Clear search
          </Button>
        </div>
      ) : (
        <div className="space-y-12">
          {categoryGroups.map(({ slug, name, products }) => (
            <div
              key={slug}
              id={`cat-${slug}`}
              ref={el => { sectionRefs.current[slug] = el; }}
              className="scroll-mt-6"
            >
              {/* Section header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-bold capitalize">{name}</h2>
                <span className="text-xs font-semibold text-foreground/50 hover:text-foreground transition-colors">{products.length} item{products.length !== 1 ? "s" : ""}</span>
              </div>
              {/* Product grid — 3 per row */}
              <div className="grid grid-cols-3 gap-3">
                {products.map(p => (
                  <BestSellingCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
