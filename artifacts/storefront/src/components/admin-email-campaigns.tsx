import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Plus, Trash2, ArrowUp, ArrowDown, Loader2, Send, Eye,
  Type, Image as ImageIcon, AlignCenter, Minus, ShoppingBag,
  ChevronRight, FileText, CheckSquare, Square, Users, X, RefreshCw,
  CheckCircle2, MapPin, Link as LinkIcon, Instagram, Twitter, Facebook,
  Youtube, Linkedin, Edit2, RotateCcw, ArrowLeft, ChevronDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductItem = { productId: number; name: string; price: number; imageUrl: string };

type HeaderBlock  = { type: "header"; text: string; size: "h1" | "h2" | "h3"; align: "left"|"center"|"right"; color: string };
type TextBlock    = { type: "text"; text: string };
type ImageBlock   = { type: "image"; url: string; alt: string; link?: string };
type ButtonBlock  = { type: "button"; text: string; url: string; bgColor: string; align: "left"|"center"|"right" };
type DividerBlock = { type: "divider" };
type ProductBlock = { type: "product"; products: ProductItem[] };
type EmailBlock   = HeaderBlock | TextBlock | ImageBlock | ButtonBlock | DividerBlock | ProductBlock;

type CampaignFooter = {
  message: string;
  address: string;
  social: {
    instagram: string;
    twitter: string;
    facebook: string;
    tiktok: string;
    youtube: string;
    linkedin: string;
    whatsapp: string;
  };
  links: { label: string; url: string }[];
  bgColor: string;
  textColor: string;
  headerBgColor?: string;
  headerTextColor?: string;
};

const DEFAULT_FOOTER: CampaignFooter = {
  message: "You received this because you have an account at AllMart.",
  address: "",
  social: { instagram: "", twitter: "", facebook: "", tiktok: "", youtube: "", linkedin: "", whatsapp: "" },
  links: [],
  bgColor: "#f9fafb",
  textColor: "#9ca3af",
  headerBgColor: "#7c3aed",
  headerTextColor: "#ffffff",
};

type Campaign = {
  id: number;
  title: string;
  subject: string;
  headerLogoUrl: string;
  blocks: EmailBlock[];
  footer: CampaignFooter;
  status: "draft" | "sent";
  recipientType: "all" | "selected";
  recipientIds: number[];
  recipientCount: number;
  sentAt: string | null;
  createdAt: string;
};

