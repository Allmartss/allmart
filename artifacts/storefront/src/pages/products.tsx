import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch, Link } from "wouter";
import {
  useListProducts,
  useListCategories,
  useGetStorefrontSummary,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { SaleCard } from "@/components/sale-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, X, LayoutGrid,
  Watch, Mountain, Footprints, Heart, Laptop, Shirt, Dumbbell,
  UtensilsCrossed, BookOpen, Gamepad2, HeartPulse, Plane, PawPrint,
  Gem, Home as HomeIcon, Music2, Car, ArrowRight,
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

export default function Products() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const qParam = searchParams.get("q") || undefined;

  const [searchInput, setSearchInput] = useState(qParam || "");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => { setSearchInput(qParam || ""); }, [qParam]);

  const { data: allProducts, isLoading: isProductsLoading } = useListProducts({ q: qParam });
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
            {qParam ? `Results for "${qParam}"` : "All Products"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {categoryGroups.length > 0
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
      {(categories ?? []).length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-3 mb-8" style={{ scrollbarWidth: "none" }}>
          {(categories ?? []).map((cat, idx) => {
            const Icon = getCategoryIcon(cat.slug);
            const gradient = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
            const isActive = activeSlug === cat.slug;
            return (
              <button
                key={cat.slug}
                onClick={() => scrollToCategory(cat.slug)}
                className="flex flex-col items-center gap-1.5 shrink-0 group"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-md transition-all duration-200 ${
                    isActive ? "ring-2 ring-offset-2 ring-primary scale-110" : "opacity-80 group-hover:opacity-100 group-hover:scale-105"
                  }`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </span>
                <span className={`text-[10px] font-medium max-w-[52px] text-center leading-tight truncate transition-colors ${isActive ? "text-primary font-semibold" : "text-foreground/60"}`}>
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
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
              <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="aspect-square rounded-2xl" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold capitalize">{name}</h2>
                <span className="text-xs text-muted-foreground">{products.length} item{products.length !== 1 ? "s" : ""}</span>
              </div>
              {/* Product grid — 4 per row */}
              <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
                {products.map(p => (
                  <SaleCard key={p.id} product={p} variant="grid" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
