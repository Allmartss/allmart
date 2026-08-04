import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useListProducts,
  useListCategories,
  useGetCurrentUser,
  useGetCart,
  useGetFlashSale,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Search, Sparkles,
  Store, ShoppingCart, LayoutGrid, Zap, Tag,
  Watch, Mountain, Footprints, Heart, Laptop, Shirt, Dumbbell,
  UtensilsCrossed, BookOpen, Gamepad2, HeartPulse, Plane, PawPrint,
  Gem, Home as HomeIcon, Music2, Car, Sun, Moon,
} from "lucide-react";
import { SaleCard, BestSellingCard } from "@/components/sale-card";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffSidebarTrigger } from "@/components/staff-sidebar";
import { NotificationsBell } from "@/components/notifications-bell";
import { FlashDealsCarousel } from "@/components/flash-deal-card";
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
          className="h-9 w-9 flex items-center justify-center rounded-full overflow-hidden shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0"
          aria-label="Open menu"
        >
          <img src="/images/allmart-logo.jpg" alt="AllMart" className="h-full w-full object-cover" />
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

// ── Total Spend Card ───────────────────────────────────────────────────────────
function TotalSpendCard({
  me,
  userStats,
}: {
  me: any;
  userStats?: { totalSpend: number; bonusBalance: number; pendingAdminBonus: number };
}) {
  return (
    <div
      className="rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm"
      style={{ background: "linear-gradient(135deg, #1e1150 0%, #2d1a7a 100%)" }}
    >
      <div>
        <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-0.5">Total Spend</p>
        <p className="text-2xl font-extrabold text-white leading-tight">
          {me ? `$${(userStats?.totalSpend ?? 0).toFixed(2)}` : "$0.00"}
        </p>
        <p className="text-[11px] text-violet-300/80 mt-0.5">
          Bonus: <span className="font-semibold text-violet-200">{me ? `$${(userStats?.bonusBalance ?? 0).toFixed(2)}` : "$0.00"}</span>
        </p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="text-3xl select-none">🛍️</div>
        <Link href="/referral">
          <span className="text-[10px] font-bold text-violet-300/80 hover:text-violet-200 transition-colors">Vouchers →</span>
        </Link>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: categories } = useListCategories();
  const { data: allProducts, isLoading: isProductsLoading } = useListProducts();
  const { data: meData } = useGetCurrentUser();
  const { data: cart } = useGetCart();
  const { data: flashSale } = useGetFlashSale();
  const me = meData?.user ?? null;

  const { data: userStats } = useQuery<{ totalSpend: number; bonusBalance: number; pendingAdminBonus: number }>({
    queryKey: ["me-stats"],
    queryFn: () => fetch("/api/me/stats", { credentials: "include" }).then(r => r.json()),
    enabled: !!me,
  });
  const isStaff = me && (me.role === "admin" || me.role === "pm");
  const cartItemCount = cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const flashSaleLive = !!flashSale?.enabled && (flashSale?.products?.length ?? 0) > 0;
  const { h, m, s } = useCountdown(flashSaleLive ? flashSale!.endsAt : null);
  const saleProducts = flashSale?.products ?? [];

  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
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

  // Filter pills: All + top categories
  const filterPills = [
    { id: "all", label: "All" },
    ...categoryGroups.slice(0, 5).map(c => ({ id: c.slug, label: c.name })),
  ];

  // Filtered best selling products
  const bestSellingProducts = (() => {
    if (!allProducts) return [];
    if (activeCategory === "all") return allProducts;
    return allProducts.filter(p => p.category === activeCategory);
  })();

  const firstName = me?.name?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#F7F6F3] dark:bg-[#0D0B1A]">

      {/* ── Header ──────────────────────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-[#0B0A14] px-4 pb-3 pt-safe border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3 pt-3">
          {/* Avatar / menu trigger */}
          <ShopDrawerInner />

          {/* Greeting */}
          <div className="flex-1 min-w-0">
            {me ? (
              <>
                <p className="text-[11px] text-foreground/40 dark:text-white/40 font-medium leading-none mb-0.5">Hi, {firstName}</p>
                <p className="text-[11px] text-foreground/60 dark:text-white/50 leading-none">Welcome back</p>
              </>
            ) : (
              <p className="text-[12px] text-foreground/50 dark:text-white/50 font-medium">Welcome to AllMart</p>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            {darkMode && (
              <button
                onClick={toggleDark}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Light mode"
              >
                <Sun className="h-3.5 w-3.5 text-white/70" />
              </button>
            )}

            {me && !isStaff && (
              <span className="[&_button]:bg-transparent [&_button]:hover:bg-black/5 dark:[&_button]:hover:bg-white/10 [&_svg]:text-foreground/60 dark:[&_svg]:text-white/70">
                <NotificationsBell enabled={true} variant="home" />
              </span>
            )}

            {me && isStaff && (
              <StaffSidebarTrigger role={me.role as "admin" | "pm"} name={me.name} />
            )}

            {!me && (
              <Link href="/account">
                <button className="flex h-8 items-center gap-1 rounded-full bg-primary hover:bg-primary/90 px-3 text-[12px] font-semibold text-white transition-colors">
                  Sign in
                </button>
              </Link>
            )}

            {/* Cart */}
            <Link href="/cart">
              <button className="relative flex h-8 w-8 items-center justify-center rounded-full border border-black/10 dark:border-white/20 hover:border-black/20 dark:hover:border-white/40 transition-colors bg-white dark:bg-white/5">
                <ShoppingCart className="h-3.5 w-3.5 text-foreground/60 dark:text-white/70" />
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

      {/* ── Hero: Find Your Perfect Product ─────────────────────────────────────── */}
      <section className="bg-white dark:bg-[#0B0A14] px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h1 className="text-[22px] font-black text-foreground dark:text-white leading-tight tracking-tight">
              Find{" "}
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[18px] font-black text-amber-800 dark:text-amber-300 relative -top-0.5"
                style={{ background: "#E8D9B0" }}
              >
                Your
              </span>
              <br />
              Perfect Product.
            </h1>
          </div>
          {/* Search button */}
          <Link href="/products">
            <button className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-black/5 transition-colors shrink-0">
              <Search className="h-4 w-4 text-foreground/60 dark:text-white/60" />
            </button>
          </Link>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {filterPills.map(pill => (
            <button
              key={pill.id}
              onClick={() => setActiveCategory(pill.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                activeCategory === pill.id
                  ? "bg-foreground dark:bg-white text-white dark:text-black"
                  : "bg-black/6 dark:bg-white/10 text-foreground/70 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/15"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Body ──────────────────────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto w-full px-4 space-y-6 py-5 pb-14">

        {/* Total Spend Card */}
        {me && (
          <TotalSpendCard me={me} userStats={userStats} />
        )}

        {/* Popular Categories */}
        {categoryGroups.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-foreground dark:text-white">Popular Categories</h2>
              <Link href="/products">
                <span className="text-xs font-semibold text-foreground/50 dark:text-white/50 hover:text-foreground dark:hover:text-white transition-colors">View all</span>
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {categoryGroups.map(({ slug, name, products }, idx) => {
                const Icon = getCategoryIcon(slug);
                const gradient = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                // Use the first product image of the category if available
                const firstImg = products.find(p => p.imageUrl)?.imageUrl;
                return (
                  <Link key={slug} href={`/products?category=${slug}`}>
                    <button className="flex flex-col items-center gap-1.5 shrink-0 group">
                      <div className="h-16 w-16 rounded-2xl overflow-hidden bg-muted shadow-sm group-hover:shadow-md transition-shadow">
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
                      <span className="text-[11px] font-medium text-foreground/70 dark:text-white/60 max-w-[64px] text-center leading-tight">
                        {name}
                      </span>
                    </button>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Flash Deals — only when live */}
        {flashSaleLive && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-foreground dark:text-white flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500 fill-amber-500" /> Flash Deals
              </h2>
              <Link href="/products?sort=sale">
                <span className="text-xs font-semibold text-foreground/50 dark:text-white/50 hover:text-foreground dark:hover:text-white transition-colors">View all</span>
              </Link>
            </div>
            <FlashDealsCarousel products={saleProducts} countdown={{ h, m, s }} />
          </div>
        )}

        {/* Best Selling */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-foreground dark:text-white">Best Selling Products</h2>
            <Link href="/products">
              <span className="text-xs font-semibold text-foreground/50 dark:text-white/50 hover:text-foreground dark:hover:text-white transition-colors flex items-center gap-0.5">
                View All Products →
              </span>
            </Link>
          </div>
          {isProductsLoading ? (
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[160px] space-y-2">
                  <Skeleton className="aspect-square rounded-2xl" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-7 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : bestSellingProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm font-medium">No products yet.</p>
              <p className="text-xs mt-1">Add products in the admin panel.</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {bestSellingProducts.map(p => (
                <BestSellingCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
