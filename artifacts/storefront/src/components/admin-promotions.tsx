import { useState, useEffect, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useImageUpload } from "@/hooks/use-image-upload";
import {
  Megaphone, Bell, MousePointerClick, Loader2, Eye, EyeOff,
  Upload, X, Users, User, Search, CheckSquare, Square,
  ArrowLeft, ArrowRight, ArrowDown, ChevronDown, Timer,
  BellRing, Layers,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PopupAd = {
  enabled: boolean;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  bgColor: string;
  popType: "pop" | "slide";
  slideDirection: "left" | "right" | "bottom";
  displayDelay: number;
  autoClose: number;
};

const DEFAULT_POPUP: PopupAd = {
  enabled: false, title: "", body: "", ctaText: "Shop Now", ctaUrl: "/products",
  imageUrl: "", bgColor: "#7c3aed", popType: "pop", slideDirection: "bottom",
  displayDelay: 2, autoClose: 0,
};

type UserRow = { id: number; name: string; email: string };

// ─── Image upload field ────────────────────────────────────────────────────────

function ImageField({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (url: string) => void; hint?: string;
}) {
  const { upload, isUploading, progress, error } = useImageUpload();
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const { servingUrl } = await upload(file); onChange(servingUrl); } catch {}
    e.target.value = "";
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} onChange={e => onChange(e.target.value)}
          placeholder="https://… or upload a file" className="flex-1 min-w-0" />
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}
          disabled={isUploading} className="shrink-0 gap-1.5 h-9 px-3">
          {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{isUploading ? `${progress}%` : "Upload"}</span>
        </Button>
        <input ref={ref} type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" />
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}
            className="shrink-0 h-9 w-9 p-0 text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {isUploading && (
        <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
          <div className="bg-primary h-1 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}
      {value && !isUploading && (
        <img src={value} alt="preview" className="w-full max-h-32 object-cover rounded-lg border border-border/40"
          onError={e => (e.currentTarget.style.display = "none")} />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Popup preview modal ───────────────────────────────────────────────────────

function PopupPreview({ popup, slot, onClose }: { popup: PopupAd; slot: 1 | 2; onClose: () => void }) {
  const isSlide = slot === 1 && popup.popType === "slide";
  const dir = popup.slideDirection;

  const slideClasses = {
    left: "fixed left-0 top-0 h-full w-full max-w-sm",
    right: "fixed right-0 top-0 h-full w-full max-w-sm",
    bottom: "fixed bottom-0 left-0 w-full",
  };

  const inner = (
    <div
      className={`relative overflow-hidden shadow-2xl ${isSlide ? slideClasses[dir] : "w-full max-w-md rounded-2xl"}`}
      style={{ background: popup.bgColor }}
      onClick={e => e.stopPropagation()}
    >
      <button type="button" onClick={onClose}
        className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white">
        <X className="h-4 w-4" />
      </button>
      {popup.imageUrl && (
        <img src={popup.imageUrl} alt="banner" className="w-full object-cover max-h-52"
          onError={e => (e.currentTarget.style.display = "none")} />
      )}
      <div className="p-6 text-white space-y-3">
        {popup.title && <h2 className="text-xl font-bold leading-tight">{popup.title}</h2>}
        {popup.body && <p className="text-white/90 text-sm leading-relaxed">{popup.body}</p>}
        {popup.ctaText && (
          <div className="pt-1">
            <span className="inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold cursor-pointer"
              style={{ color: popup.bgColor }}>
              {popup.ctaText}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      {inner}
    </div>
  );
}

// ─── Popup editor ─────────────────────────────────────────────────────────────

function PopupEditor({ slot, popup, onChange, onSave, saving, onToggle }: {
  slot: 1 | 2;
  popup: PopupAd;
  onChange: (p: PopupAd) => void;
  onSave: () => void;
  saving: boolean;
  onToggle: () => void;
}) {
  const [preview, setPreview] = useState(false);
  function set<K extends keyof PopupAd>(k: K, v: PopupAd[K]) { onChange({ ...popup, [k]: v }); }

  return (
    <div className="space-y-5">
      {preview && <PopupPreview popup={popup} slot={slot} onClose={() => setPreview(false)} />}

      {/* Status bar */}
      <div className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full shrink-0 ${popup.enabled ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
          <span className="text-sm font-medium">{popup.enabled ? "Live on storefront" : "Disabled"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
            onClick={() => setPreview(true)}>
            <Eye className="h-3 w-3" /> Preview
          </Button>
          <Button type="button" size="sm" variant={popup.enabled ? "destructive" : "default"}
            onClick={onToggle} disabled={saving} className="gap-1.5 h-7 text-xs">
            {popup.enabled ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {popup.enabled ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>

      {/* Pop type — slot 1 only */}
      {slot === 1 && (
        <div className="space-y-2">
          <Label>Display style</Label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { val: "pop",   label: "Pop-up",  desc: "Center modal overlay",  Icon: Layers },
              { val: "slide", label: "Slide-in", desc: "Panel slides from edge", Icon: ArrowRight },
            ] as const).map(({ val, label, desc, Icon }) => (
              <button key={val} type="button" onClick={() => set("popType", val)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                  popup.popType === val
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                    : "border-border/50 hover:border-border bg-card"
                }`}>
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${popup.popType === val ? "text-violet-500" : "text-muted-foreground"}`} />
                  <span className={`font-medium text-sm ${popup.popType === val ? "text-violet-700 dark:text-violet-300" : ""}`}>{label}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">{desc}</p>
              </button>
            ))}
          </div>

          {popup.popType === "slide" && (
            <div className="space-y-1.5 mt-1">
              <Label>Slide direction</Label>
              <div className="flex gap-2">
                {([
                  { val: "left",   Icon: ArrowLeft,  label: "Left"   },
                  { val: "right",  Icon: ArrowRight, label: "Right"  },
                  { val: "bottom", Icon: ArrowDown,  label: "Bottom" },
                ] as const).map(({ val, Icon, label }) => (
                  <button key={val} type="button" onClick={() => set("slideDirection", val)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors ${
                      popup.slideDirection === val
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300"
                        : "border-border/50 text-muted-foreground hover:border-border"
                    }`}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timing */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-muted-foreground" />Timing</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Delay before showing (seconds)</p>
            <Input type="number" min={0} max={60} value={popup.displayDelay}
              onChange={e => set("displayDelay", Math.max(0, Number(e.target.value)))}
              placeholder="2" />
            <p className="text-xs text-muted-foreground/70">0 = show immediately</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Auto-close after (seconds)</p>
            <Input type="number" min={0} max={300} value={popup.autoClose}
              onChange={e => set("autoClose", Math.max(0, Number(e.target.value)))}
              placeholder="0" />
            <p className="text-xs text-muted-foreground/70">0 = never auto-close</p>
          </div>
        </div>
      </div>

      {/* Image */}
      <ImageField label="Banner image" value={popup.imageUrl} onChange={v => set("imageUrl", v)}
        hint="Upload a file or paste an image URL" />

      {/* Title */}
      <div className="space-y-1.5">
        <Label>Headline *</Label>
        <Input required value={popup.title} onChange={e => set("title", e.target.value)}
          placeholder="e.g. 🔥 Limited-Time Offer!" />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <Label>Body text *</Label>
        <Textarea required rows={3} value={popup.body} onChange={e => set("body", e.target.value)}
          placeholder="Get 30% off all electronics this weekend only. Don't miss out!" />
      </div>

      {/* CTA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Button label</Label>
          <Input value={popup.ctaText} onChange={e => set("ctaText", e.target.value)} placeholder="Shop Now" />
        </div>
        <div className="space-y-1.5">
          <Label>Button URL</Label>
          <Input value={popup.ctaUrl} onChange={e => set("ctaUrl", e.target.value)} placeholder="/products" />
        </div>
      </div>

      {/* Accent color */}
      <div className="space-y-1.5">
        <Label>Accent colour</Label>
        <div className="flex items-center gap-3">
          <input type="color" value={popup.bgColor} onChange={e => set("bgColor", e.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-border/50 p-0.5 bg-transparent" />
          <Input value={popup.bgColor} onChange={e => set("bgColor", e.target.value)} className="font-mono text-sm" />
        </div>
      </div>

      <Button type="button" onClick={onSave} disabled={saving} className="gap-2 w-full sm:w-auto">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MousePointerClick className="h-4 w-4" />}
        {saving ? "Saving…" : "Save popup"}
      </Button>
    </div>
  );
}

// ─── User picker (shared) ─────────────────────────────────────────────────────

function UserPicker({ mode, selected, onModeChange, onSelectionChange }: {
  mode: "all" | "selected";
  selected: Set<number>;
  onModeChange: (m: "all" | "selected") => void;
  onSelectionChange: (s: Set<number>) => void;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (mode !== "selected" || users.length > 0) return;
    setLoadingUsers(true);
    fetch("/api/admin/users", { credentials: "include" })
      .then(r => r.json())
      .then((d: UserRow[]) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [mode, users.length]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  function toggle(id: number) {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); onSelectionChange(n);
  }
  function toggleAll() {
    if (filtered.length > 0 && filtered.every(u => selected.has(u.id))) onSelectionChange(new Set());
    else onSelectionChange(new Set(filtered.map(u => u.id)));
  }
  const allSelected = filtered.length > 0 && filtered.every(u => selected.has(u.id));

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
        {(["all", "selected"] as const).map(m => (
          <button key={m} type="button" onClick={() => onModeChange(m)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {m === "all" ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            {m === "all" ? "All users" : "Selected users"}
            {m === "selected" && selected.size > 0 && (
              <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {selected.size}
              </span>
            )}
          </button>
        ))}
      </div>

      {mode === "selected" && (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            {search && <button type="button" onClick={() => setSearch("")}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>}
          </div>
          {!loadingUsers && filtered.length > 0 && (
            <button type="button" onClick={toggleAll}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 border-b border-border/40 transition-colors">
              {allSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
              {allSelected ? "Deselect all" : `Select all (${filtered.length})`}
            </button>
          )}
          <div className="max-h-52 overflow-y-auto divide-y divide-border/30">
            {loadingUsers ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
            ) : filtered.map(u => {
              const checked = selected.has(u.id);
              return (
                <button key={u.id} type="button" onClick={() => toggle(u.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors ${checked ? "bg-primary/5" : ""}`}>
                  {checked ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {selected.size > 0 && (
            <div className="px-3 py-2 border-t border-border/40 bg-primary/5 text-xs text-primary font-medium">
              {selected.size} user{selected.size === 1 ? "" : "s"} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Notification sender ──────────────────────────────────────────────────────

function NotificationSender() {
  const { toast } = useToast();
  const [notifType, setNotifType] = useState<"push" | "ad">("push");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "selected" && selected.size === 0) {
      toast({ title: "No users selected", description: "Tick at least one user.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      let fullMessage = message;
      if (notifType === "ad" && link.trim()) fullMessage += `\n\n🔗 ${link.trim()}`;

      const body: { title: string; message: string; imageUrl?: string; userIds?: number[] } = { title, message: fullMessage };
      if (imageUrl.trim()) body.imageUrl = imageUrl.trim();
      if (mode === "selected") body.userIds = [...selected];

      const res = await fetch("/api/admin/notifications/push", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { sent?: number; error?: string };
      if (!res.ok) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      toast({ title: "Notification sent! 🚀", description: `Delivered to ${data.sent} user${data.sent === 1 ? "" : "s"}.` });
      setTitle(""); setMessage(""); setLink(""); setImageUrl("");
      if (mode === "selected") { setSelected(new Set()); }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally { setSending(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Notification type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          { val: "push", label: "Push notification", desc: "Announcement or update", Icon: Bell },
          { val: "ad",   label: "Ad notification",   desc: "Promotional with promo link", Icon: Megaphone },
        ] as const).map(({ val, label, desc, Icon }) => (
          <button key={val} type="button" onClick={() => setNotifType(val)}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
              notifType === val
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                : "border-border/50 hover:border-border bg-card"
            }`}>
            <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${notifType === val ? "text-violet-500" : "text-muted-foreground"}`} />
            <div>
              <p className={`font-medium text-sm ${notifType === val ? "text-violet-700 dark:text-violet-300" : ""}`}>{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Recipients */}
      <UserPicker mode={mode} selected={selected} onModeChange={setMode} onSelectionChange={setSelected} />

      {/* Form */}
      <form onSubmit={handleSend} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Title *</Label>
          <Input required value={title} onChange={e => setTitle(e.target.value)}
            placeholder={notifType === "ad" ? "e.g. 🔥 Flash Sale — 30% off today!" : "e.g. Order update"} />
        </div>
        <div className="space-y-1.5">
          <Label>Message *</Label>
          <Textarea required rows={3} value={message} onChange={e => setMessage(e.target.value)}
            placeholder={notifType === "ad"
              ? "Hurry! Limited-time discount on all electronics. Tap to shop now."
              : "Your order #1234 has been dispatched."} />
        </div>

        {/* Image upload for notification */}
        <ImageField label="Image (optional)" value={imageUrl} onChange={setImageUrl}
          hint="Add a banner image to your notification" />

        {notifType === "ad" && (
          <div className="space-y-1.5">
            <Label>Promo link <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Input type="url" value={link} onChange={e => setLink(e.target.value)}
              placeholder="https://allmarts.us/products" />
            <p className="text-xs text-muted-foreground">Appended to the message so users can tap through.</p>
          </div>
        )}

        <Button type="submit" disabled={sending || (mode === "selected" && selected.size === 0)} className="gap-2 w-full sm:w-auto">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          {sending ? "Sending…" : mode === "all" ? "Send to all users" : selected.size === 0 ? "Select users to send" : `Send to ${selected.size} user${selected.size === 1 ? "" : "s"}`}
        </Button>
      </form>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type MainTab = "popup" | "notifications";
type PopupTab = 1 | 2;

export function AdminPromotions() {
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState<MainTab>("popup");
  const [popupTab, setPopupTab] = useState<PopupTab>(1);
  const [popup1, setPopup1] = useState<PopupAd>({ ...DEFAULT_POPUP });
  const [popup2, setPopup2] = useState<PopupAd>({ ...DEFAULT_POPUP });
  const [loading, setLoading] = useState(true);
  const [saving1, setSaving1] = useState(false);
  const [saving2, setSaving2] = useState(false);

  useEffect(() => {
    fetch("/api/admin/popup-ad", { credentials: "include" })
      .then(r => r.json())
      .then((d: { popup1?: PopupAd; popup2?: PopupAd }) => {
        if (d.popup1) setPopup1({ ...DEFAULT_POPUP, ...d.popup1 });
        if (d.popup2) setPopup2({ ...DEFAULT_POPUP, ...d.popup2 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function savePopup(slot: 1 | 2, data: PopupAd, setSaving: (v: boolean) => void) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/popup-ad/${slot}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await res.json() as PopupAd & { error?: string };
      if (!res.ok) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
      if (slot === 1) setPopup1({ ...DEFAULT_POPUP, ...d });
      else setPopup2({ ...DEFAULT_POPUP, ...d });
      toast({ title: "Saved!", description: data.enabled ? "Popup is now live." : "Popup saved (disabled)." });
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function togglePopup(slot: 1 | 2) {
    const data = slot === 1 ? { ...popup1, enabled: !popup1.enabled } : { ...popup2, enabled: !popup2.enabled };
    if (slot === 1) setPopup1(data); else setPopup2(data);
    const setSaving = slot === 1 ? setSaving1 : setSaving2;
    await savePopup(slot, data, setSaving);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Main tab bar */}
      <div className="flex border-b border-border/50 gap-1 overflow-x-auto scrollbar-hide">
        {([
          { val: "popup",         label: "Pop-up Ads",   Icon: MousePointerClick },
          { val: "notifications", label: "Notifications", Icon: Bell },
        ] as const).map(({ val, label, Icon }) => (
          <button key={val} type="button" onClick={() => setMainTab(val)}
            className={`flex items-center gap-2 shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              mainTab === val
                ? "border-violet-500 text-violet-600 dark:text-violet-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Pop-up Ads tab ── */}
      {mainTab === "popup" && (
        <div className="space-y-5">
          {/* Popup slot selector */}
          <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-3">
            {([1, 2] as const).map(slot => {
              const p = slot === 1 ? popup1 : popup2;
              return (
                <button key={slot} type="button" onClick={() => setPopupTab(slot)}
                  className={`flex flex-col sm:flex-row sm:items-center gap-1.5 rounded-xl border p-3 sm:px-4 sm:py-3 text-left transition-all ${
                    popupTab === slot
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                      : "border-border/50 hover:border-border bg-card"
                  }`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${p.enabled ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                    <span className={`font-medium text-sm ${popupTab === slot ? "text-violet-700 dark:text-violet-300" : ""}`}>
                      Popup {slot}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground sm:ml-1">
                    {p.enabled ? "● Live" : "○ Off"}{slot === 1 ? ` · ${p.popType === "slide" ? `Slide ${p.slideDirection}` : "Pop-up"}` : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active popup editor */}
          <Card className="p-4 sm:p-6 border-border/50">
            <div className="mb-5">
              <h3 className="font-semibold">Popup {popupTab}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {popupTab === 1
                  ? "Primary popup — choose between a centre modal or a slide-in panel."
                  : "Secondary popup — standard center modal."}
              </p>
            </div>
            {popupTab === 1 ? (
              <PopupEditor slot={1} popup={popup1} onChange={setPopup1}
                onSave={() => savePopup(1, popup1, setSaving1)} saving={saving1}
                onToggle={() => togglePopup(1)} />
            ) : (
              <PopupEditor slot={2} popup={popup2} onChange={setPopup2}
                onSave={() => savePopup(2, popup2, setSaving2)} saving={saving2}
                onToggle={() => togglePopup(2)} />
            )}
          </Card>
        </div>
      )}

      {/* ── Notifications tab ── */}
      {mainTab === "notifications" && (
        <Card className="p-4 sm:p-6 border-border/50">
          <div className="mb-5">
            <h3 className="font-semibold">Send notification</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Deliver push or promotional notifications to users instantly.</p>
          </div>
          <NotificationSender />
        </Card>
      )}
    </div>
  );
}
