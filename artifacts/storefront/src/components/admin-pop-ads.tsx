import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Loader2, Eye, EyeOff, X } from "lucide-react";

type PopupAd = {
  enabled: boolean;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  bgColor: string;
};

const DEFAULT: PopupAd = {
  enabled: false,
  title: "",
  body: "",
  ctaText: "Shop Now",
  ctaUrl: "/products",
  imageUrl: "",
  bgColor: "#7c3aed",
};

export function AdminPopAds() {
  const { toast } = useToast();
  const [form, setForm] = useState<PopupAd>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    fetch("/api/admin/popup-ad", { credentials: "include" })
      .then(r => r.json())
      .then((d: PopupAd) => { setForm({ ...DEFAULT, ...d }); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function set<K extends keyof PopupAd>(key: K, value: PopupAd[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/popup-ad", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as PopupAd & { error?: string };
      if (!res.ok) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      setForm({ ...DEFAULT, ...data });
      toast({ title: "Saved!", description: form.enabled ? "Popup is now live on the storefront." : "Popup saved (currently disabled)." });
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function toggleEnabled() {
    const next = !form.enabled;
    set("enabled", next);
    setSaving(true);
    try {
      await fetch("/api/admin/popup-ad", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, enabled: next }),
      });
      toast({ title: next ? "Popup enabled" : "Popup disabled", description: next ? "Visitors will see the popup." : "Popup is hidden from visitors." });
    } finally { setSaving(false); }
  }

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status bar */}
      <div className="flex items-center justify-between rounded-xl border border-border/50 px-5 py-3 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${form.enabled ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
          <span className="text-sm font-medium">{form.enabled ? "Popup is live" : "Popup is disabled"}</span>
        </div>
        <Button size="sm" variant={form.enabled ? "destructive" : "default"} onClick={toggleEnabled} disabled={saving} className="gap-2 h-8 text-xs">
          {form.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {form.enabled ? "Disable" : "Enable"}
        </Button>
      </div>

      <form onSubmit={handleSave}>
        <Card className="p-6 border-border/50 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="pop-title">Headline *</Label>
            <Input id="pop-title" required value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="e.g. 🔥 Limited-Time Offer!" />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="pop-body">Body text *</Label>
            <Textarea id="pop-body" required rows={3} value={form.body} onChange={e => set("body", e.target.value)}
              placeholder="Get 30% off all electronics this weekend only. Don't miss out!" />
          </div>

          {/* CTA row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pop-cta-text">Button label</Label>
              <Input id="pop-cta-text" value={form.ctaText} onChange={e => set("ctaText", e.target.value)} placeholder="Shop Now" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pop-cta-url">Button URL</Label>
              <Input id="pop-cta-url" value={form.ctaUrl} onChange={e => set("ctaUrl", e.target.value)} placeholder="/products" />
            </div>
          </div>

          {/* Image URL */}
          <div className="space-y-1.5">
            <Label htmlFor="pop-img">Banner image URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="pop-img" value={form.imageUrl} onChange={e => set("imageUrl", e.target.value)}
              placeholder="https://…/banner.jpg" />
          </div>

          {/* Accent colour */}
          <div className="flex items-center gap-4">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="pop-color">Accent colour</Label>
              <div className="flex items-center gap-3">
                <input type="color" id="pop-color" value={form.bgColor} onChange={e => set("bgColor", e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-border/50 p-0.5 bg-transparent" />
                <Input value={form.bgColor} onChange={e => set("bgColor", e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
          </div>

          {/* Preview + Save */}
          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPreview(true)} className="gap-2">
              <Eye className="h-4 w-4" /> Preview popup
            </Button>
          </div>
        </Card>
      </form>

      {/* Inline preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPreview(false)}>
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: form.bgColor }}
            onClick={e => e.stopPropagation()}
          >
            <button type="button" onClick={() => setPreview(false)}
              className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white">
              <X className="h-4 w-4" />
            </button>
            {form.imageUrl && (
              <img src={form.imageUrl} alt="banner" className="w-full object-cover max-h-52" onError={e => (e.currentTarget.style.display = "none")} />
            )}
            <div className="p-6 text-white space-y-3">
              {form.title && <h2 className="text-xl font-bold leading-tight">{form.title}</h2>}
              {form.body && <p className="text-white/90 text-sm leading-relaxed">{form.body}</p>}
              {form.ctaText && (
                <div className="pt-1">
                  <span className="inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold" style={{ color: form.bgColor }}>
                    {form.ctaText}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
