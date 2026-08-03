import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Plus, Trash2, ArrowUp, ArrowDown, Loader2, Eye,
  Type, Image as ImageIcon, AlignCenter, Minus,
  ChevronRight, FileText, X, RotateCcw,
  UserPlus, LogIn, ShieldCheck, Package, Bell,
  MapPin, Link as LinkIcon, ChevronDown, Save,
  Info, Hash,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type HeaderBlock  = { type: "header"; text: string; size: "h1"|"h2"|"h3"; align: "left"|"center"|"right"; color: string };
type TextBlock    = { type: "text"; text: string };
type ImageBlock   = { type: "image"; url: string; alt: string; link?: string };
type ButtonBlock  = { type: "button"; text: string; url: string; bgColor: string; align: "left"|"center"|"right" };
type DividerBlock = { type: "divider" };
type EmailBlock   = HeaderBlock | TextBlock | ImageBlock | ButtonBlock | DividerBlock;

type CampaignFooter = {
  message: string; address: string;
  social: { instagram: string; twitter: string; facebook: string; tiktok: string; youtube: string; linkedin: string; whatsapp: string };
  links: { label: string; url: string }[];
  bgColor: string; textColor: string;
  headerBgColor?: string; headerTextColor?: string;
};

type EmailTemplate = {
  subject: string;
  blocks: EmailBlock[];
  footer: CampaignFooter;
  headerLogoUrl: string;
};

type OrderStatusMessages = Record<string, string>;

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

// ─── Template definitions ─────────────────────────────────────────────────────

const TEMPLATE_META: {
  key: string;
  label: string;
  description: string;
  Icon: React.FC<{ className?: string }>;
  vars: { name: string; description: string }[];
  hasStatusMessages?: boolean;
  hasExtraSection?: string;
}[] = [
  {
    key: "welcome",
    label: "Signup welcome",
    description: "Sent when a new user creates an account",
    Icon: UserPlus,
    vars: [
      { name: "{{name}}", description: "Customer's full name" },
      { name: "{{signup_bonus_text}}", description: "Bonus message (empty if no bonus)" },
    ],
  },
  {
    key: "login",
    label: "Login notification",
    description: "Sent on every new sign-in",
    Icon: LogIn,
    vars: [
      { name: "{{name}}", description: "Customer's full name" },
      { name: "{{login_time}}", description: "Date and time of the login" },
    ],
  },
  {
    key: "verification",
    label: "Email verification",
    description: "Sends a 6-digit code to verify the email address",
    Icon: ShieldCheck,
    vars: [
      { name: "{{name}}", description: "Customer's full name" },
      { name: "{{code}}", description: "6-digit verification code" },
    ],
    hasExtraSection: "The verification code box is automatically inserted after your content blocks.",
  },
  {
    key: "order",
    label: "Order status",
    description: "Sent on every order status change",
    Icon: Package,
    vars: [
      { name: "{{name}}", description: "Customer's full name" },
      { name: "{{status_message}}", description: "The status description text" },
      { name: "{{tracking_code}}", description: "Order reference number" },
      { name: "{{order_status}}", description: "Status slug (e.g. dispatched)" },
      { name: "{{order_status_label}}", description: "Status label (e.g. Dispatched)" },
      { name: "{{total}}", description: "Formatted order total" },
      { name: "{{shipping_address}}", description: "Delivery address" },
    ],
    hasStatusMessages: true,
    hasExtraSection: "The order details table is automatically inserted after your content blocks.",
  },
  {
    key: "admin_alert",
    label: "Admin payment alert",
    description: "Sent to the admin when a customer uploads a payment screenshot",
    Icon: Bell,
    vars: [
      { name: "{{tracking_code}}", description: "Order reference number" },
      { name: "{{total}}", description: "Formatted order total" },
      { name: "{{customer_name}}", description: "Customer's full name" },
      { name: "{{customer_email}}", description: "Customer's email address" },
      { name: "{{shipping_address}}", description: "Delivery address" },
    ],
    hasExtraSection: "The order details table and Review button are automatically inserted after your content blocks.",
  },
];

const ORDER_STATUS_LABELS: Record<string, string> = {
  placed: "Order placed",
  confirmed: "Payment confirmed",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_rejected: "Payment rejected",
};

// ─── Block helpers ────────────────────────────────────────────────────────────

function blockLabel(b: EmailBlock): string {
  switch (b.type) {
    case "header":  return `Header: ${b.text.slice(0, 40)}`;
    case "text":    return `Text: ${b.text.slice(0, 40)}`;
    case "image":   return `Image: ${b.alt || b.url.slice(0, 30)}`;
    case "button":  return `Button: ${b.text}`;
    case "divider": return "Divider";
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
  }
}

