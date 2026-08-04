import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Palette, Layout, AlignLeft, Plus, Trash2, GripVertical,
  Save, CheckCircle2, RotateCcw, ExternalLink, Paintbrush, ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hexToHslValues, type SiteConfig, type SiteTheme, type HeaderConfig, type FooterConfig, type NavLink } from "@/hooks/use-site-config";

// ── Helpers ────────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function ColorSwatch({ hex }: { hex: string }) {
  return (
    <span
      className="inline-block w-5 h-5 rounded-full border border-border/40 flex-shrink-0"
      style={{ background: hex }}
    />
  );
}

function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded-md border border-border/50 p-0.5 bg-transparent"
        />
      </div>
      <div className="flex-1">
        <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 font-mono text-xs"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// ── Nav Links Editor ─────────────────────────────────────────────────────────
function NavLinksEditor({
  links,
  onChange,
}: { links: NavLink[]; onChange: (links: NavLink[]) => void }) {
  function addLink() {
    onChange([...links, { label: "New Link", href: "/" }]);
  }

  function removeLink(i: number) {
    onChange(links.filter((_, idx) => idx !== i));
  }

  function updateLink(i: number, field: keyof NavLink, value: string) {
    const next = [...links];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  }

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...links];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  }

  function moveDown(i: number) {
    if (i === links.length - 1) return;
    const next = [...links];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <div className="flex flex-col gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => moveUp(i)}
              className="p-0.5 text-muted-foreground hover:text-foreground"
              disabled={i === 0}
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <GripVertical className="h-3 w-3 text-muted-foreground/40 mx-auto" />
            <button
              type="button"
              onClick={() => moveDown(i)}
              className="p-0.5 text-muted-foreground hover:text-foreground"
              disabled={i === links.length - 1}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row flex-1 gap-1.5 min-w-0">
            <Input
              value={link.label}
              onChange={(e) => updateLink(i, "label", e.target.value)}
              className="h-8 text-sm w-full sm:w-28 sm:flex-shrink-0"
              placeholder="Label"
            />
            <Input
              value={link.href}
              onChange={(e) => updateLink(i, "href", e.target.value)}
              className="h-8 text-sm flex-1 font-mono min-w-0"
              placeholder="/path"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10 flex-shrink-0"
            onClick={() => removeLink(i)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed gap-2"
        onClick={addLink}
      >
        <Plus className="h-3.5 w-3.5" /> Add link
      </Button>
    </div>
  );
}

// ── Header Editor ─────────────────────────────────────────────────────────────
function HeaderEditor({ config, onSave }: { config: HeaderConfig; onSave: () => void }) {
  const [form, setForm] = useState<HeaderConfig>(config);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => setForm(config), [config]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-ui/header", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Header saved", description: "Changes will appear on next page load." });
      onSave();
    } catch {
      toast({ title: "Error", description: "Could not save header settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Site name</Label>
          <Input
            value={form.siteName}
            onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
            placeholder="AllMart"
          />
          <p className="text-xs text-muted-foreground">Shown in the browser tab and branding</p>
        </div>
        <div className="space-y-1.5">
          <Label>Tagline</Label>
          <Input
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            placeholder="Shop smarter, live better"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.sticky}
            onChange={(e) => setForm((f) => ({ ...f, sticky: e.target.checked }))}
            className="accent-primary"
          />
          <span className="text-sm">Sticky header</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.showSearch}
            onChange={(e) => setForm((f) => ({ ...f, showSearch: e.target.checked }))}
            className="accent-primary"
          />
          <span className="text-sm">Show search</span>
        </label>
      </div>

      <div className="space-y-2">
        <Label>Navigation links</Label>
        <p className="text-xs text-muted-foreground">These appear in the Shop drawer menu</p>
        <NavLinksEditor
          links={form.navLinks}
          onChange={(links) => setForm((f) => ({ ...f, navLinks: links }))}
        />
      </div>

      <Button onClick={save} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Saving…" : "Save header"}
      </Button>
    </div>
  );
}

