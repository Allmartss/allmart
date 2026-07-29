import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, MessageSquare, CheckCircle2, Users } from "lucide-react";

type Ticket = {
  id: number; name: string; email: string; subject: string;
  message: string; status: string; adminReply: string | null;
  createdAt: string; repliedAt: string | null;
};

type Subscriber = {
  id: number; email: string; subscribedAt: string; active: boolean;
};

function SubscribersTable() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/subscribers", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setSubscribers(d as Subscriber[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground p-2">Loading subscribers…</div>;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Newsletter subscribers</h3>
        <span className="text-xs text-muted-foreground">({subscribers.length})</span>
      </div>
      {subscribers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No subscribers yet</p>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Subscribed</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s, i) => (
                <tr key={s.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <a href={`mailto:${s.email}`} className="text-primary hover:underline">{s.email}</a>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(s.subscribedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {s.active ? "active" : "inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminSupportDesk() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/admin/support-tickets", { credentials: "include" })
      .then(r => r.json()).then(d => { setTickets(d as Ticket[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/support-tickets/${selected.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminReply: reply }),
      });
      const updated = await res.json() as Ticket;
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
      setSelected(updated);
      setReply("");
      toast({ title: "Reply sent!", description: `Email sent to ${selected.email}` });
    } catch {
      toast({ title: "Error", description: "Could not send reply", variant: "destructive" });
    } finally { setSending(false); }
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/admin/support-tickets/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : s);
  }

  const statusColor: Record<string, string> = {
    open: "bg-amber-100 text-amber-700",
    replied: "bg-blue-100 text-blue-700",
    closed: "bg-muted text-muted-foreground",
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading tickets…</div>;

  return (
    <>
    <div className="grid lg:grid-cols-[280px_1fr] gap-6 min-h-[500px]">
      <div className="space-y-2 overflow-y-auto max-h-[600px]">
        {tickets.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">No tickets yet</p>
        )}
        {tickets.map(t => (
          <button key={t.id} type="button" onClick={() => { setSelected(t); setReply(""); }}
            className={`w-full text-left rounded-lg border p-3 transition-colors hover:border-primary/40 ${selected?.id === t.id ? "border-primary bg-primary/5" : "border-border/50"}`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-sm truncate">{t.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor[t.status] ?? "bg-muted text-muted-foreground"}`}>{t.status}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{new Date(t.createdAt).toLocaleDateString()}</p>
          </button>
        ))}
      </div>

      <div>
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center"><MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Select a ticket to view</p></div>
          </div>
        ) : (
          <Card className="p-6 border-border/50 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-base">{selected.subject}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{selected.name} · <a href={`mailto:${selected.email}`} className="text-primary hover:underline">{selected.email}</a></p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(selected.id, "closed")}>Close</Button>
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap">{selected.message}</div>

            {selected.adminReply && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Your reply · {selected.repliedAt ? new Date(selected.repliedAt).toLocaleString() : ""}</p>
                <p className="text-sm whitespace-pre-wrap">{selected.adminReply}</p>
              </div>
            )}

            <div className="space-y-2">
              <Textarea rows={4} value={reply} onChange={e => setReply(e.target.value)} placeholder="Type your reply… (sent via email to the customer)" />
              <Button onClick={sendReply} disabled={sending || !reply.trim()} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {sending ? "Sending…" : "Send reply via email"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
    <SubscribersTable />
  </>
  );
}