// ─── Block editors ────────────────────────────────────────────────────────────

function HeaderEditor({ block, onChange }: { block: HeaderBlock; onChange: (b: HeaderBlock) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Headline text</Label>
        <Input value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} placeholder="Your headline…" />
      </div>
      <div className="grid grid-cols-3 gap-3">
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
      <Textarea rows={4} value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} placeholder="Write your message… use {{name}}, {{login_time}}, etc." />
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
        <img src={block.url} alt={block.alt || "preview"} className="w-full max-h-40 object-cover rounded-lg border border-border/50"
          onError={e => (e.currentTarget.style.display = "none")} />
      )}
      <div className="grid grid-cols-2 gap-3">
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Button label</Label>
          <Input value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} placeholder="Shop Now" />
        </div>
        <div className="space-y-1.5">
          <Label>Link URL</Label>
          <Input value={block.url} onChange={e => onChange({ ...block, url: e.target.value })} placeholder="https://…" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
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

// ─── Block card ───────────────────────────────────────────────────────────────

function BlockCard({ block, index, total, onChange, onDelete, onMoveUp, onMoveDown }: {
  block: EmailBlock; index: number; total: number;
  onChange: (b: EmailBlock) => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border/30">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {blockIcon(block.type)}
          <span className="text-xs font-medium uppercase tracking-wide">{block.type}</span>
        </div>
        <span className="text-xs text-muted-foreground truncate flex-1">{blockLabel(block)}</span>
        <div className="flex items-center gap-1 ml-auto">
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" disabled={index === 0} onClick={onMoveUp}><ArrowUp className="h-3 w-3" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" disabled={index === total - 1} onClick={onMoveDown}><ArrowDown className="h-3 w-3" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setExpanded(v => !v)}>
            <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="p-4">
          {block.type === "header"  && <HeaderEditor block={block} onChange={onChange as (b: HeaderBlock) => void} />}
          {block.type === "text"    && <TextEditor   block={block} onChange={onChange as (b: TextBlock) => void} />}
          {block.type === "image"   && <ImageEditor  block={block} onChange={onChange as (b: ImageBlock) => void} />}
          {block.type === "button"  && <ButtonEditor block={block} onChange={onChange as (b: ButtonBlock) => void} />}
          {block.type === "divider" && <div className="py-2"><hr className="border-border/50" /><p className="text-xs text-center text-muted-foreground mt-2">Horizontal divider line</p></div>}
        </div>
      )}
    </div>
  );
}

// ─── Footer editor ────────────────────────────────────────────────────────────

const SOCIAL_FIELDS: { key: keyof CampaignFooter["social"]; label: string; placeholder: string }[] = [
  { key: "instagram", label: "Instagram",   placeholder: "https://instagram.com/yourstore" },
  { key: "twitter",   label: "X / Twitter", placeholder: "https://x.com/yourstore" },
  { key: "facebook",  label: "Facebook",    placeholder: "https://facebook.com/yourstore" },
  { key: "tiktok",    label: "TikTok",      placeholder: "https://tiktok.com/@yourstore" },
  { key: "youtube",   label: "YouTube",     placeholder: "https://youtube.com/@yourstore" },
  { key: "linkedin",  label: "LinkedIn",    placeholder: "https://linkedin.com/company/yourstore" },
  { key: "whatsapp",  label: "WhatsApp",    placeholder: "https://wa.me/1234567890" },
];