// ── Footer Editor ─────────────────────────────────────────────────────────────
function FooterEditor({ config, onSave }: { config: FooterConfig; onSave: () => void }) {
  const [form, setForm] = useState<FooterConfig>(config);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => setForm(config), [config]);

  function addColumn() {
    setForm((f) => ({
      ...f,
      columns: [...f.columns, { title: "New Column", links: [] }],
    }));
  }

  function removeColumn(i: number) {
    setForm((f) => ({ ...f, columns: f.columns.filter((_, idx) => idx !== i) }));
  }

  function updateColumn(i: number, field: string, value: string | NavLink[]) {
    setForm((f) => {
      const cols = [...f.columns];
      cols[i] = { ...cols[i], [field]: value };
      return { ...f, columns: cols };
    });
  }

  function addSocialLink() {
    setForm((f) => ({
      ...f,
      socialLinks: [...f.socialLinks, { platform: "Twitter", url: "" }],
    }));
  }

  function removeSocialLink(i: number) {
    setForm((f) => ({ ...f, socialLinks: f.socialLinks.filter((_, idx) => idx !== i) }));
  }

  function updateSocialLink(i: number, field: "platform" | "url", value: string) {
    setForm((f) => {
      const links = [...f.socialLinks];
      links[i] = { ...links[i], [field]: value };
      return { ...f, socialLinks: links };
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-ui/footer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Footer saved", description: "Changes will appear on next page load." });
      onSave();
    } catch {
      toast({ title: "Error", description: "Could not save footer settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tagline</Label>
          <Input
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            placeholder="Shop smarter, live better."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Copyright text</Label>
          <Input
            value={form.copyrightText}
            onChange={(e) => setForm((f) => ({ ...f, copyrightText: e.target.value }))}
            placeholder="© 2025 AllMart. All rights reserved."
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.showNewsletter}
          onChange={(e) => setForm((f) => ({ ...f, showNewsletter: e.target.checked }))}
          className="accent-primary"
        />
        <span className="text-sm">Show newsletter signup</span>
      </label>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Footer columns</Label>
          <Button type="button" variant="outline" size="sm" onClick={addColumn} className="gap-1.5 h-7 text-xs">
            <Plus className="h-3 w-3" /> Add column
          </Button>
        </div>
        {form.columns.map((col, i) => (
          <Card key={i} className="p-4 space-y-3 border-border/50">
            <div className="flex items-center gap-2">
              <Input
                value={col.title}
                onChange={(e) => updateColumn(i, "title", e.target.value)}
                className="h-8 font-semibold text-sm flex-1"
                placeholder="Column title"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10 flex-shrink-0"
                onClick={() => removeColumn(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <NavLinksEditor
              links={col.links}
              onChange={(links) => updateColumn(i, "links", links)}
            />
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Social links</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSocialLink} className="gap-1.5 h-7 text-xs">
            <Plus className="h-3 w-3" /> Add social
          </Button>
        </div>
        {form.socialLinks.map((s, i) => (
          <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              value={s.platform}
              onChange={(e) => updateSocialLink(i, "platform", e.target.value)}
              className="h-8 text-sm w-full sm:w-28 sm:flex-shrink-0"
              placeholder="Platform"
            />
            <Input
              value={s.url}
              onChange={(e) => updateSocialLink(i, "url", e.target.value)}
              className="h-8 text-sm flex-1 font-mono"
              placeholder="https://twitter.com/..."
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 self-end sm:self-auto text-destructive hover:bg-destructive/10 flex-shrink-0"
              onClick={() => removeSocialLink(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Button onClick={save} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Saving…" : "Save footer"}
      </Button>
    </div>
  );
}

// ── Theme Editor ──────────────────────────────────────────────────────────────
const EMPTY_THEME: SiteTheme = {
  id: "",
  name: "",
  radius: "0.75rem",
  light: {
    primary: "#6d28d9",
    background: "#ffffff",
    foreground: "#1a0a2e",
    accent: "#ede9fe",
    muted: "#f3f0fb",
    border: "#ddd6fe",
  },
  dark: {
    primary: "#a78bfa",
    background: "#130a2e",
    foreground: "#f8fafc",
    accent: "#3b1f6e",
    muted: "#231552",
    border: "#3b2370",
  },
};

function ThemeEditor({
  initialTheme,
  onSave,
  onCancel,
}: {
  initialTheme?: SiteTheme;
  onSave: () => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<SiteTheme>(
    initialTheme ? { ...initialTheme } : { ...EMPTY_THEME, id: uid() }
  );
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function setColor(field: keyof SiteTheme["light"], value: string) {
    setForm((f) => ({
      ...f,
      [mode]: { ...f[mode], [field]: value },
    }));
  }

  const colors = form[mode];

  // Live preview — apply to current page
  function preview() {
    const isDark = document.documentElement.classList.contains("dark");
    const previewColors = form[isDark ? "dark" : "light"];

    function hsl(hex: string) { return hexToHslValues(hex); }
    const root = document.documentElement;
    root.style.setProperty("--primary", hsl(previewColors.primary));
    root.style.setProperty("--background", hsl(previewColors.background));
    root.style.setProperty("--foreground", hsl(previewColors.foreground));
    root.style.setProperty("--accent", hsl(previewColors.accent));
    root.style.setProperty("--muted", hsl(previewColors.muted));
    root.style.setProperty("--border", hsl(previewColors.border));
    root.style.setProperty("--radius", form.radius);
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Please give this theme a name.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-ui/themes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Theme saved", description: `"${form.name}" is ready to activate.` });
      onSave();
    } catch {
      toast({ title: "Error", description: "Could not save theme.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-1.5">
          <Label>Theme name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="My custom theme"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Border radius</Label>
          <select
            value={form.radius}
            onChange={(e) => setForm((f) => ({ ...f, radius: e.target.value }))}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            <option value="0px">None</option>
            <option value="0.25rem">Small</option>
            <option value="0.5rem">Medium</option>
            <option value="0.75rem">Large</option>
            <option value="1rem">XL</option>
            <option value="1.5rem">2XL</option>
          </select>
        </div>
      </div>

      {/* Light / Dark mode tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
        {(["light", "dark"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              mode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Color theme preview strip */}
      <div className="flex gap-2 p-3 rounded-xl border border-border/50">
        {(["background", "primary", "accent", "muted", "foreground", "border"] as const).map((field) => (
          <div key={field} className="flex flex-col items-center gap-1">
            <div
              className="h-8 w-8 rounded-lg border border-border/30 shadow-sm"
              style={{ background: colors[field] }}
            />
            <span className="text-[10px] text-muted-foreground capitalize leading-none">{field}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField label="Primary" value={colors.primary} onChange={(v) => setColor("primary", v)} />
        <ColorField label="Background" value={colors.background} onChange={(v) => setColor("background", v)} />
        <ColorField label="Foreground (text)" value={colors.foreground} onChange={(v) => setColor("foreground", v)} />
        <ColorField label="Accent" value={colors.accent} onChange={(v) => setColor("accent", v)} />
        <ColorField label="Muted" value={colors.muted} onChange={(v) => setColor("muted", v)} />
        <ColorField label="Border" value={colors.border} onChange={(v) => setColor("border", v)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save theme"}
        </Button>
        <Button type="button" variant="outline" onClick={preview} className="gap-2">
          <Paintbrush className="h-4 w-4" /> Preview on page
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Theme Library ─────────────────────────────────────────────────────────────
function ThemeLibrary({
  themes,
  activeThemeId,
  onActivate,
  onEdit,
  onDelete,
  onRefresh,
}: {
  themes: SiteTheme[];
  activeThemeId: string | null;
  onActivate: (id: string) => void;
  onEdit: (theme: SiteTheme) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  async function activate(id: string) {
    setActivating(id);
    try {
      const res = await fetch(`/api/admin/site-ui/themes/${id}/activate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      onActivate(id);
      onRefresh();
      toast({ title: "Theme activated", description: "The new theme is now live." });
    } catch {
      toast({ title: "Error", description: "Could not activate theme.", variant: "destructive" });
    } finally {
      setActivating(null);
    }
  }

  async function deactivate() {
    try {
      await fetch("/api/admin/site-ui/themes/deactivate", {
        method: "POST",
        credentials: "include",
      });
      onRefresh();
      toast({ title: "Theme reset", description: "Reverted to the default theme." });
    } catch {
      toast({ title: "Error", description: "Could not reset theme.", variant: "destructive" });
    }
  }

  async function deleteTheme(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/site-ui/themes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      onDelete(id);
      onRefresh();
      toast({ title: "Theme deleted" });
    } catch {
      toast({ title: "Error", description: "Could not delete theme.", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      {activeThemeId && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            <span>Active: <strong>{themes.find((t) => t.id === activeThemeId)?.name ?? activeThemeId}</strong></span>
          </div>
          <Button variant="ghost" size="sm" onClick={deactivate} className="gap-1.5 text-xs h-7">
            <RotateCcw className="h-3 w-3" /> Reset to default
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => {
          const isActive = theme.id === activeThemeId;
          return (
            <Card
              key={theme.id}
              className={`p-4 space-y-3 transition-all ${
                isActive ? "border-primary ring-1 ring-primary/30 shadow-md" : "border-border/50 hover:border-border"
              }`}
            >
              {/* Color preview */}
              <div className="flex gap-1.5">
                {(["background", "primary", "accent", "muted", "foreground", "border"] as const).map((f) => (
                  <div
                    key={f}
                    className="flex-1 h-6 rounded-md border border-border/20"
                    style={{ background: theme.light[f] }}
                    title={f}
                  />
                ))}
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm leading-tight">{theme.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    radius: {theme.radius}
                  </p>
                </div>
                {isActive && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 shrink-0">
                    Active
                  </Badge>
                )}
              </div>

              {/* Dark preview strip */}
              <div className="flex gap-1 p-2 rounded-md" style={{ background: theme.dark.background }}>
                {(["primary", "accent", "muted", "border"] as const).map((f) => (
                  <div
                    key={f}
                    className="flex-1 h-3 rounded"
                    style={{ background: theme.dark[f] }}
                    title={`dark ${f}`}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                {!isActive ? (
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={() => activate(theme.id)}
                    disabled={activating === theme.id}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {activating === theme.id ? "Applying…" : "Activate"}
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" className="flex-1 h-7 text-xs" disabled>
                    Active
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => onEdit(theme)}
                  title="Edit theme"
                >
                  <Paintbrush className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  onClick={() => deleteTheme(theme.id)}
                  disabled={deleting === theme.id}
                  title="Delete theme"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function AdminSiteUiEditor() {
  const [editingTheme, setEditingTheme] = useState<SiteTheme | null>(null);
  const [creatingTheme, setCreatingTheme] = useState(false);
  const [tab, setTab] = useState("themes");
  const queryClient = useQueryClient();

  const {
    data: config,
    isLoading,
    isError,
    refetch,
  } = useQuery<SiteConfig>({
    queryKey: ["admin-site-ui"],
    queryFn: async () => {
      const res = await fetch("/api/admin/site-ui", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<SiteConfig>;
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 0,
  });

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: ["site-config"] });
    void refetch();
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-muted rounded-xl w-80" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    );
  }

  if (isError || !config) {
    return (
      <div className="flex flex-col items-start gap-3 p-5 rounded-xl border border-destructive/30 bg-destructive/5">
        <p className="text-sm text-destructive font-medium">
          Could not load site UI configuration.
        </p>
        <Button size="sm" variant="outline" onClick={() => void refetch()} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-1 px-1 pb-0.5">
          <TabsList className="h-10 min-w-max w-full sm:w-auto">
            <TabsTrigger value="themes" className="gap-1.5 text-xs sm:text-sm">
              <Palette className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Themes</span>
            </TabsTrigger>
            <TabsTrigger value="create-theme" className="gap-1.5 text-xs sm:text-sm">
              <Paintbrush className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{editingTheme ? "Edit" : "New theme"}</span>
            </TabsTrigger>
            <TabsTrigger value="header" className="gap-1.5 text-xs sm:text-sm">
              <Layout className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Header</span>
            </TabsTrigger>
            <TabsTrigger value="footer" className="gap-1.5 text-xs sm:text-sm">
              <AlignLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Footer</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Themes tab ─────────────────────────────────────────────────── */}
        <TabsContent value="themes" className="mt-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold">Theme library</h3>
              <p className="text-sm text-muted-foreground">
                Pick a theme to apply site-wide colors and border radius
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 shrink-0"
              onClick={() => { setEditingTheme(null); setCreatingTheme(true); setTab("create-theme"); }}
            >
              <Plus className="h-3.5 w-3.5" /> New theme
            </Button>
          </div>
          <ThemeLibrary
            themes={config.themes}
            activeThemeId={config.activeThemeId}
            onActivate={() => refreshAll()}
            onEdit={(theme) => { setEditingTheme(theme); setCreatingTheme(false); setTab("create-theme"); }}
            onDelete={() => refreshAll()}
            onRefresh={refreshAll}
          />
        </TabsContent>

        {/* ── Create / Edit theme tab ────────────────────────────────────── */}
        <TabsContent value="create-theme" className="mt-6">
          <div className="mb-4">
            <h3 className="font-semibold">{editingTheme ? `Edit "${editingTheme.name}"` : "Create a new theme"}</h3>
            <p className="text-sm text-muted-foreground">
              Design your color palette for light and dark mode, then save and activate it
            </p>
          </div>
          <ThemeEditor
            initialTheme={editingTheme ?? undefined}
            onSave={() => { refreshAll(); setTab("themes"); setEditingTheme(null); setCreatingTheme(false); }}
            onCancel={() => { setTab("themes"); setEditingTheme(null); setCreatingTheme(false); }}
          />
        </TabsContent>

        {/* ── Header tab ────────────────────────────────────────────────── */}
        <TabsContent value="header" className="mt-6">
          <div className="mb-4">
            <h3 className="font-semibold">Header editor</h3>
            <p className="text-sm text-muted-foreground">
              Edit the site name, tagline, and navigation links shown in the header
            </p>
          </div>
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
            Changes take effect on the storefront after the next page load
          </div>
          <HeaderEditor config={config.header} onSave={refreshAll} />
        </TabsContent>

        {/* ── Footer tab ────────────────────────────────────────────────── */}
        <TabsContent value="footer" className="mt-6">
          <div className="mb-4">
            <h3 className="font-semibold">Footer editor</h3>
            <p className="text-sm text-muted-foreground">
              Configure footer link columns, social links, and copyright text
            </p>
          </div>
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
            Changes take effect on the storefront after the next page load
          </div>
          <FooterEditor config={config.footer} onSave={refreshAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
