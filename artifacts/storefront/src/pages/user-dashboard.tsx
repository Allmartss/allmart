import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetStorefrontSummary,
  useListProducts,
  useListCategories,
  useGetCurrentUser,
  useGetCart,
  signOut,
  getGetCurrentUserQueryKey,
  getGetCartQueryKey,
  getListOrdersQueryKey,
  getListChatMessagesQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { ProductCard } from "@/components/product-card";
import { SaleCard } from "@/components/sale-card";
import { BagLogo } from "@/components/bag-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffSidebarTrigger } from "@/components/staff-sidebar";
import {
  Sheet, SheetContent, SheetTrigger, SheetClose,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Sparkles, ArrowRight, Zap,
  LayoutGrid, Truck, Tag, Menu, Store,
  Bell, ShoppingCart, Sun, Moon,
  UserCog, Users, Lock, LifeBuoy, LogOut, Package,
  Watch, Mountain, Footprints, Heart, Laptop, Shirt, Dumbbell,
  UtensilsCrossed, BookOpen, Gamepad2, HeartPulse, Plane, PawPrint,
  Gem, Home as HomeIcon, Music2, Car,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

// ── Category icon + colour mapping ────────────────────────────────────────────
type LIcon = React.ElementType;
const CAT_ICONS: Record<string, LIcon> = {
  accessories: Watch,  outdoor: Mountain, shoes: Footprints,
  beauty: Heart,       electronics: Laptop, fashion: Shirt,
  clothing: Shirt,     sports: Dumbbell,  food: UtensilsCrossed,
  books: BookOpen,     gaming: Gamepad2,  health: HeartPulse,
  travel: Plane,       pets: PawPrint,    jewelry: Gem,
  home: HomeIcon,      music: Music2,     automotive: Car,
  cars: Car,           toys: Gamepad2,
};
const CAT_GRADIENTS = [
  "from-pink-500 to-rose-500",    "from-orange-400 to-amber-500",
  "from-emerald-400 to-teal-500", "from-blue-400 to-indigo-500",
  "from-purple-500 to-violet-600","from-cyan-400 to-sky-500",
  "from-red-400 to-orange-500",   "from-green-400 to-emerald-500",
];
function catIcon(slug: string): LIcon {
  return CAT_ICONS[slug.toLowerCase().replace(/[^a-z]/g, "")] ?? LayoutGrid;
}

// ── Shop drawer ───────────────────────────────────────────────────────────────
const SHOP_NAV = [
  { href: "/products",           icon: LayoutGrid, label: "All Products" },
  { href: "/products?sort=sale", icon: Zap,        label: "Flash Sale"   },
  { href: "/products?sort=new",  icon: Tag,         label: "New Arrivals" },
  { href: "/assistant",          icon: Sparkles,    label: "Ask AI"       },
];
function ShopDrawer() {
  const [location] = useLocation();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="h-8 w-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors shrink-0">
          <Menu className="h-4 w-4 text-white" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <div className="bg-primary px-6 py-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg">Shop</p>
            <p className="text-xs text-white/70">Browse AllMart</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {SHOP_NAV.map(({ href, icon: Icon, label }) => {
            const active = location.startsWith(href.split("?")[0]) && href !== "/";
            return (
              <SheetClose asChild key={href}>
                <Link href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${active ? "bg-primary/10 text-primary font-semibold" : "text-foreground/80 hover:bg-muted"}`}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-primary/15" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  </span>
                  {label}
                </Link>
              </SheetClose>
            );
          })}
        </nav>
        <div className="border-t px-4 py-3">
          <SheetClose asChild>
            <Link href="/products">
              <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-2.5 text-sm font-semibold">
                <Search className="h-4 w-4" /> Browse all products
              </button>
            </Link>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Countdown timer ───────────────────────────────────────────────────────────
function Countdown() {
  const end = useRef(Date.now() + 2 * 3_600_000);
  const [left, setLeft] = useState(end.current - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, end.current - Date.now())), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = (ms: number) => String(Math.floor(ms)).padStart(2, "0");
  const h = fmt(left / 3_600_000);
  const m = fmt((left % 3_600_000) / 60_000);
  const s = fmt((left % 60_000) / 1_000);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Ends in</span>
      {[h, m, s].map((u, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="flex h-6 min-w-[26px] items-center justify-center rounded bg-primary px-1.5 text-[11px] font-bold text-white tabular-nums">{u}</span>
          {i < 2 && <span className="text-xs font-bold text-primary">:</span>}
        </span>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UserDashboard() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: meData } = useGetCurrentUser();
  const { data: cart } = useGetCart();
  const { data: categories } = useListCategories();
  const { data: allProducts, isLoading } = useListProducts();
  const { data: summary } = useGetStorefrontSummary();

  const me = meData?.user ?? null;
  const isStaff = me && (me.role === "admin" || me.role === "pm");
  const cartCount = cart?.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const firstName = me ? (me as any).name?.split(" ")[0] ?? "" : "";

  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  };

  async function handleSignOut() {
    await signOut();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() }),
    ]);
    setLocation("/");
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) { sessionStorage.setItem("initial_assistant_query", query); setLocation("/assistant"); }
  };

  // Category groups
  const categoryGroups = (() => {
    if (!allProducts || !categories) return [];
    const map = new Map<string, Product[]>();
    for (const p of allProducts) { const arr = map.get(p.category) ?? []; arr.push(p); map.set(p.category, arr); }
    return categories.filter(c => (map.get(c.slug)?.length ?? 0) > 0).map(c => ({ slug: c.slug, name: c.name, products: map.get(c.slug) ?? [] }));
  })();

  const topCats   = summary?.topCategories ?? [];
  const flashList = (allProducts ?? []).slice(0, 8);

  const discountPct = (p: Product) => {
    const orig = (p as any).originalPrice ?? (p as any).compareAtPrice;
    return orig && orig > p.price ? Math.round(100 - (p.price / orig) * 100) : 10 + (p.id % 20);
  };

  const fmt = (p: Product) =>
    (p.currency === "NGN" ? "₦" : p.currency) + p.price.toLocaleString();

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">

      {/* ── Purple header ── */}
      <section className="bg-primary px-4 pb-4 pt-safe">
        <div className="flex items-center gap-3 pt-3 pb-3">

          {/* App logo — left */}
          <Link href="/home">
            <span className="shrink-0 flex items-center">
              <BagLogo size={34} />
            </span>
          </Link>

          {/* App name — centre */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-extrabold text-white tracking-tight leading-none">AllMart</p>
            <p className="text-[11px] text-white/60 leading-none mt-0.5">Shop Everything</p>
          </div>

          {/* Right actions: brightness → cart → menu */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Brightness toggle */}
            <button onClick={toggleDark} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors">
              {dark ? <Sun className="h-4 w-4 text-white" /> : <Moon className="h-4 w-4 text-white" />}
            </button>

            {/* Cart */}
            <Link href="/cart">
              <button className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors">
                <ShoppingCart className="h-4 w-4 text-white" />
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-orange-400 text-[9px] font-bold text-white">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </button>
            </Link>

            {/* Bell / staff menu */}
            {isStaff ? (
              <StaffSidebarTrigger role={me!.role as "admin" | "pm"} name={me!.name} />
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors">
                    <Bell className="h-4 w-4 text-white" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild><Link href="/profile"       className="flex items-center gap-2 cursor-pointer"><UserCog   className="h-4 w-4" /> Profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/orders"        className="flex items-center gap-2 cursor-pointer"><Package   className="h-4 w-4" /> My Orders</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/referral"      className="flex items-center gap-2 cursor-pointer"><Users     className="h-4 w-4" /> Referrals</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/security"      className="flex items-center gap-2 cursor-pointer"><Lock      className="h-4 w-4" /> Security</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/notifications" className="flex items-center gap-2 cursor-pointer"><Bell      className="h-4 w-4" /> Notifications</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/support"       className="flex items-center gap-2 cursor-pointer"><LifeBuoy  className="h-4 w-4" /> Support</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive gap-2 cursor-pointer">
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Search card with greeting */}
        <div className="rounded-2xl bg-white/10 border border-white/20 px-4 pt-3 pb-2.5">
          <p className="text-sm font-semibold text-white mb-2">
            {greeting()}{firstName ? `, ${firstName}` : ""} 👋
          </p>
          <form onSubmit={handleSearch}>
            <div className="flex items-center bg-white/15 focus-within:bg-white/25 rounded-xl px-3 py-2 gap-2.5 border border-white/10 transition-colors">
              <Search className="h-4 w-4 text-white/50 shrink-0" />
              <input
                type="text"
                placeholder="Search for products..."
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/50 outline-none"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <button type="submit" className="flex h-6 items-center gap-1 rounded-full bg-white/20 px-2.5 text-[11px] font-semibold text-white">
                  <Sparkles className="h-3 w-3" /> Ask
                </button>
              )}
            </div>
          </form>
          <p className="text-[11px] text-white/50 text-center mt-1.5">Find your perfect product <span className="font-semibold text-white/70">With AI</span></p>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="px-4 py-4 space-y-5 pb-12 max-w-screen-xl mx-auto w-full">

        {/* Mega Sale banner — sliding pink/blue/brown gradient */}
        <div
          className="relative overflow-hidden rounded-2xl px-5 py-4 flex items-center justify-between shadow-xl mega-sale-card"
        >
          {/* animated shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 mega-sale-shimmer pointer-events-none" />
          <div className="relative z-10 space-y-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white/90">
              🔥 Limited Time
            </span>
            <p className="text-2xl font-extrabold text-white">Mega Sale</p>
            <p className="text-sm text-white/80">Up to 60% Off</p>
            <button
              onClick={() => setLocation("/products")}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-pink-600 hover:bg-white/90 transition-colors"
            >
              Shop Now <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="relative z-10 text-5xl select-none">🛍️</div>
        </div>

        {/* Quick-nav — 4 dark filled icons, matches mobile */}
        <div className="grid grid-cols-4 gap-3">
          {([
            { href: "/products",           icon: LayoutGrid, label: "Categories" },
            { href: "/products?sort=sale", icon: Zap,        label: "Flash Sale" },
            { href: "/products?sort=new",  icon: Truck,      label: "Free Ship"  },
            { href: "/products",           icon: Tag,        label: "Vouchers"   },
          ] as const).map(({ href, icon: Icon, label }) => (
            <Link key={label} href={href}>
              <button className="flex flex-col items-center gap-2 w-full group">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e1150] dark:bg-[#160d40] group-hover:opacity-80 transition-opacity shadow-sm">
                  <Icon className="h-5 w-5 text-primary" />
                </span>
                <span className="text-[10px] font-medium text-foreground/70 text-center leading-tight">{label}</span>
              </button>
            </Link>
          ))}
        </div>

        {/* Popular Categories — gradient icon tiles, matches mobile */}
        {topCats.length > 0 && (
          <div>
            <div className="mb-3">
              <h5 className="text-base font-bold">Popular Categories</h5>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {topCats.map((cat, i) => {
                const Icon = catIcon(cat.slug);
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

        {/* Flash Sale */}
        {flashList.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" /> Flash Sale
              </h2>
              <Link href="/products?sort=sale">
                <span className="text-xs font-semibold text-primary hover:underline">See all</span>
              </Link>
            </div>
            <div className="mb-3"><Countdown /></div>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {flashList.map(p => (
                <SaleCard key={p.id} product={p} variant="scroll" width={136} />
              ))}
            </div>
          </div>
        )}

        {/* Best Selling — single flat grid, no category grouping */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Best Selling</h2>
            <Link href="/products">
              <span className="text-xs font-semibold text-primary hover:underline cursor-pointer">See all</span>
            </Link>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="aspect-square rounded-xl" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : (allProducts ?? []).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-base font-medium">No products yet.</p>
              <p className="text-sm mt-1">Add products via the admin panel.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {(allProducts ?? []).map(p => <SaleCard key={p.id} product={p} variant="grid" />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