function FooterEditor({ footer, onChange }: { footer: CampaignFooter; onChange: (f: CampaignFooter) => void }) {
  function set<K extends keyof CampaignFooter>(key: K, value: CampaignFooter[K]) {
    onChange({ ...footer, [key]: value });
  }
  function setSocial(key: keyof CampaignFooter["social"], value: string) {
    onChange({ ...footer, social: { ...footer.social, [key]: value } });
  }
  function addLink() { onChange({ ...footer, links: [...(footer.links ?? []), { label: "", url: "" }] }); }
  function updateLink(i: number, field: "label"|"url", value: string) {
    const next = [...(footer.links ?? [])]; next[i] = { ...next[i], [field]: value };
    onChange({ ...footer, links: next });
  }
  function removeLink(i: number) { onChange({ ...footer, links: (footer.links ?? []).filter((_, idx) => idx !== i) }); }

  return (
    <div className="space-y-5">
      {/* Header colors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Header background color</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={footer.headerBgColor ?? "#7c3aed"}
              onChange={e => set("headerBgColor" as keyof CampaignFooter, e.target.value)}
              className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
            <Input value={footer.headerBgColor ?? "#7c3aed"}
              onChange={e => set("headerBgColor" as keyof CampaignFooter, e.target.value)}
              className="font-mono text-xs" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Header text color</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={footer.headerTextColor ?? "#ffffff"}
              onChange={e => set("headerTextColor" as keyof CampaignFooter, e.target.value)}
              className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
            <Input value={footer.headerTextColor ?? "#ffffff"}
              onChange={e => set("headerTextColor" as keyof CampaignFooter, e.target.value)}
              className="font-mono text-xs" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Footer message</Label>
        <Textarea rows={2} value={footer.message} onChange={e => set("message", e.target.value)}
          placeholder="e.g. © 2025 AllMart. All rights reserved." />
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />Business address</Label>
        <Input value={footer.address} onChange={e => set("address", e.target.value)} placeholder="e.g. 123 Market St, Lagos, Nigeria" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Footer background</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={footer.bgColor} onChange={e => set("bgColor", e.target.value)}
              className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
            <Input value={footer.bgColor} onChange={e => set("bgColor", e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Footer text color</Label>
          <div className="flex gap-2 items-center">
            <input type="color" value={footer.textColor} onChange={e => set("textColor", e.target.value)}
              className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
            <Input value={footer.textColor} onChange={e => set("textColor", e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Social media handles</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <Input value={footer.social?.[key] ?? ""} onChange={e => setSocial(key, e.target.value)}
                placeholder={placeholder} className="text-xs h-8" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />Custom links</Label>
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addLink}>
            <Plus className="h-3 w-3" /> Add link
          </Button>
        </div>
        {(footer.links ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No custom links — add Privacy Policy, Terms, Unsubscribe, etc.</p>
        ) : (
          <div className="space-y-2">
            {(footer.links ?? []).map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={link.label} onChange={e => updateLink(i, "label", e.target.value)}
                  placeholder="Label" className="text-xs h-8 w-32 shrink-0" />
                <Input value={link.url} onChange={e => updateLink(i, "url", e.target.value)}
                  placeholder="https://…" className="text-xs h-8 flex-1" />
                <Button type="button" size="icon" variant="ghost"
                  className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10" onClick={() => removeLink(i)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Preview modal ────────────────────────────────────────────────────────────

function PreviewModal({ templateKey, templateData, onClose }: {
  templateKey: string;
  templateData: EmailTemplate;
  onClose: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/email-templates/${templateKey}/preview`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(templateData),
    })
      .then(r => r.text())
      .then(setHtml)
      .catch(() => setHtml("<p style='padding:24px'>Failed to generate preview.</p>"))
      .finally(() => setLoading(false));
  }, [templateKey, templateData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 shrink-0">
          <span className="font-semibold">Email preview (sample data)</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64 gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Generating preview…
            </div>
          ) : (
            <iframe srcDoc={html ?? ""} className="w-full border-0" style={{ minHeight: "60vh" }}
              sandbox="allow-same-origin" title="Email preview" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Template editor ──────────────────────────────────────────────────────────

const ADD_BLOCK_TYPES: { type: EmailBlock["type"]; label: string }[] = [
  { type: "header",  label: "Header" },
  { type: "text",    label: "Text paragraph" },
  { type: "image",   label: "Image" },
  { type: "button",  label: "CTA button" },
  { type: "divider", label: "Divider" },
];

type EditorTab = "subject" | "blocks" | "footer";

function TemplateEditor({
  templateKey,
  template,
  statusMessages,
  onChange,
  onStatusMessagesChange,
}: {
  templateKey: string;
  template: EmailTemplate;
  statusMessages: OrderStatusMessages;
  onChange: (t: EmailTemplate) => void;
  onStatusMessagesChange: (sm: OrderStatusMessages) => void;
}) {
  const [tab, setTab] = useState<EditorTab>("subject");
  const [preview, setPreview] = useState(false);
  const [footerCollapsed, setFooterCollapsed] = useState(false);
  const meta = TEMPLATE_META.find(m => m.key === templateKey);

  function setBlocks(blocks: EmailBlock[]) { onChange({ ...template, blocks }); }
  function addBlock(type: EmailBlock["type"]) { setBlocks([...template.blocks, defaultBlock(type)]); }
  function updateBlock(i: number, b: EmailBlock) { const next = [...template.blocks]; next[i] = b; setBlocks(next); }
  function deleteBlock(i: number) { setBlocks(template.blocks.filter((_, idx) => idx !== i)); }
  function moveBlock(i: number, dir: -1 | 1) {
    const next = [...template.blocks];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  }

  return (
    <>
      {preview && (
        <PreviewModal templateKey={templateKey} templateData={template} onClose={() => setPreview(false)} />
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/50 mb-6">
        {(["subject", "blocks", "footer"] as EditorTab[]).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? "border-violet-500 text-violet-600 dark:text-violet-400" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t === "subject" ? "Subject & header" : t}
          </button>
        ))}
        <div className="ml-auto">
          <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setPreview(true)}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
        </div>
      </div>

      {/* Variables help */}
      {meta && meta.vars.length > 0 && (
        <div className="mb-5 rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/40 p-4">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 flex items-center gap-1.5 mb-2">
            <Hash className="h-3.5 w-3.5" />Available variables — use these in your text blocks
          </p>
          <div className="flex flex-wrap gap-2">
            {meta.vars.map(v => (
              <span key={v.name} title={v.description}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-mono text-xs border border-violet-200 dark:border-violet-700/40 cursor-help">
                {v.name}
              </span>
            ))}
          </div>
          {meta.hasExtraSection && (
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 flex items-start gap-1.5">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />{meta.hasExtraSection}
            </p>
          )}
        </div>
      )}

      {/* Subject & Header tab */}
      {tab === "subject" && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Subject line</Label>
            <Input value={template.subject} onChange={e => onChange({ ...template, subject: e.target.value })}
              placeholder="Email subject…" />
            <p className="text-xs text-muted-foreground">You can use variables like <code className="font-mono">{"{{tracking_code}}"}</code> in the subject.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Logo image URL <span className="text-muted-foreground text-xs">(optional — shown in email header bar)</span></Label>
            <Input value={template.headerLogoUrl} onChange={e => onChange({ ...template, headerLogoUrl: e.target.value })}
              placeholder="https://…/logo.png" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Header bar color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={template.footer.headerBgColor ?? "#7c3aed"}
                  onChange={e => onChange({ ...template, footer: { ...template.footer, headerBgColor: e.target.value } })}
                  className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
                <Input value={template.footer.headerBgColor ?? "#7c3aed"}
                  onChange={e => onChange({ ...template, footer: { ...template.footer, headerBgColor: e.target.value } })}
                  className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Header text color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={template.footer.headerTextColor ?? "#ffffff"}
                  onChange={e => onChange({ ...template, footer: { ...template.footer, headerTextColor: e.target.value } })}
                  className="h-9 w-10 rounded border border-input p-0.5 cursor-pointer bg-transparent" />
                <Input value={template.footer.headerTextColor ?? "#ffffff"}
                  onChange={e => onChange({ ...template, footer: { ...template.footer, headerTextColor: e.target.value } })}
                  className="font-mono text-xs" />
              </div>
            </div>
          </div>
          {/* Live header preview */}
          <div className="rounded-xl overflow-hidden border border-border/50">
            <div className="flex items-center justify-between px-6 py-4"
              style={{ background: template.footer.headerBgColor ?? "#7c3aed" }}>
              <span className="font-bold text-lg" style={{ color: template.footer.headerTextColor ?? "#ffffff" }}>AllMart</span>
              {template.headerLogoUrl && (
                <img src={template.headerLogoUrl} alt="Logo" className="max-h-8 max-w-28 object-contain"
                  onError={e => (e.currentTarget.style.display = "none")} />
              )}
            </div>
            <div className="px-6 py-4 bg-white dark:bg-zinc-900 text-sm text-muted-foreground">
              Header preview — your content will appear below this bar.
            </div>
          </div>
        </div>
      )}

      {/* Blocks tab */}
      {tab === "blocks" && (
        <div className="space-y-4">
          {template.blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border-2 border-dashed border-border/50">
              <Mail className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No content blocks yet — add one below.</p>
            </div>
          ) : (
            template.blocks.map((block, i) => (
              <BlockCard key={i} block={block} index={i} total={template.blocks.length}
                onChange={b => updateBlock(i, b)}
                onDelete={() => deleteBlock(i)}
                onMoveUp={() => moveBlock(i, -1)}
                onMoveDown={() => moveBlock(i, 1)} />
            ))
          )}

          {/* Add block buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            {ADD_BLOCK_TYPES.map(({ type, label }) => (
              <Button key={type} type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                onClick={() => addBlock(type)}>
                <Plus className="h-3 w-3" />{label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Footer tab */}
      {tab === "footer" && (
        <div className="space-y-4">
          <button type="button" onClick={() => setFooterCollapsed(v => !v)}
            className="flex w-full items-center justify-between rounded-xl bg-muted/30 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
            Footer settings
            <ChevronDown className={`h-4 w-4 transition-transform ${footerCollapsed ? "" : "rotate-180"}`} />
          </button>
          {!footerCollapsed && <FooterEditor footer={template.footer} onChange={f => onChange({ ...template, footer: f })} />}
        </div>
      )}

      {/* Order status messages (only for order template) */}
      {templateKey === "order" && (
        <div className="mt-8 space-y-4">
          <div>
            <h3 className="font-semibold text-sm">Order status messages</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              These messages replace <code className="font-mono">{"{{status_message}}"}</code> in the email body depending on the order status.
            </p>
          </div>
          <div className="space-y-3">
            {Object.entries(ORDER_STATUS_LABELS).map(([statusKey, statusLabel]) => (
              <div key={statusKey} className="rounded-xl border border-border/50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{statusLabel}</span>
                  <code className="ml-auto text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{statusKey}</code>
                </div>
                <Textarea rows={2}
                  value={statusMessages[statusKey] ?? ""}
                  onChange={e => onStatusMessagesChange({ ...statusMessages, [statusKey]: e.target.value })}
                  placeholder="Status message…" className="text-sm resize-none" />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const EMPTY_TEMPLATE: EmailTemplate = {
  subject: "",
  headerLogoUrl: "",
  blocks: [],
  footer: { ...DEFAULT_FOOTER },
};

export function AdminEmailTemplates() {
  const { toast } = useToast();
  const [selectedKey, setSelectedKey] = useState("welcome");
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [statusMessages, setStatusMessages] = useState<OrderStatusMessages>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json() as Record<string, unknown>;
      const tpls: Record<string, EmailTemplate> = {};
      for (const key of TEMPLATE_META.map(m => m.key)) {
        if (data[key]) tpls[key] = data[key] as EmailTemplate;
      }
      setTemplates(tpls);
      setStatusMessages((data["order_statuses"] as OrderStatusMessages) ?? {});
    } catch {
      toast({ title: "Could not load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const currentTemplate = templates[selectedKey] ?? EMPTY_TEMPLATE;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${selectedKey}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentTemplate),
      });
      if (!res.ok) throw new Error("Save failed");

      // Also save status messages for order template
      if (selectedKey === "order") {
        const res2 = await fetch("/api/admin/email-templates/order_statuses", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(statusMessages),
        });
        if (!res2.ok) throw new Error("Save failed");
      }

      toast({ title: "Template saved" });
    } catch {
      toast({ title: "Failed to save template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Reset this template to the built-in default? Any changes you've saved will be lost.")) return;
    setResetting(true);
    try {
      await fetch(`/api/admin/email-templates/${selectedKey}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (selectedKey === "order") {
        await fetch("/api/admin/email-templates/order_statuses", {
          method: "DELETE",
          credentials: "include",
        });
      }
      await loadAll();
      toast({ title: "Template reset to default" });
    } catch {
      toast({ title: "Failed to reset", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading templates…
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
      {/* Sidebar — template list */}
      <div className="space-y-2">
        {TEMPLATE_META.map(({ key, label, description, Icon }) => (
          <button key={key} type="button" onClick={() => setSelectedKey(key)}
            className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
              selectedKey === key
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20 shadow-sm"
                : "border-border/50 hover:border-border bg-card hover:bg-muted/30"
            }`}>
            <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${selectedKey === key ? "text-violet-500" : "text-muted-foreground"}`} />
            <div className="min-w-0">
              <p className={`font-medium text-sm ${selectedKey === key ? "text-violet-700 dark:text-violet-300" : ""}`}>{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Editor panel */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h2 className="font-semibold">
              {TEMPLATE_META.find(m => m.key === selectedKey)?.label}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {TEMPLATE_META.find(m => m.key === selectedKey)?.description}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
              disabled={resetting} onClick={handleReset}>
              {resetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Reset
            </Button>
            <Button type="button" size="sm" className="gap-1.5 h-8 text-xs"
              disabled={saving} onClick={handleSave}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
          </div>
        </div>

        <TemplateEditor
          key={selectedKey}
          templateKey={selectedKey}
          template={currentTemplate}
          statusMessages={statusMessages}
          onChange={t => setTemplates(prev => ({ ...prev, [selectedKey]: t }))}
          onStatusMessagesChange={setStatusMessages}
        />
      </Card>
    </div>
  );
}