type User    = { id: number; name: string; email: string };
type Product = { id: number; name: string; price: number; imageUrl: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function blockLabel(b: EmailBlock): string {
  switch (b.type) {
    case "header":  return `Header: ${b.text.slice(0, 40)}`;
    case "text":    return `Text: ${b.text.slice(0, 40)}`;
    case "image":   return `Image: ${b.alt || b.url.slice(0, 30)}`;
    case "button":  return `Button: ${b.text}`;
    case "divider": return "Divider";
    case "product": return b.products.length === 0 ? "Product card (empty)" : `Products: ${b.products.length} selected`;
    default:        return "Block";
  }
}

function blockIcon(type: string) {
  const cls = "h-4 w-4 shrink-0";
  switch (type) {
    case "header":  return <Type className={cls} />;
    case "text":    return <FileText className={cls} />;
    case "image":   return <ImageIcon className={cls} />;
    case "button":  return <AlignCenter className={cls} />;
    case "divider": return <Minus className={cls} />;
    case "product": return <ShoppingBag className={cls} />;
    default:        return <FileText className={cls} />;
  }
}

function defaultBlock(type: EmailBlock["type"]): EmailBlock {
  switch (type) {
    case "header":  return { type: "header", text: "Your Headline Here", size: "h1", align: "center", color: "#111827" };
    case "text":    return { type: "text", text: "Write your message here…" };
    case "image":   return { type: "image", url: "", alt: "", link: "" };
    case "button":  return { type: "button", text: "Shop Now", url: "https://allmarts.us/products", bgColor: "#7c3aed", align: "center" };
    case "divider": return { type: "divider" };
    case "product": return { type: "product", products: [] };
  }
}

// ─── Block editors ───────────────────────────────────────────────────────────

function HeaderEditor({ block, onChange }: { block: HeaderBlock; onChange: (b: HeaderBlock) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Headline text</Label>
        <Input value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} placeholder="Your headline…" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Size</Label>
          <select value={block.size} onChange={e => onChange({ ...block, size: e.target.value as HeaderBlock["size"] })}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="h1">H1 — Large</option>
            <option value="h2">H2 — Medium</option>
            <option value="h3">H3 — Small</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Align</Label>
          <select value={block.align} onChange={e => onChange({ ...block, align: e.target.value as HeaderBlock["align"] })}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Color</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={block.color} onChange={e => onChange({ ...block, color: e.target.value })}
              className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
            <Input value={block.color} onChange={e => onChange({ ...block, color: e.target.value })} className="font-mono text-xs" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TextEditor({ block, onChange }: { block: TextBlock; onChange: (b: TextBlock) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Paragraph text</Label>
      <Textarea rows={4} value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} placeholder="Write your message…" />
    </div>
  );
}

function ImageEditor({ block, onChange }: { block: ImageBlock; onChange: (b: ImageBlock) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Image URL</Label>
        <Input value={block.url} onChange={e => onChange({ ...block, url: e.target.value })} placeholder="https://…/image.jpg" />
      </div>
      {block.url && (
        <img src={block.url} alt={block.alt || "preview"} className="w-full max-h-40 object-cover rounded-lg border border-border/50" onError={e => (e.currentTarget.style.display = "none")} />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Alt text</Label>
          <Input value={block.alt} onChange={e => onChange({ ...block, alt: e.target.value })} placeholder="Describe the image" />
        </div>
        <div className="space-y-1.5">
          <Label>Link URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input value={block.link ?? ""} onChange={e => onChange({ ...block, link: e.target.value })} placeholder="https://…" />
        </div>
      </div>
    </div>
  );
}

function ButtonEditor({ block, onChange }: { block: ButtonBlock; onChange: (b: ButtonBlock) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Button label</Label>
          <Input value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} placeholder="Shop Now" />
        </div>
        <div className="space-y-1.5">
          <Label>Link URL</Label>
          <Input value={block.url} onChange={e => onChange({ ...block, url: e.target.value })} placeholder="https://…" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Align</Label>
          <select value={block.align} onChange={e => onChange({ ...block, align: e.target.value as ButtonBlock["align"] })}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Background color</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={block.bgColor} onChange={e => onChange({ ...block, bgColor: e.target.value })}
              className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
            <Input value={block.bgColor} onChange={e => onChange({ ...block, bgColor: e.target.value })} className="font-mono text-xs" />
          </div>
        </div>
      </div>
      <div className={`pt-1 text-${block.align}`}>
        <span className="inline-block rounded-md px-5 py-2 text-sm font-semibold text-white" style={{ background: block.bgColor }}>
          {block.text || "Button"}
        </span>
      </div>
    </div>
  );
}

function ProductEditor({ block, onChange }: { block: ProductBlock; onChange: (b: ProductBlock) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/products?limit=200", { credentials: "include" })
      .then(r => r.json())
      .then((d: { products?: Product[] } | Product[]) => {
        const list = Array.isArray(d) ? d : (d as { products?: Product[] }).products ?? [];
        setProducts(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedIds = new Set(block.products.map(p => p.productId));

  function toggleProduct(p: Product) {
    if (selectedIds.has(p.id)) {
      onChange({ ...block, products: block.products.filter(item => item.productId !== p.id) });
    } else {
      onChange({ ...block, products: [...block.products, { productId: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl }] });
    }
  }

  function removeSelected(productId: number) {
    onChange({ ...block, products: block.products.filter(item => item.productId !== productId) });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Pick products from your catalog</Label>
        <span className="text-xs text-muted-foreground">{block.products.length} selected</span>
      </div>
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" />
      {loading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Loading products…</div>
      ) : (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/30">
          {filtered.slice(0, 50).map(p => {
            const isSelected = selectedIds.has(p.id);
            return (
              <button key={p.id} type="button"
                onClick={() => toggleProduct(p)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors text-sm ${isSelected ? "bg-violet-50 dark:bg-violet-950/20" : ""}`}
              >
                <img src={p.imageUrl} alt={p.name} className="h-9 w-9 rounded object-cover shrink-0" onError={e => (e.currentTarget.style.display="none")} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-muted-foreground text-xs">${Number(p.price).toFixed(2)}</p>
                </div>
                {isSelected
                  ? <CheckCircle2 className="h-4 w-4 text-violet-500 shrink-0" />
                  : <Square className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                }
              </button>
            );
          })}
          {filtered.length === 0 && <p className="p-3 text-xs text-muted-foreground">No products found</p>}
        </div>
      )}

      {block.products.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Selected ({block.products.length})</p>
          <div className="flex flex-col gap-1.5">
            {block.products.map(item => (
              <div key={item.productId} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2 border border-border/40">
                <img src={item.imageUrl} alt={item.name} className="h-8 w-8 rounded object-cover shrink-0" onError={e => (e.currentTarget.style.display="none")} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-xs truncate">{item.name}</p>
                  <p className="text-muted-foreground text-xs">${Number(item.price).toFixed(2)}</p>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => removeSelected(item.productId)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Block card ───────────────────────────────────────────────────────────────

function BlockCard({
  block, index, total,
  onChange, onDelete, onMoveUp, onMoveDown,
}: {
  block: EmailBlock; index: number; total: number;
  onChange: (b: EmailBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-muted/30 border-b border-border/30">
        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
          {blockIcon(block.type)}
          <span className="text-xs font-medium uppercase tracking-wide hidden sm:inline">{block.type}</span>
        </div>
        <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{blockLabel(block)}</span>
        <div className="flex items-center gap-0.5 sm:gap-1 ml-auto shrink-0">
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" disabled={index === 0} onClick={onMoveUp}><ArrowUp className="h-3 w-3" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" disabled={index === total - 1} onClick={onMoveDown}><ArrowDown className="h-3 w-3" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setExpanded(v => !v)}>
            <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>

      {expanded && (
        <div className="p-4">
          {block.type === "header"  && <HeaderEditor  block={block} onChange={onChange as (b: HeaderBlock) => void} />}
          {block.type === "text"    && <TextEditor    block={block} onChange={onChange as (b: TextBlock) => void} />}
          {block.type === "image"   && <ImageEditor   block={block} onChange={onChange as (b: ImageBlock) => void} />}
          {block.type === "button"  && <ButtonEditor  block={block} onChange={onChange as (b: ButtonBlock) => void} />}
          {block.type === "divider" && <div className="py-2"><hr className="border-border/50" /><p className="text-xs text-center text-muted-foreground mt-2">Horizontal divider line</p></div>}
          {block.type === "product" && <ProductEditor block={block} onChange={onChange as (b: ProductBlock) => void} />}
        </div>
      )}
    </div>
  );
}

// ─── Recipient selector ───────────────────────────────────────────────────────

function RecipientSelector({
  recipientType, recipientIds,
  onChange,
}: {
  recipientType: "all" | "selected";
  recipientIds: number[];
  onChange: (type: "all" | "selected", ids: number[]) => void;
}) {
  const [users, setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/users", { credentials: "include" })
      .then(r => r.json())
      .then((d: User[]) => setUsers(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  function toggleUser(id: number) {
    const next = recipientIds.includes(id) ? recipientIds.filter(i => i !== id) : [...recipientIds, id];
    onChange("selected", next);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["all", "selected"] as const).map(t => (
          <button key={t} type="button"
            onClick={() => onChange(t, recipientIds)}
            className={`flex flex-col items-start gap-1 rounded-xl border p-4 transition-all text-left ${
              recipientType === t
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                : "border-border/50 hover:border-border"
            }`}
          >
            <div className="flex items-center gap-2">
              {recipientType === t ? <CheckSquare className="h-4 w-4 text-violet-500" /> : <Square className="h-4 w-4 text-muted-foreground" />}
              <span className="font-medium text-sm capitalize">{t === "all" ? "All users" : "Selected users"}</span>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {t === "all" ? `Send to every registered account (${users.length})` : `Pick specific users from the list`}
            </p>
          </button>
        ))}
      </div>

      {recipientType === "selected" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Select recipients</Label>
            <span className="text-xs text-muted-foreground">{recipientIds.length} selected</span>
          </div>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" />
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/30">
              {filtered.map(u => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={recipientIds.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="h-4 w-4 accent-violet-600 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </label>
              ))}
              {filtered.length === 0 && <p className="p-3 text-xs text-muted-foreground">No users found</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Preview modal ────────────────────────────────────────────────────────────

function PreviewModal({ campaignId, onClose }: { campaignId: number; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/email-campaigns/${campaignId}/preview`, { credentials: "include" })
      .then(r => r.text())
      .then(setHtml)
      .catch(() => setHtml("<p>Failed to load preview</p>"))
      .finally(() => setLoading(false));
  }, [campaignId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 shrink-0">
          <span className="font-semibold">Email preview</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64 gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Generating preview…</div>
          ) : (
            <iframe
              srcDoc={html ?? ""}
              className="w-full h-full border-0"
              style={{ minHeight: "60vh" }}
              sandbox="allow-same-origin"
              title="Email preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Footer editor ────────────────────────────────────────────────────────────

const SOCIAL_FIELDS: { key: keyof CampaignFooter["social"]; label: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram",  placeholder: "https://instagram.com/yourstore" },
  { key: "twitter",   label: "X / Twitter",placeholder: "https://x.com/yourstore" },
  { key: "facebook",  label: "Facebook",   placeholder: "https://facebook.com/yourstore" },
  { key: "tiktok",    label: "TikTok",     placeholder: "https://tiktok.com/@yourstore" },
  { key: "youtube",   label: "YouTube",    placeholder: "https://youtube.com/@yourstore" },
  { key: "linkedin",  label: "LinkedIn",   placeholder: "https://linkedin.com/company/yourstore" },
  { key: "whatsapp",  label: "WhatsApp",   placeholder: "https://wa.me/1234567890" },
];

function FooterEditor({ footer, onChange, disabled }: {
  footer: CampaignFooter;
  onChange: (f: CampaignFooter) => void;
  disabled?: boolean;
}) {
  function set<K extends keyof CampaignFooter>(key: K, value: CampaignFooter[K]) {
    onChange({ ...footer, [key]: value });
  }
  function setSocial(key: keyof CampaignFooter["social"], value: string) {
    onChange({ ...footer, social: { ...footer.social, [key]: value } });
  }
  function addLink() {
    onChange({ ...footer, links: [...(footer.links ?? []), { label: "", url: "" }] });
  }
  function updateLink(i: number, field: "label" | "url", value: string) {
    const next = [...(footer.links ?? [])];
    next[i] = { ...next[i], [field]: value };
    onChange({ ...footer, links: next });
  }
  function removeLink(i: number) {
    onChange({ ...footer, links: (footer.links ?? []).filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <Label>Footer message / caption</Label>
          <Textarea rows={2} disabled={disabled}
            value={footer.message}
            onChange={e => set("message", e.target.value)}
            placeholder="e.g. © 2024 AllMart. All rights reserved." />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />Business address</Label>
          <Input disabled={disabled}
            value={footer.address}
            onChange={e => set("address", e.target.value)}
            placeholder="e.g. 123 Market St, New York, NY 10001" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Footer background</Label>
          <div className="flex gap-2 items-center">
            <input type="color" disabled={disabled} value={footer.bgColor}
              onChange={e => set("bgColor", e.target.value)}
              className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
            <Input disabled={disabled} value={footer.bgColor}
              onChange={e => set("bgColor", e.target.value)}
              className="font-mono text-xs" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Footer text color</Label>
          <div className="flex gap-2 items-center">
            <input type="color" disabled={disabled} value={footer.textColor}
              onChange={e => set("textColor", e.target.value)}
              className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
            <Input disabled={disabled} value={footer.textColor}
              onChange={e => set("textColor", e.target.value)}
              className="font-mono text-xs" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">Social media handles</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <Input disabled={disabled} value={footer.social?.[key] ?? ""}
                onChange={e => setSocial(key, e.target.value)}
                placeholder={placeholder} className="text-xs h-8" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />Custom links</Label>
          {!disabled && (
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addLink}>
              <Plus className="h-3 w-3" /> Add link
            </Button>
          )}
        </div>
        {(footer.links ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No custom links. Add links like Privacy Policy, Terms, Unsubscribe, etc.</p>
        ) : (
          <div className="space-y-2">
            {(footer.links ?? []).map((link, i) => (
              <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Input disabled={disabled} value={link.label}
                  onChange={e => updateLink(i, "label", e.target.value)}
                  placeholder="Label (e.g. Privacy Policy)" className="text-xs h-8 w-full sm:w-36 sm:shrink-0" />
                <Input disabled={disabled} value={link.url}
                  onChange={e => updateLink(i, "url", e.target.value)}
                  placeholder="https://…" className="text-xs h-8 w-full sm:flex-1" />
                {!disabled && (
                  <Button type="button" size="icon" variant="ghost"
                    className="h-8 w-8 self-end sm:self-auto shrink-0 text-destructive hover:bg-destructive/10"
                    onClick={() => removeLink(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {(Object.values(footer.social ?? {}).some(v => v?.trim()) || (footer.links ?? []).some(l => l.label?.trim())) && (
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Footer preview</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {SOCIAL_FIELDS.filter(({ key }) => footer.social?.[key]?.trim()).map(({ key, label }) => (
              <span key={key} className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">{label}</span>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            {(footer.links ?? []).filter(l => l.label?.trim()).map((l, i) => (
              <span key={i} className="underline text-muted-foreground">{l.label}</span>
            ))}
          </div>
          {footer.address && <p className="text-xs text-muted-foreground">{footer.address}</p>}
          {footer.message && <p className="text-xs text-muted-foreground">{footer.message}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Campaign editor ──────────────────────────────────────────────────────────

const ADD_BLOCK_TYPES: { type: EmailBlock["type"]; label: string }[] = [
  { type: "header",  label: "Header" },
  { type: "text",    label: "Text paragraph" },
  { type: "image",   label: "Image" },
  { type: "button",  label: "CTA button" },
  { type: "divider", label: "Divider" },
  { type: "product", label: "Product card" },
];

function CampaignEditor({
  campaign,
  onSaved,
  onDeleted,
  onBack,
}: {
  campaign: Campaign | null;
  onSaved: (c: Campaign) => void;
  onDeleted: (id: number) => void;
  onBack?: () => void;
}) {
  const { toast } = useToast();

  const [title, setTitle]           = useState(campaign?.title ?? "");
  const [subject, setSubject]       = useState(campaign?.subject ?? "");
  const [blocks, setBlocks]         = useState<EmailBlock[]>(() => {
    // Migrate legacy single-product blocks to new products[] format
    return (campaign?.blocks ?? []).map(b => {
      if (b.type === "product") {
        const pb = b as { type: "product"; products?: ProductItem[]; productId?: number; name?: string; price?: number; imageUrl?: string };
        if (!pb.products) {
          const legacy: ProductItem[] = pb.productId
            ? [{ productId: pb.productId, name: pb.name ?? "", price: pb.price ?? 0, imageUrl: pb.imageUrl ?? "" }]
            : [];
          return { type: "product", products: legacy } as ProductBlock;
        }
      }
      return b;
    });
  });
  const [footer, setFooter]         = useState<CampaignFooter>({ ...DEFAULT_FOOTER, ...(campaign?.footer ?? {}) });
  const [recipientType, setRecipientType] = useState<"all"|"selected">(campaign?.recipientType ?? "all");
  const [recipientIds, setRecipientIds]   = useState<number[]>(campaign?.recipientIds ?? []);

  const [saving, setSaving]     = useState(false);
  const [sending, setSending]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [preview, setPreview]   = useState(false);
  const [footerCollapsed, setFooterCollapsed] = useState(false);

  useEffect(() => {
    setTitle(campaign?.title ?? "");
    setSubject(campaign?.subject ?? "");
    setBlocks((campaign?.blocks ?? []).map(b => {
      if (b.type === "product") {
        const pb = b as { type: "product"; products?: ProductItem[]; productId?: number; name?: string; price?: number; imageUrl?: string };
        if (!pb.products) {
          const legacy: ProductItem[] = pb.productId
            ? [{ productId: pb.productId, name: pb.name ?? "", price: pb.price ?? 0, imageUrl: pb.imageUrl ?? "" }]
            : [];
          return { type: "product", products: legacy } as ProductBlock;
        }
      }
      return b;
    }));
    setFooter({ ...DEFAULT_FOOTER, ...(campaign?.footer ?? {}) });
    setRecipientType(campaign?.recipientType ?? "all");
    setRecipientIds(campaign?.recipientIds ?? []);
  }, [campaign?.id]);

  function updateBlock(index: number, updated: EmailBlock) {
    setBlocks(prev => { const next = [...prev]; next[index] = updated; return next; });
  }
  function deleteBlock(index: number) {
    setBlocks(prev => prev.filter((_, i) => i !== index));
  }
  function moveBlock(index: number, dir: -1 | 1) {
    setBlocks(prev => {
      const next = [...prev];
      const swap = index + dir;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  }
  function addBlock(type: EmailBlock["type"]) {
    setBlocks(prev => [...prev, defaultBlock(type)]);
  }

  async function save() {
    if (!title.trim() || !subject.trim()) {
      toast({ title: "Missing fields", description: "Campaign name and subject line are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const isNew = !campaign;
      const url   = isNew ? "/api/admin/email-campaigns" : `/api/admin/email-campaigns/${campaign.id}`;
      const method = isNew ? "POST" : "PUT";
      const res   = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subject, blocks, footer, recipientType, recipientIds }),
      });
      const data = await res.json() as Campaign & { error?: string };
      if (!res.ok) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      onSaved(data);
      toast({ title: "Saved!", description: "Campaign draft saved." });
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function send() {
    if (!campaign) { toast({ title: "Save first", description: "Save the campaign before sending.", variant: "destructive" }); return; }
    if (blocks.length === 0) { toast({ title: "Empty campaign", description: "Add at least one block.", variant: "destructive" }); return; }
    if (recipientType === "selected" && recipientIds.length === 0) {
      toast({ title: "No recipients", description: "Select at least one recipient.", variant: "destructive" });
      return;
    }
    if (!confirm(`Send "${subject}" to ${recipientType === "all" ? "all users" : `${recipientIds.length} selected user(s)`}?`)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${campaign.id}/send`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json() as { successCount?: number; failCount?: number; campaign?: Campaign; error?: string };
      if (!res.ok) { toast({ title: "Send failed", description: data.error, variant: "destructive" }); return; }
      onSaved(data.campaign!);
      toast({
        title: "Campaign sent! 🚀",
        description: `Delivered to ${data.successCount} recipient(s)${data.failCount ? ` · ${data.failCount} failed` : ""}.`,
      });
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally { setSending(false); }
  }

  async function resend() {
    if (!campaign) return;
    if (!confirm(`Resend "${campaign.subject}" again to ${campaign.recipientType === "all" ? "all users" : `${campaign.recipientIds.length} user(s)`}?`)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${campaign.id}/resend`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json() as { successCount?: number; failCount?: number; campaign?: Campaign; error?: string };
      if (!res.ok) { toast({ title: "Resend failed", description: data.error, variant: "destructive" }); return; }
      onSaved(data.campaign!);
      toast({
        title: "Campaign resent! 🚀",
        description: `Delivered to ${data.successCount} recipient(s)${data.failCount ? ` · ${data.failCount} failed` : ""}.`,
      });
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally { setSending(false); }
  }

  async function reopen() {
    if (!campaign) return;
    if (!confirm("Reopen this campaign for editing? It will be set back to draft.")) return;
    setReopening(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${campaign.id}/reopen`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json() as Campaign & { error?: string };
      if (!res.ok) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      onSaved(data);
      toast({ title: "Reopened", description: "Campaign is now a draft. You can edit and resend." });
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally { setReopening(false); }
  }

  async function deleteCampaign() {
    if (!campaign) return;
    if (!confirm(`Delete "${campaign.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/email-campaigns/${campaign.id}`, { method: "DELETE", credentials: "include" });
      onDeleted(campaign.id);
      toast({ title: "Deleted", description: "Campaign removed." });
    } catch {
      toast({ title: "Error", description: "Could not delete.", variant: "destructive" });
    } finally { setDeleting(false); }
  }

  const isSent = campaign?.status === "sent";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Mobile back button */}
      {onBack && (
        <Button variant="ghost" size="sm" className="gap-2 -ml-1 md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </Button>
      )}

      {/* Status banner for sent campaigns */}
      {isSent && (
        <div className="flex items-start sm:items-center gap-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-green-800 dark:text-green-300">Campaign sent</p>
            <p className="text-xs text-green-700 dark:text-green-400">
              Delivered to {campaign.recipientCount} recipient(s) · {campaign.sentAt ? new Date(campaign.sentAt).toLocaleString() : ""}
            </p>
          </div>
        </div>
      )}

      {/* Campaign setup */}
      <Card className="p-4 sm:p-5 border-border/50 space-y-4">
        <h3 className="font-semibold text-sm">Campaign setup</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ec-title">Campaign name <span className="text-muted-foreground text-xs">(internal)</span></Label>
            <Input id="ec-title" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Summer sale promo" disabled={isSent} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-subject">Email subject line</Label>
            <Input id="ec-subject" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="e.g. 🔥 Huge discounts inside!" disabled={isSent} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">The AllMart logo is included automatically in the email header.</p>

        {/* Header bar color pickers */}
        <div className="space-y-2">
          <Label>Header bar colors</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Background</p>
              <div className="flex gap-2 items-center">
                <input type="color"
                  value={footer.headerBgColor ?? "#7c3aed"}
                  onChange={e => setFooter(f => ({ ...f, headerBgColor: e.target.value }))}
                  disabled={isSent}
                  className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
                <Input
                  value={footer.headerBgColor ?? "#7c3aed"}
                  onChange={e => setFooter(f => ({ ...f, headerBgColor: e.target.value }))}
                  disabled={isSent}
                  className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Text color</p>
              <div className="flex gap-2 items-center">
                <input type="color"
                  value={footer.headerTextColor ?? "#ffffff"}
                  onChange={e => setFooter(f => ({ ...f, headerTextColor: e.target.value }))}
                  disabled={isSent}
                  className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
                <Input
                  value={footer.headerTextColor ?? "#ffffff"}
                  onChange={e => setFooter(f => ({ ...f, headerTextColor: e.target.value }))}
                  disabled={isSent}
                  className="font-mono text-xs" />
              </div>
            </div>
          </div>
          {/* Live preview strip */}
          <div className="rounded-lg overflow-hidden border border-border/40 mt-1">
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ background: footer.headerBgColor ?? "#7c3aed" }}>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#8B7BD8] text-sm font-bold text-white font-serif">A</span>
                <span className="font-bold text-sm" style={{ color: footer.headerTextColor ?? "#ffffff", letterSpacing: "-0.3px" }}>AllMart</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Block builder */}
      <Card className="p-4 sm:p-5 border-border/50 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Email content</h3>
          <span className="text-xs text-muted-foreground">{blocks.length} block{blocks.length !== 1 ? "s" : ""}</span>
        </div>

        {blocks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-dashed border-border/50 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-sm">No content yet</p>
              <p className="text-xs text-muted-foreground">Add blocks below to design your email</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {blocks.map((block, i) => (
            <BlockCard
              key={i} block={block} index={i} total={blocks.length}
              onChange={b => updateBlock(i, b)}
              onDelete={() => deleteBlock(i)}
              onMoveUp={() => moveBlock(i, -1)}
              onMoveDown={() => moveBlock(i, 1)}
            />
          ))}
        </div>

        {!isSent && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">Add a block:</p>
            <div className="flex flex-wrap gap-2">
              {ADD_BLOCK_TYPES.map(({ type, label }) => (
                <Button key={type} type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => addBlock(type)}>
                  {blockIcon(type)}
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Footer — collapsible */}
      <Card className="border-border/50 overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center gap-2 px-4 sm:px-5 py-4 hover:bg-muted/30 transition-colors"
          onClick={() => setFooterCollapsed(v => !v)}
        >
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="font-semibold text-sm">Email footer</h3>
          <span className="text-xs text-muted-foreground ml-1">— shown below every email</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${footerCollapsed ? "" : "rotate-180"}`} />
        </button>
        {!footerCollapsed && (
          <div className="px-4 sm:px-5 pb-5 border-t border-border/30">
            <div className="pt-4">
              <FooterEditor footer={footer} onChange={setFooter} disabled={isSent} />
            </div>
          </div>
        )}
      </Card>

      {/* Recipients */}
      {!isSent && (
        <Card className="p-4 sm:p-5 border-border/50 space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Recipients</h3>
          <RecipientSelector
            recipientType={recipientType}
            recipientIds={recipientIds}
            onChange={(t, ids) => { setRecipientType(t); setRecipientIds(ids); }}
          />
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {!isSent ? (
          <>
            <Button onClick={save} disabled={saving || sending} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save draft"}
            </Button>
            {campaign && (
              <>
                <Button onClick={() => setPreview(true)} variant="outline" className="gap-2" disabled={blocks.length === 0}>
                  <Eye className="h-4 w-4" />
                  <span className="hidden xs:inline">Preview</span>
                </Button>
                <Button onClick={send} disabled={saving || sending || blocks.length === 0}
                  className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="hidden sm:inline">
                    {sending ? "Sending…" : `Send to ${recipientType === "all" ? "all users" : `${recipientIds.length} user(s)`}`}
                  </span>
                  <span className="sm:hidden">{sending ? "Sending…" : "Send"}</span>
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <Button onClick={() => setPreview(true)} variant="outline" className="gap-2">
              <Eye className="h-4 w-4" />
              <span className="hidden xs:inline">Preview</span>
            </Button>
            <Button onClick={reopen} disabled={reopening} variant="outline" className="gap-2">
              {reopening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit2 className="h-4 w-4" />}
              {reopening ? "Reopening…" : "Edit"}
            </Button>
            <Button onClick={resend} disabled={sending} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {sending ? "Sending…" : "Resend"}
            </Button>
          </>
        )}
        {campaign && (
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 gap-1.5 ml-auto" onClick={deleteCampaign} disabled={deleting}>
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Delete</span>
          </Button>
        )}
      </div>

      {preview && campaign && (
        <PreviewModal campaignId={campaign.id} onClose={() => setPreview(false)} />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminEmailCampaigns() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Campaign | null>(null);
  const [isNew, setIsNew]         = useState(false);
  // Mobile: "list" | "editor"
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/email-campaigns", { credentials: "include" })
      .then(r => r.json())
      .then((d: Campaign[]) => { setCampaigns(d); })
      .catch(() => toast({ title: "Failed to load campaigns", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(c: Campaign) {
    setCampaigns(prev => {
      const idx = prev.findIndex(x => x.id === c.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = c; return next; }
      return [c, ...prev];
    });
    setSelected(c);
    setIsNew(false);
  }

  function handleDeleted(id: number) {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    setSelected(null);
    setIsNew(false);
    setMobileView("list");
  }

  function startNew() {
    setSelected(null);
    setIsNew(true);
    setMobileView("editor");
  }

  function selectCampaign(c: Campaign) {
    setSelected(c);
    setIsNew(false);
    setMobileView("editor");
  }

  const showEditor = isNew || selected;

  return (
    <div className="flex flex-col md:flex-row gap-4 sm:gap-6 min-h-[600px]">
      {/* ── Left panel: campaign list ── */}
      <div className={`md:w-72 md:shrink-0 space-y-3 ${mobileView === "editor" && showEditor ? "hidden md:block" : "block"}`}>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={startNew} className="gap-1.5 flex-1 h-9">
            <Plus className="h-4 w-4" /> New campaign
          </Button>
          <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={load} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loading && campaigns.length === 0 ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border/50 p-6 text-center">
            <Mail className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No campaigns yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {campaigns.map(c => (
              <button key={c.id} type="button" onClick={() => selectCampaign(c)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-all group ${
                  selected?.id === c.id && !isNew
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                    : "border-border/50 hover:border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${c.status === "sent" ? "bg-green-500" : "bg-yellow-500"}`} />
                  <p className="font-medium text-sm truncate flex-1">{c.title}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{c.subject}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                    c.status === "sent" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  }`}>
                    {c.status}
                  </span>
                  {c.status === "sent" && (
                    <span className="text-xs text-muted-foreground">{c.recipientCount} sent</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Right panel: editor ── */}
      <div className={`flex-1 min-w-0 ${mobileView === "list" && !showEditor ? "hidden md:flex" : "block"}`}>
        {showEditor ? (
          <CampaignEditor
            campaign={isNew ? null : selected}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
            onBack={() => setMobileView("list")}
          />
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-full min-h-[400px] rounded-2xl border-2 border-dashed border-border/50 text-center p-10">
            <Mail className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg">Email campaigns</h3>
            <p className="text-muted-foreground text-sm max-w-xs mt-1">
              Design promotional emails with content blocks and send them to your users.
            </p>
            <Button className="mt-6 gap-2" onClick={startNew}>
              <Plus className="h-4 w-4" /> Create your first campaign
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
