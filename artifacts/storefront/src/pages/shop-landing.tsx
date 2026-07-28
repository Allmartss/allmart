import { useRoute, Link } from "wouter";
import { useEffect, useState, useRef } from "react";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Product } from "@workspace/api-client-react";

type LandingPageData = {
  id: number; slug: string; title: string; description: string;
  products: Product[]; createdAt: string;
};

type PageSummary = {
  id: number; slug: string; title: string; description: string;
  productCount: number; createdAt: string;
};

export default function ShopLanding() {
  const [, params] = useRoute("/shop/:slug");
  const slug = params?.slug ?? "";
  const [data, setData] = useState<LandingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [otherPages, setOtherPages] = useState<PageSummary[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setData(null);
    setNotFound(false);

    Promise.all([
      fetch(`/api/landing-pages/${slug}`).then(r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null; }
        return r.json() as Promise<LandingPageData>;
      }),
      fetch("/api/landing-pages").then(r => r.ok ? r.json() as Promise<PageSummary[]> : []),
    ])
      .then(([pageData, allPages]) => {
        if (pageData) { setData(pageData); setLoading(false); }
        setOtherPages((allPages ?? []).filter(p => p.slug !== slug));
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  function scrollCarousel(dir: "left" | "right") {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="container max-w-screen-xl mx-auto py-12 px-6">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-5 w-96 mb-10" />
        <div className="grid grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="container max-w-screen-xl mx-auto py-24 px-6 text-center">
        <h2 className="text-3xl font-serif font-bold mb-4">Page not found</h2>
        <p className="text-muted-foreground mb-8">This collection doesn't exist or has been removed.</p>
        <Link href="/products">
          <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Browse all products</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-screen-xl mx-auto py-12 px-6">
      <Link href="/products">
        <Button variant="ghost" className="mb-6 gap-2 pl-0 hover:bg-transparent hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Browse all products
        </Button>
      </Link>

      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-3">{data.title}</h1>
        {data.description && (
          <p className="text-lg text-muted-foreground max-w-2xl">{data.description}</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">{data.products.length} product{data.products.length === 1 ? "" : "s"} in this collection</p>
      </div>

      {data.products.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-2xl border border-border/50">
          <p className="text-muted-foreground">No products in this collection yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {data.products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Other collections carousel */}
      {otherPages.length > 0 && (
        <div className="mt-16">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-serif text-xl font-bold">More collections</h2>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => scrollCarousel("left")} aria-label="Scroll left">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => scrollCarousel("right")} aria-label="Scroll right">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div
            ref={carouselRef}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-3 snap-x snap-mandatory"
            style={{ scrollbarWidth: "none" }}
          >
            {otherPages.map(page => (
              <Link key={page.id} href={`/shop/${page.slug}`}>
                <div className="snap-start shrink-0 w-64 rounded-2xl border border-border/50 bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">/shop/{page.slug}</span>
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                      {page.productCount} item{page.productCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <h3 className="font-serif font-bold text-base leading-tight group-hover:text-primary transition-colors line-clamp-2">
                    {page.title}
                  </h3>
                  {page.description && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{page.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
