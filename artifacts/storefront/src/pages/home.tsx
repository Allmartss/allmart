import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetStorefrontSummary,
  useListProducts,
  useListCategories,
  useGetCurrentUser,
  useGetCart,
  useGetFlashSale,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Search, Sparkles, ChevronDown, ChevronUp,
  Store, ShoppingCart, LayoutGrid, Zap, Truck, Tag,
  Watch, Mountain, Footprints, Heart, Laptop, Shirt, Dumbbell,
  UtensilsCrossed, BookOpen, Gamepad2, HeartPulse, Plane, PawPrint,
  Gem, Home as HomeIcon, Music2, Car,
} from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffSidebarTrigger } from "@/components/staff-sidebar";
import { NotificationsBell } from "@/components/notifications-bell";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

// ── Category icon mapping ──────────────────────────────────────────────────────
type LucideIcon = React.ElementType;
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  accessories: Watch,
  outdoor:     Mountain,
  shoes:       Footprints,
  beauty:      Heart,
  electronics: Laptop,
  fashion:     Shirt,
  clothing:    Shirt,
  sports:      Dumbbell,
  food:        UtensilsCrossed,
  books:       BookOpen,
  gaming:      Gamepad2,
  health:      HeartPulse,
  travel:      Plane,
  pets:        PawPrint,
  jewelry:     Gem,
  home:        HomeIcon,
  music:       Music2,
  automotive:  Car,
  cars:        Car,
  toys:        Gamepad2,
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

// ── Shop drawer ────────────────────────────────────────────────────────────────
const SHOP_NAV = [
  { href: "/products", icon: LayoutGrid, label: "All Products" },
  { href: "/products?sort=featured", icon: Sparkles, label: "Featured" },
  { href: "/products?sort=new", icon: ArrowRight, label: "New Arrivals" },
  { href: "/products?sort=sale", icon: Tag, label: "Sale" },
  { href: "/assistant", icon: Sparkles, label: "Ask AI" },
];

