import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetStorefrontSummary,
  useListCategories,
  useListProducts,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { BagLogo } from "@/components/bag-logo";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { FeaturedCarousel } from "@/components/featured-carousel";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [stickyVisible, setStickyVisible] = useState(false);
  const heroSearchRef = useRef<HTMLDivElement>(null);

  const { data: summary, isLoading: isSummaryLoading } = useGetStorefrontSummary();
  const { data: categories, isLoading: isCategoriesLoading } = useListCategories();
  const { data: allProducts, isLoading: isProductsLoading } = useListProducts();

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

  // Products NOT in the featured list, to show as "More products"
  const featuredIds = new Set((summary?.featured ?? []).map(p => p.id));
  const otherProducts = (allProducts ?? []).filter(p => !featuredIds.has(p.id));

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative px-6 py-24 md:py-32 lg:py-40 overflow-hidden bg-primary rounded-b-[2.5rem]">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/80 pointer-events-none" />

        <div className="container relative z-10 max-w-3xl mx-auto text-center space-y-6">
          <div className="flex justify-center">
            <BagLogo size={72} />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/20 px-4 py-1.5 text-sm font-medium text-white">
            <Sparkles className="h-3.5 w-3.5" /> AI-Powered Shopping
          </span>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-tight">
            Your personal concierge for{" "}
            <span className="italic text-white/80">everything.</span>
          </h1>

          <p className="text-base md:text-lg text-white/70 max-w-xl mx-auto">
            Tell our AI what you're looking for and we'll find the perfect match.
          </p>

          {/* AI search — observed for sticky trigger */}
          <div ref={heroSearchRef}>
            <form onSubmit={handleAskAI} className="relative max-w-2xl mx-auto mt-6 group">
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

      {/* ── Featured Carousel ─────────────────────────────────────────────── */}
      <section className="pt-6 pb-10 container max-w-screen-xl mx-auto px-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Featured</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">Handpicked products, updated regularly.</p>
          </div>
          <Link href="/account">
            <Button variant="ghost" className="gap-2 group text-sm">
              View all <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
        <FeaturedCarousel />
      </section>

      {/* ── All Products ──────────────────────────────────────────────────── */}
      {(otherProducts.length > 0 || isProductsLoading) && (
        <section className="pb-12 container max-w-screen-xl mx-auto px-6">
          <div className="flex items-end justify-between mb-5">
            <h2 className="text-xl font-bold tracking-tight">All products</h2>
            <Link href="/account">
              <Button variant="ghost" className="gap-2 group text-sm">
                View all <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
          {isProductsLoading ? (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-xl" />
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3.5 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {otherProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Sign-in nudge ─────────────────────────────────────────────────── */}
      <section className="py-12 bg-primary/5 border-t border-border/40">
        <div className="container max-w-screen-xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold">Ready to shop?</h3>
            <p className="text-muted-foreground text-sm mt-1">Sign in to add items to your cart, track orders, and chat with AI.</p>
          </div>
          <Link href="/account">
            <Button size="lg" className="rounded-full gap-2 shrink-0">
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
