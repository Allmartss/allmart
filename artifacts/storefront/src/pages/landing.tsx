import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { X, ArrowRight, Search, Sparkles, Send, Zap, ShoppingBag, CheckCircle2 } from "lucide-react";
import {
  useGetStorefrontSummary,
  useListCategories,
  useGetFlashSale,
  useListProducts,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BagLogo } from "@/components/bag-logo";
import { FlashDealsCarousel } from "@/components/flash-deal-card";
import { BestSellingCard } from "@/components/sale-card";
import { Skeleton } from "@/components/ui/skeleton";

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

function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setErrorMsg(data.error ?? "Something went wrong");
        setStatus("error");
      } else {
        setStatus("success");
        setEmail("");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div>
      <h4 className="font-semibold text-sm mb-1.5">Stay Updated</h4>
      <p className="text-sm text-white/60 mb-4">Subscribe to get updates on new products and special offers.</p>
      {status === "success" ? (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/20 border border-green-400/30 px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>You're subscribed! We'll keep you posted.</span>
        </div>
      ) : (
        <form onSubmit={handleSubscribe} className="space-y-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={status === "loading"}
            className="w-full rounded-lg bg-white/10 border border-white/15 px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status === "loading" || !email.trim()}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Send className="h-3.5 w-3.5" />
            {status === "loading" ? "Subscribing…" : "Subscribe"}
          </button>
          {status === "error" && (
            <p className="text-xs text-red-400">{errorMsg}</p>
          )}
        </form>
      )}
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [stickyVisible, setStickyVisible] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const heroSearchRef = useRef<HTMLDivElement>(null);

  const { data: summary } = useGetStorefrontSummary();
  const { data: categories, isLoading: isCategoriesLoading } = useListCategories();
  const { data: flashSale } = useGetFlashSale();
  const { data: allProducts, isLoading: isProductsLoading } = useListProducts();

  const flashLive = !!flashSale?.enabled;
  const { h, m, s, expired } = useCountdown(flashLive ? (flashSale!.endsAt ?? null) : null);
  const showBanner = flashLive && !expired;

  // Show sticky search bar once hero search scrolls out of view
  useEffect(() => {
    const el = heroSearchRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleAskAI = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      sessionStorage.setItem("initial_assistant_query", query);
    }
    setLocation("/account");
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">

      {/* ── Flash Sale sticky countdown banner ── */}
      {showBanner && !bannerDismissed && (
        <div className="sticky top-14 z-50 w-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 shadow-md">
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Close button — left on mobile */}
            <button
              onClick={() => setBannerDismissed(true)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/35 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>

            {/* Centre content */}
            <div className="flex flex-1 items-center justify-center gap-2 flex-wrap min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <Zap className="h-3.5 w-3.5 text-white fill-white" />
                <span className="text-xs font-bold text-white tracking-wide whitespace-nowrap">FLASH SALE</span>
                <span className="text-[11px] text-white/80 whitespace-nowrap">Ends in</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {[h, m, s].map((unit, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="flex h-6 min-w-[24px] items-center justify-center rounded bg-white/20 text-white text-xs font-extrabold px-1 tabular-nums">
                      {unit}
                    </span>
                    {i < 2 && <span className="text-white font-extrabold text-xs leading-none">:</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* Shop now — right */}
            <Link href="/products?sort=sale">
              <span className="shrink-0 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-[11px] font-bold text-white hover:bg-white/30 transition-colors whitespace-nowrap">
                Shop now →
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative px-3 py-24 md:py-32 lg:py-40 overflow-hidden bg-primary rounded-b-[1.5rem]">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/80 pointer-events-none" />

        <div className="container relative z-10 max-w-3xl mx-auto text-center space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/20 px-4 py-1.5 text-sm font-medium text-white">
            <Sparkles className="h-3.5 w-3.5" /> AI-Powered Shopping
          </span>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-tight">
            concierge for{" "}
            <span className="italic text-white/80">everything.</span>
          </h1>

          <p className="text-base md:text-lg text-white/70 max-w-xl mx-auto">
            Tell our AI what you're looking for and we'll find the perfect match.
          </p>

          {/* AI search — observed for sticky trigger */}
          <div ref={heroSearchRef}>
            <form onSubmit={handleAskAI} className="relative max-w-[60%] mx-auto mt-6 group">
              <div className="absolute inset-0 bg-white/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="relative flex items-center bg-white rounded-full p-2 shadow-xl">
                <Search className="h-5 w-5 text-muted-foreground ml-4 shrink-0" />
                <Input
                  type="text"
                  placeholder="Tell me what you need..."
                  className="flex-1 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 px-3 h-12 placeholder:text-muted-foreground/60"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                <Button type="submit" size="lg" className="rounded-full h-11 px-6 font-semibold gap-2 shrink-0">
                  Ask AI <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>

          {/* Trending */}
          {summary?.trendingSearches && summary.trendingSearches.length > 0 && (
            <div className="pt-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-xl mx-auto">
              <span className="text-[10px] text-white/40 shrink-0 font-medium">Trending:</span>
              {summary.trendingSearches.map(term => (
                <button
                  key={term}
                  onClick={() => {
                    sessionStorage.setItem("initial_assistant_query", `I'm looking for ${term}`);
                    setLocation("/account");
                  }}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/70 hover:bg-white/20 transition-all whitespace-nowrap shrink-0"
                >
                  {term}
                </button>
              ))}
            </div>
          )}

          {/* Shop Now button */}
          <div className="pt-2 flex justify-center">
            <Link href="/products">
              <button className="inline-flex items-center gap-2 rounded-full bg-white text-primary font-semibold text-sm px-6 py-2.5 hover:bg-white/90 active:scale-95 transition-all shadow-lg shadow-black/20">
                <ShoppingBag className="h-4 w-4" />
                Shop Now
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Sticky search bar (appears after hero scrolls away) ────────────── */}
      <div
        className={`sticky top-14 z-40 border-b border-border/40 bg-background/95 backdrop-blur transition-all duration-300 ${
          stickyVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="container max-w-2xl mx-auto px-4 py-2">
          <form onSubmit={handleAskAI} className="flex items-center bg-muted rounded-full px-4 py-2 gap-3 border border-border/50">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search with AI..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button type="submit" className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white">
              <Sparkles className="h-3 w-3" /> Ask AI
            </button>
          </form>
        </div>
      </div>


      {/* ── Flash Sale (replaces Featured) ────────────────────────────────── */}
      {flashLive && !expired && (
        <section className="pt-1 pb-5 container max-w-screen-xl mx-auto px-3">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400 fill-amber-400" /> Flash Sale
              </h2>
              <p className="text-muted-foreground mt-0.5 text-sm">Limited time deals — ends soon.</p>
            </div>
            <Link href="/products?sort=sale">
              <Button variant="ghost" className="gap-2 group text-sm text-muted-foreground hover:text-foreground">
                View all <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
          <FlashDealsCarousel
            products={flashSale?.products ?? []}
            countdown={{ h, m, s }}
            colorThemeId={(flashSale as any)?.colorThemeId}
          />
        </section>
      )}

      {/* ── Best Selling Products ─────────────────────────────────────────── */}
      <section className="pt-6 pb-2 container max-w-screen-xl mx-auto px-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Best Selling Products</h2>
          <Link href="/products">
            <Button variant="ghost" className="gap-1 group text-sm text-muted-foreground hover:text-foreground">
              View All Products <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
        {isProductsLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square rounded-2xl" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-7 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : (allProducts ?? []).length === 0 ? null : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {(allProducts ?? []).map(p => (
              <BestSellingCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-[#0d0a1f] text-white mt-4">
        <div className="container max-w-screen-xl mx-auto px-6 pt-10 pb-6">

          {/* Top grid: Brand | [Categories + Quick Links] | Stay Updated */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">

            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <BagLogo size={36} />
                <span className="text-lg font-bold">AllMart</span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                AllMart is an all-in-one marketplace where a single account lets you buy and sell seamlessly connecting quality products, trusted sellers, and smooth shopping anytime, anywhere.
              </p>
              <Link href="/account">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline cursor-pointer">
                  Follow Us<ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
              {/* Social icons */}
              <div className="flex items-center gap-2 pt-1">
                {[
                  { label: "TikTok", svg: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg> },
                  { label: "X", svg: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                  { label: "Telegram", svg: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> },
                  { label: "Instagram", svg: <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg> },
                ].map(({ label, svg }) => (
                  <button key={label} aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                    {svg}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories + Quick Links always side by side */}
            <div className="grid grid-cols-2 gap-6">
              {/* Categories */}
              <div>
                <h4 className="font-semibold text-sm mb-4">Categories</h4>
                <ul className="space-y-2.5 text-sm text-white/60">
                  {(categories ?? []).slice(0, 6).map(cat => (
                    <li key={cat.slug}>
                      <Link href={`/products?category=${cat.slug}`}>
                        <span className="hover:text-white transition-colors cursor-pointer">{cat.name}</span>
                      </Link>
                    </li>
                  ))}
                  {isCategoriesLoading && ["Electronics","Fashion","Home & Living","Beauty","Gift Items"].map(n => (
                    <li key={n} className="text-white/60">{n}</li>
                  ))}
                </ul>
              </div>

              {/* Quick Links */}
              <div>
                <h4 className="font-semibold text-sm mb-4">Quick Links</h4>
                <ul className="space-y-2.5 text-sm text-white/60">
                  {[
                    { label: "Shop", href: "/products" },
                    { label: "My Orders", href: "/orders" },
                    { label: "Become a Seller", href: "/account" },
                    { label: "Help Center", href: "/support" },
                    { label: "Returns & Refunds", href: "/support" },
                  ].map(({ label, href }) => (
                    <li key={label}>
                      <Link href={href}>
                        <span className="hover:text-white transition-colors cursor-pointer">{label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Stay Updated */}
            <SubscribeForm />
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/40">Secure payments powered by trusted providers</p>
            <div className="flex items-center gap-2">
              {["Escrow","Master","Card","Paystack"].map(p => (
                <span key={p} className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/70">{p}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4">
            <p className="text-xs text-white/30">© 2026 AllMart. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link href="/privacy"><span className="text-xs text-white/40 hover:text-white/70 cursor-pointer transition-colors">Privacy Policy</span></Link>
              <Link href="/terms"><span className="text-xs text-white/40 hover:text-white/70 cursor-pointer transition-colors">Terms</span></Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