function ShopDrawerInner() {
  const [location] = useLocation();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-[#8B7BD8] to-[#6C5BB5] shadow-md shadow-primary/40 hover:brightness-110 active:scale-95 transition-all shrink-0"
          aria-label="Open menu"
        >
          <span className="text-white font-extrabold text-base leading-none" style={{ fontFamily: "sans-serif" }}>A</span>
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <div className="bg-primary px-6 py-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-tight">Shop</p>
            <p className="text-xs text-white/70">Browse AllMart</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {SHOP_NAV.map((item) => {
            const active = location === item.href || (item.href !== "/" && location.startsWith(item.href.split("?")[0]));
            const Icon = item.icon;
            return (
              <SheetClose asChild key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
                    active ? "bg-primary/10 text-primary font-semibold" : "text-foreground/80 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-primary/15" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  </span>
                  {item.label}
                </Link>
              </SheetClose>
            );
          })}
        </nav>
        <div className="border-t border-border/50 px-4 py-3">
          <SheetClose asChild>
            <Link href="/products">
              <Button className="w-full rounded-xl gap-2">
                <Search className="h-4 w-4" /> Browse all products
              </Button>
            </Link>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Countdown timer ────────────────────────────────────────────────────────────
function useCountdown(endsAt: string | null) {
  const endMs = endsAt ? new Date(endsAt).getTime() : null;
  const [left, setLeft] = useState(endMs ? Math.max(0, endMs - Date.now()) : 0);
  useEffect(() => {
    if (!endMs) { setLeft(0); return; }
    setLeft(Math.max(0, endMs - Date.now()));
    const id = setInterval(() => setLeft(Math.max(0, endMs - Date.now())), 1000);
    return () => clearInterval(id);
  }, [endMs]);
  const h = Math.floor(left / 3600_000).toString().padStart(2, "0");
  const m = Math.floor((left % 3600_000) / 60_000).toString().padStart(2, "0");
  const s = Math.floor((left % 60_000) / 1_000).toString().padStart(2, "0");
  return { h, m, s, expired: endMs !== null && left <= 0 };
}

// ── Discount pill helper ───────────────────────────────────────────────────────
function discountPct(product: Product): number | null {
  const orig = (product as any).originalPrice ?? (product as any).compareAtPrice;
  if (!orig || orig <= product.price) return null;
  return Math.round(100 - (product.price / orig) * 100);
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");

  const { data: categories } = useListCategories();
  const { data: allProducts, isLoading: isProductsLoading } = useListProducts();
  const { data: meData } = useGetCurrentUser();
  const { data: cart } = useGetCart();
  const { data: flashSale } = useGetFlashSale();
  const me = meData?.user ?? null;
  const isStaff = me && (me.role === "admin" || me.role === "pm");
  const cartItemCount = cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const flashSaleLive = !!flashSale?.enabled && (flashSale?.products?.length ?? 0) > 0;
  const { h, m, s } = useCountdown(flashSaleLive ? flashSale!.endsAt : null);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      sessionStorage.setItem("initial_assistant_query", query);
      setLocation("/assistant");
    }
  };

  // categories with products
  const categoryGroups = (() => {
    if (!allProducts || !categories) return [];
    const map = new Map<string, Product[]>();
    for (const p of allProducts) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return categories
      .filter(c => (map.get(c.slug)?.length ?? 0) > 0)
      .map(c => ({ slug: c.slug, name: c.name, products: map.get(c.slug) ?? [] }));
  })();

  // Sale products — only the ones admin selected for the flash sale
  const saleProducts = flashSale?.products ?? [];

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0D0B1A] dark:bg-[#0D0B1A] light:bg-[#F8F7FF]">

      {/* ── Header — black bar, actions only ────────────────────────────────── */}
      <section className="bg-[#0B0A14] px-4 pb-4 pt-safe">
        {/* Top bar: logo | greeting+title | actions */}
        <div className="flex items-center gap-3 pt-3 pb-1">
          <ShopDrawerInner />

          {/* Greeting (compact, inline) */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white leading-tight truncate">
              {greeting()}{me ? `, ${me.name.split(" ")[0]}` : ""} 👋
            </p>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notifications */}
            {me && !isStaff && (
              <span className="[&_button]:bg-transparent [&_button]:hover:bg-white/10 [&_svg]:text-white/80">
                <NotificationsBell enabled={true} variant="home" />
              </span>
            )}

            {/* Staff admin access (kept — required for admin tools) */}
            {me && isStaff && (
              <StaffSidebarTrigger role={me.role as "admin" | "pm"} name={me.name} />
            )}

            {/* Sign in (guests only) */}
            {!me && (
              <Link href="/account">
                <button className="flex h-9 items-center gap-1 rounded-full bg-primary hover:bg-primary/90 px-4 text-[13px] font-semibold text-white transition-colors">
                  Sign in
                </button>
              </Link>
            )}

            {/* Cart */}
            <Link href="/cart">
              <button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/25 hover:border-white/40 transition-colors">
                <ShoppingCart className="h-4 w-4 text-white/80" />
                {cartItemCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-orange-400 text-[9px] font-bold text-white">
                    {cartItemCount > 9 ? "9+" : cartItemCount}
                  </span>
                )}
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Purple card — houses the search bar ─────────────────────────────── */}
      <section className="bg-primary px-4 pt-5 pb-8 rounded-b-[28px] shadow-lg shadow-primary/30">
        <form onSubmit={handleSearch}>
          <div className="flex items-center bg-white/15 focus-within:bg-white/22 rounded-2xl px-4 py-2.5 gap-3 border border-white/20 transition-colors">
            <Search className="h-4 w-4 text-white/60 shrink-0" />
            <input
              type="text"
              placeholder="Search for products..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/60 outline-none"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button type="submit" className="shrink-0 flex h-6 items-center gap-1 rounded-full bg-white/20 px-2.5 text-[11px] font-semibold text-white hover:bg-white/30 transition-colors">
                <Sparkles className="h-3 w-3" /> Ask
              </button>
            )}
          </div>
        </form>
        <p className="text-xs font-semibold text-white/80 leading-tight mt-3 text-center">
          Find your perfect product <span className="text-white">With AI</span>
        </p>
      </section>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto w-full px-4 space-y-6 py-5 pb-12">

        {/* Promo banner */}
        <div className="relative overflow-hidden rounded-2xl bg-[#1e1150] dark:bg-[#160d40] px-5 py-4 shadow-xl">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between mb-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white/90">
                🔥 Limited Time
              </span>
              <p className="text-xl font-extrabold text-white leading-tight">Mega Sale</p>
              <p className="text-xs text-white/70">Up to 60% Off</p>
            </div>
            <div className="text-4xl select-none">🛍️</div>
          </div>

          {/* Quick-nav: 4 icon buttons, inside the card */}
          <div className="relative z-10 grid grid-cols-4 gap-2">
            {([
              { href: "/products",          icon: LayoutGrid, label: "Categories" },
              { href: "/products?sort=sale", icon: Zap,        label: "Flash Sale" },
              { href: "/products?sort=new",  icon: Truck,       label: "Free Ship" },
              { href: "/products?sort=featured", icon: Tag,     label: "Vouchers" },
            ] as const).map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href}>
                <button className="flex flex-col items-center gap-1.5 w-full group">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 group-hover:bg-white/20 transition-colors">
                    <Icon className="h-4 w-4 text-white" />
                  </span>
                  <span className="text-[9px] text-center font-medium text-white/70 leading-tight">
                    {label}
                  </span>
                </button>
              </Link>
            ))}
          </div>
        </div>

        {/* Popular Categories – horizontal scroll, icon pills */}
        {categoryGroups.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Popular Categories</h2>
              <Link href="/products">
                <span className="text-xs font-semibold text-primary hover:underline">See all</span>
              </Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {categoryGroups.map(({ slug, name }, idx) => {
                const Icon = getCategoryIcon(slug);
                const gradient = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                return (
                  <Link key={slug} href={`/products?category=${slug}`}>
                    <button className="flex flex-col items-center gap-1 shrink-0 group">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm group-hover:opacity-90 transition-opacity`}>
                        <Icon className="h-4 w-4 text-white" />
                      </span>
                      <span className="text-[9px] font-medium text-foreground/70 max-w-[44px] text-center leading-tight truncate">
                        {name}
                      </span>
                    </button>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Flash Sale — only shown once admin has configured & enabled one */}
        {flashSaleLive && (
          <div>
            {/* Title + countdown + see-all — all on one line */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h2 className="text-base font-bold flex items-center gap-1 shrink-0">
                  <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" /> Flash Sale
                </h2>
                <span className="text-[10px] text-foreground/55 shrink-0">Ends in</span>
                <div className="flex items-center gap-1">
                  {[h, m, s].map((unit, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="flex h-5 min-w-[22px] items-center justify-center rounded bg-primary text-white text-[10px] font-bold px-1">
                        {unit}
                      </span>
                      {i < 2 && <span className="text-primary font-bold text-[10px] leading-none">:</span>}
                    </span>
                  ))}
                </div>
              </div>
              <Link href="/products?sort=sale">
                <span className="text-xs font-semibold text-primary hover:underline shrink-0 ml-2">See all</span>
              </Link>
            </div>

            {/* Products */}
            {isProductsLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-36 space-y-2">
                    <Skeleton className="h-36 w-36 rounded-2xl" />
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                {saleProducts.map(p => {
                  const pct = discountPct(p) ?? (10 + (p.id % 20));
                  return (
                    <Link key={p.id} href={`/products/${p.id}`}>
                      <div className="relative shrink-0 w-36 group cursor-pointer">
                        <span className="absolute top-2 left-2 z-10 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          -{pct}%
                        </span>
                        <div className="overflow-hidden rounded-2xl bg-muted aspect-square mb-2">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                              <ShoppingCart className="h-8 w-8" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2 mb-0.5">{p.name}</p>
                        <p className="text-sm font-bold text-primary">
                          {p.currency === "NGN" ? "₦" : p.currency}{p.price.toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Category product rows */}
        {categoryGroups.length === 0 && !isProductsLoading ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-base font-medium">No products yet.</p>
            <p className="text-sm mt-1">Add some products in the admin panel to get started.</p>
          </div>
        ) : (
          categoryGroups.map(({ slug, name, products }) => (
            <div key={slug} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold capitalize">{name}</h2>
                <Link href={`/products?category=${slug}`}>
                  <span className="text-xs font-semibold text-primary hover:underline">See all</span>
                </Link>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {products.slice(0, 5).map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
