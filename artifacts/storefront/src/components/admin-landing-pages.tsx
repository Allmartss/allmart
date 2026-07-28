import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2, Plus, ExternalLink, Copy, Pencil } from "lucide-react";
import { useListProducts } from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

type LandingPage = {
  id: number; slug: string; title: string; description: string;
  productIds: number[]; createdAt: string;
};

type FormState = { slug: string; title: string; description: string; productIds: string };

const emptyForm: FormState = { slug: "", title: "", description: "", productIds: "" };

export function AdminLandingPages() {
  const { toast } = useToast();
  const { data: allProducts } = useListProducts();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  // create form
  const [form, setForm] = useState<FormState>(emptyForm);
  const [creating, setCreating] = useState(false);

  // edit dialog
  const [editPage, setEditPage] = useState<LandingPage | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/landing-pages", { credentials: "include" })
      .then(r => r.json()).then(d => { setPages(d as LandingPage[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── helpers ───────────────────────────────────────────────────────────────

  function parseIds(str: string) {
    return str.split(",").map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
  }

  function toggleProduct(id: number, current: string, setter: (v: string) => void) {
    const ids = parseIds(current);
    const updated = ids.includes(id) ? ids.filter(n => n !== id) : [...ids, id];
    setter(updated.join(", "));
  }

  // ── create ────────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const productIds = parseIds(form.productIds);
    if (!form.slug.trim() || !form.title.trim() || productIds.length === 0) {
      toast({ title: "Slug, title, and at least one product required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/landing-pages", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: form.slug.trim(), title: form.title.trim(), description: form.description.trim(), productIds }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast({ title: "Error", description: err.error ?? "Failed to create", variant: "destructive" });
        return;
      }
      const created = await res.json() as LandingPage;
      setPages(prev => [created, ...prev]);
      setForm(emptyForm);
      toast({ title: "Page created!", description: `/shop/${created.slug}` });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setCreating(false); }
  }

  // ── edit ──────────────────────────────────────────────────────────────────

  function openEdit(page: LandingPage) {
    setEditPage(page);
    setEditForm({
      slug: page.slug,
      title: page.title,
      description: page.description ?? "",
      productIds: page.productIds.join(", "),
    });
  }

  async function handleSaveEdit() {
    if (!editPage) return;
    const productIds = parseIds(editForm.productIds);
    if (!editForm.slug.trim() || !editForm.title.trim() || productIds.length === 0) {
      toast({ title: "Slug, title, and at least one product required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/landing-pages/${editPage.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: editForm.slug.trim(), title: editForm.title.trim(), description: editForm.description.trim(), productIds }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast({ title: "Error", description: err.error ?? "Failed to save", variant: "destructive" });
        return;
      }
      const updated = await res.json() as LandingPage;
      setPages(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditPage(null);
      toast({ title: "Page updated!" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  // ── delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: number, slug: string) {
    if (!confirm(`Delete page "${slug}"?`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/admin/landing-pages/${id}`, { method: "DELETE", credentials: "include" });
      setPages(prev => prev.filter(p => p.id !== id));
      toast({ title: "Page deleted" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setDeleting(null); }
  }

  // ── render helpers ────────────────────────────────────────────────────────

  const productOptions = allProducts ?? [];

  function ProductPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const selectedIds = new Set(parseIds(value));
    return (
      <div className="border border-border/50 rounded-xl p-3 max-h-48 overflow-y-auto grid gap-1">
        {productOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading products…</p>
        ) : productOptions.map(p => (
          <label key={p.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 transition-colors">
            <input
              type="checkbox"
              checked={selectedIds.has(p.id)}
              onChange={() => toggleProduct(p.id, value, onChange)}
              className="accent-primary"
            />
            <img src={p.imageUrl} alt="" className="h-8 w-8 rounded object-cover border border-border/30" />
            <span className="text-sm flex-1 truncate">{p.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">{p.category}</span>
          </label>
        ))}
      </div>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  const createSelectedIds = new Set(parseIds(form.productIds));

  return (
    <div className="space-y-6">
      {/* Create form */}
      <Card className="p-6 border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Plus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold">Create landing page</h3>
            <p className="text-xs text-muted-foreground">Pick products and share a unique URL with customers.</p>
          </div>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Slug (URL path)</Label>
              <Input
                placeholder="e.g. black-friday-deals"
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
                required
              />
              {form.slug && <p className="text-xs text-muted-foreground">/shop/{form.slug}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Page title</Label>
              <Input
                placeholder="e.g. Black Friday Deals"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="Short description shown at the top of the page…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Select products ({createSelectedIds.size} selected)</Label>
            <ProductPicker value={form.productIds} onChange={v => setForm(f => ({ ...f, productIds: v }))} />
          </div>
          <Button type="submit" disabled={creating || createSelectedIds.size === 0} className="gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating ? "Creating…" : "Create page"}
          </Button>
        </form>
      </Card>

      {/* Pages list */}
      <div className="space-y-3">
        <h3 className="font-semibold text-base">Landing pages</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No landing pages yet.</p>
        ) : (
          pages.map(page => (
            <Card key={page.id} className="flex items-center gap-4 p-4 border-border/50">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{page.title}</p>
                <p className="text-xs text-muted-foreground font-mono">/shop/{page.slug}</p>
                <p className="text-xs text-muted-foreground">{page.productIds.length} product{page.productIds.length === 1 ? "" : "s"}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm" variant="outline" className="h-8 gap-1.5"
                  onClick={() => window.open(`/shop/${page.slug}`, "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View
                </Button>
                <Button
                  size="sm" variant="outline" className="h-8 w-8 p-0"
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/shop/${page.slug}`); toast({ title: "Link copied!" }); }}
                  title="Copy link"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm" variant="outline" className="h-8 w-8 p-0"
                  onClick={() => openEdit(page)}
                  title="Edit page"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm" variant="destructive" className="h-8 w-8 p-0"
                  onClick={() => handleDelete(page.id, page.slug)}
                  disabled={deleting === page.id}
                >
                  {deleting === page.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editPage} onOpenChange={o => { if (!o) setEditPage(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit landing page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Slug (URL path)</Label>
                <Input
                  value={editForm.slug}
                  onChange={e => setEditForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
                />
                {editForm.slug && <p className="text-xs text-muted-foreground">/shop/{editForm.slug}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Page title</Label>
                <Input
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Products ({parseIds(editForm.productIds).length} selected)</Label>
              <ProductPicker value={editForm.productIds} onChange={v => setEditForm(f => ({ ...f, productIds: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditPage(null)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving || parseIds(editForm.productIds).length === 0} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
