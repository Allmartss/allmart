import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Loader2, Users, User, Search, CheckSquare, Square, X } from "lucide-react";

type UserRow = { id: number; name: string; email: string };

export function AdminAdNotifications() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"all" | "selected">("all");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (mode !== "selected" || users.length > 0) return;
    setLoadingUsers(true);
    fetch("/api/admin/users", { credentials: "include" })
      .then(r => r.json())
      .then((data: UserRow[]) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [mode, users.length]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  function toggleUser(id: number) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set());
    else setSelected(new Set(filtered.map(u => u.id)));
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "selected" && selected.size === 0) {
      toast({ title: "No users selected", description: "Tick at least one user.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      // Append link to message if provided
      const fullMessage = link.trim() ? `${message}\n\n🔗 ${link.trim()}` : message;
      const body: { title: string; message: string; userIds?: number[] } = { title, message: fullMessage };
      if (mode === "selected") body.userIds = [...selected];

      const res = await fetch("/api/admin/notifications/push", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { sent?: number; error?: string };
      if (!res.ok) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      toast({ title: "Ad notification sent!", description: `Delivered to ${data.sent} user${data.sent === 1 ? "" : "s"}.` });
      setTitle(""); setMessage(""); setLink("");
      if (mode === "selected") { setSelected(new Set()); setSearch(""); }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally { setSending(false); }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(u => selected.has(u.id));

  return (
    <Card className="p-6 border-border/50 shadow-sm max-w-2xl">
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Megaphone className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Ad notification</h3>
          <p className="text-xs text-muted-foreground">
            {mode === "all" ? "Sends promotional notification to all users." : "Sends to selected users only."}
          </p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-5 p-1 bg-muted rounded-lg w-fit">
        {(["all", "selected"] as const).map(m => (
          <button key={m} type="button" onClick={() => setMode(m)}
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

      {/* User picker */}
      {mode === "selected" && (
        <div className="mb-5 rounded-xl border border-border/60 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            {search && <button type="button" onClick={() => setSearch("")}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>}
          </div>
          {!loadingUsers && filtered.length > 0 && (
            <button type="button" onClick={toggleAll}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 border-b border-border/40 transition-colors">
              {allFilteredSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
              {allFilteredSelected ? "Deselect all" : `Select all (${filtered.length})`}
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
                <button key={u.id} type="button" onClick={() => toggleUser(u.id)}
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

      <form onSubmit={handleSend} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ad-title">Ad title *</Label>
          <Input id="ad-title" required value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. 🔥 Flash Sale — 30% off today!" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ad-msg">Message *</Label>
          <Textarea id="ad-msg" required rows={3} value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Hurry! Limited-time discount on all electronics. Tap to shop now." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ad-link">Link URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="ad-link" type="url" value={link} onChange={e => setLink(e.target.value)}
            placeholder="https://allmart.com/products" />
          <p className="text-xs text-muted-foreground">Appended to the notification message so users can tap through.</p>
        </div>
        <Button type="submit" disabled={sending || (mode === "selected" && selected.size === 0)} className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
          {sending ? "Sending…" : mode === "all" ? "Send to all users" : selected.size === 0 ? "Select users to send" : `Send to ${selected.size} user${selected.size === 1 ? "" : "s"}`}
        </Button>
      </form>
    </Card>
  );
}
