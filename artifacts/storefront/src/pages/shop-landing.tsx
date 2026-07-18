import { useRoute, Link } from "wouter";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Product } from "@workspace/api-client-react";

type LandingPageData = {
  id: number; slug: string; title: string; description: string;
  products: Product[]; createdAt: string;
};

export default function ShopLanding() {
  const [, params] = useRoute("/shop/:slug");
  const slug = params?.slug ?? "";
  const [data, setData] = useState<LandingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/landing-pages/${slug}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then(d => { if (d) { setData(d as LandingPageData); setLoading(false); } })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

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
        <div className="grid grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {data.products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
