import { useEffect, useState, useRef } from "react";
import {
  useGetAdminFlashSale,
  useUpdateAdminFlashSale,
  useListProducts,
  getGetFlashSaleQueryKey,
  getGetAdminFlashSaleQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, Check, ArrowRight, ShoppingCart } from "lucide-react";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function discountPct(product: Product): number {
  const orig = (product as any).originalPrice ?? (product as any).compareAtPrice;
  if (!orig || orig <= product.price) return 10 + (product.id % 40);
  return Math.round(100 - (product.price / orig) * 100);
}

// ── Dark flash card (same design as storefront) ────────────────────────────────
function FlashPreviewCard({ product }: { product: Product }) {
  const pct = discountPct(product);
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #1a1506 0%, #2d2208 60%, #3d2f0a 100%)",
        minHeight: "148px",
      }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 80% 50%, rgba(180,130,40,0.18) 0%, transparent 70%)" }}
      />
      <div className="relative z-10 p-4 pr-36 flex flex-col justify-between h-full min-h-[148px]">
        <div>
          <span className="inline-block rounded-full bg-white/10 border border-white/15 px-2.5 py-0.5 text-[9px] font-semibold text-amber-200/80 uppercase tracking-wider mb-2">
            Limited Time Offer
          </span>
          <p className="text-2xl font-black text-white leading-none mb-0.5">
            Up to {pct}% Off
          </p>
          <p className="text-[11px] text-amber-200/60 font-medium mb-1 truncate">{product.name}</p>
          <p className="text-[11px] text-white/40 mb-3">On selected items</p>
        </div>
        <div
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-1.5 text-[11px] font-bold text-black w-fit"
        >
          Shop Now <ArrowRight className="h-3 w-3" />
        </div>
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-36 flex items-end justify-end overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-10 z-10"
          style={{ background: "linear-gradient(to right, #1a1506, transparent)" }}
        />
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover object-center"
            style={{ filter: "brightness(0.92) contrast(1.05)" }}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <ShoppingCart className="h-10 w-10 text-amber-400/40" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-10"
          style={{ background: "linear-gradient(to top, #1a1506, transparent)" }}
        />
      </div>
    </div>
  );
}

// ── Sliding preview carousel ───────────────────────────────────────────────────
function FlashPreviewCarousel({ products }: { products: Product[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [products.length]);

  if (products.length === 0) {
    return (
      <div
        className="rounded-2xl flex items-center justify-center text-center p-8"
        style={{
          background: "linear-gradient(135deg, #1a1506 0%, #2d2208 60%, #3d2f0a 100%)",
          minHeight: "148px",
        }}
      >
        <p className="text-white/30 text-sm font-medium">Select products below<br />to preview the flash deal card</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <FlashPreviewCard product={products[idx]} />
      {products.length > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {products.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${i === idx ? "w-4 h-1.5 bg-amber-500" : "w-1.5 h-1.5 bg-foreground/20"}`}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setIdx(i => (i - 1 + products.length) % products.length)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-xs font-bold text-foreground/70 transition-colors"
            >‹</button>
            <button
              onClick={() => setIdx(i => (i + 1) % products.length)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-xs font-bold text-foreground/70 transition-colors"
            >›</button>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground text-center">
        {idx + 1} of {products.length} product{products.length === 1 ? "" : "s"} — cards rotate on storefront
      </p>
    </div>
  );
}

export function AdminFlashSaleManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useGetAdminFlashSale();
  const { data: allProducts, isLoading: isProductsLoading } = useListProducts();
  const updateMutation = useUpdateAdminFlashSale();

  const [enabled, setEnabled] = useState(false);
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (!config) return;
    setEnabled(config.enabled);
    setEndsAtLocal(toLocalInputValue(config.endsAt));
    setSelectedIds(config.productIds ?? []);
  }, [config]);

  const toggleProduct = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (enabled && !endsAtLocal) {
      toast({ title: "Set a countdown end date/time first", variant: "destructive" });
      return;
    }
    if (enabled && selectedIds.length === 0) {
      toast({ title: "Select at least one product for the flash sale", variant: "destructive" });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        data: {
          enabled,
          endsAt: endsAtLocal ? new Date(endsAtLocal).toISOString() : null,
          productIds: selectedIds,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetFlashSaleQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAdminFlashSaleQueryKey() });
      toast({ title: "Flash sale saved", description: enabled ? "Countdown is now live on the storefront." : "Flash sale is hidden from the storefront." });
    } catch {
      toast({ title: "Failed to save flash sale", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // Selected products for preview
  const selectedProducts = (allProducts ?? []).filter((p: Product) => selectedIds.includes(p.id));

  return (
    <div className="space-y-6">
      {/* Toggle + end time */}
      <Card className="p-6 border-border/50 shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold">Flash sale</h3>
              <p className="text-xs text-muted-foreground">
                The countdown only appears on the storefront when this is enabled.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor="flash-sale-enabled" className="text-sm">
              {enabled ? "Enabled" : "Disabled"}
            </Label>
            <Switch id="flash-sale-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <div className="space-y-1.5 max-w-xs">
          <Label>Countdown ends at</Label>
          <Input
            type="datetime-local"
            value={endsAtLocal}
            onChange={e => setEndsAtLocal(e.target.value)}
          />
        </div>
      </Card>

      {/* Live card preview */}
      <Card className="p-6 border-border/50 shadow-sm space-y-3">
        <div>
          <h3 className="font-semibold text-base mb-0.5">Storefront card preview</h3>
          <p className="text-xs text-muted-foreground">This is how each selected product will appear on the home page, rotating as a carousel.</p>
        </div>
        <FlashPreviewCarousel products={selectedProducts} />
      </Card>

      {/* Product selector */}
      <Card className="p-6 border-border/50 shadow-sm space-y-4">
        <div>
          <h3 className="font-semibold text-base">Select products</h3>
          <p className="text-xs text-muted-foreground">
            {selectedIds.length} product{selectedIds.length === 1 ? "" : "s"} selected
          </p>
        </div>

        {isProductsLoading ? (
          <p className="text-sm text-muted-foreground">Loading products…</p>
        ) : !allProducts || allProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No products yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1">
            {allProducts.map((p: Product) => {
              const checked = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProduct(p.id)}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                    checked ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted"
                  }`}
                >
                  <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden shrink-0">
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.currency === "NGN" ? "₦" : p.currency}{p.price.toLocaleString()}
                    </p>
                  </div>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    checked ? "bg-primary border-primary text-white" : "border-border"
                  }`}>
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
        {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        {updateMutation.isPending ? "Saving…" : "Save flash sale"}
      </Button>
    </div>
  );
}
