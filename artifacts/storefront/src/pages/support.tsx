import { useEffect, useState } from "react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { HeadphonesIcon, Mail, CheckCircle2, Loader2, Flag, RotateCcw, Clock, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type SupportCase = {
  id: number;
  orderTrackingCode: string;
  reason: string;
  description?: string;
  imageUrl?: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

const statusLabel: Record<string, string> = {
  open: "Reviewing",
  pending: "Reviewing",
  reviewing: "Reviewing",
  reviewed: "Reviewed",
  approved: "Resolved",
  rejected: "Resolved",
  resolved: "Resolved",
};

const statusClass: Record<string, string> = {
  open: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  reviewing: "bg-amber-50 text-amber-700 border-amber-200",
  reviewed: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function CaseCard({ item, kind }: { item: SupportCase; kind: "report" | "refund" }) {
  const label = statusLabel[item.status] ?? item.status;
  return (
    <Card className="p-4 border-border/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {kind === "report" ? <Flag className="h-4 w-4 text-amber-600" /> : <RotateCcw className="h-4 w-4 text-violet-600" />}
            <p className="font-semibold text-sm">{kind === "report" ? "Order report" : "Refund request"} · #{item.orderTrackingCode}</p>
            <Badge variant="outline" className={`capitalize text-xs ${statusClass[item.status] ?? "bg-muted"}`}>
              {label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{item.reason}</p>
          {item.description && <p className="text-sm mt-2">{item.description}</p>}
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Submitted {new Date(item.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      {item.adminNote && (
        <div className="mt-3 rounded-lg bg-muted/40 border border-border/40 p-3">
          <p className="text-xs font-semibold flex items-center gap-1.5 mb-1"><MessageCircle className="h-3.5 w-3.5" /> Admin response</p>
          <p className="text-sm text-muted-foreground">{item.adminNote}</p>
        </div>
      )}
    </Card>
  );
}

export default function Support() {
  const { data } = useGetCurrentUser();
  const me = data?.user;
  const { toast } = useToast();
  const [name, setName] = useState(me?.name ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [reports, setReports] = useState<SupportCase[]>([]);
  const [refunds, setRefunds] = useState<SupportCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);

  useEffect(() => {
    if (!me) return;
    setCasesLoading(true);
    Promise.all([
      fetch("/api/order-reports/mine", { credentials: "include" }).then((r) => r.ok ? r.json() : []),
      fetch("/api/order-refunds/mine", { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    ]).then(([nextReports, nextRefunds]) => {
      setReports(nextReports);
      setRefunds(nextRefunds);
    }).catch(() => {
      toast({ title: "Could not load support cases", variant: "destructive" });
    }).finally(() => setCasesLoading(false));
  }, [me, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) throw new Error("Failed");
      setDone(true);
      toast({ title: "Message sent!", description: "We'll reply to your email shortly." });
    } catch {
      toast({ title: "Error", description: "Could not send. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container max-w-screen-lg mx-auto py-12 px-6">
      <div className="grid lg:grid-cols-[1fr_380px] gap-12 items-start">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <HeadphonesIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold">Support Desk</h1>
              <p className="text-muted-foreground text-sm">We typically reply within 24 hours.</p>
            </div>
          </div>

          {done ? (
            <Card className="p-10 text-center border-primary/20 bg-primary/5">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="font-serif text-2xl font-bold mb-2">Message received!</h2>
              <p className="text-muted-foreground">We'll reply to <strong>{email}</strong> shortly.</p>
              <Button className="mt-6" onClick={() => { setDone(false); setSubject(""); setMessage(""); }}>
                Send another message
              </Button>
            </Card>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-name">Your name</Label>
                  <Input id="s-name" required value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-email">Email address</Label>
                  <Input id="s-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-subject">Subject</Label>
                <Input id="s-subject" required value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. I haven't received my order" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-message">Message</Label>
                <Textarea id="s-message" required rows={6} value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your issue in detail…" />
              </div>
              <Button type="submit" size="lg" className="gap-2" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {submitting ? "Sending…" : "Send message"}
              </Button>
            </form>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-6 border-border/50">
            <h3 className="font-semibold mb-3">Contact us directly</h3>
            <a
              href="mailto:help@allmarts.us"
              className="flex items-center gap-2 text-primary hover:underline text-sm font-medium"
            >
              <Mail className="h-4 w-4" /> help@allmarts.us
            </a>
          </Card>
          <Card className="p-6 border-border/50">
            <h3 className="font-semibold mb-2">Common questions</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>· How do I track my order?</li>
              <li>· Can I cancel or modify an order?</li>
              <li>· How do I return a product?</li>
              <li>· Payment failed — what do I do?</li>
            </ul>
          </Card>
        </div>
      </div>
      {me && (
        <section className="mt-12 space-y-5">
          <div>
            <h2 className="font-serif text-2xl font-bold">Order support status</h2>
            <p className="text-sm text-muted-foreground mt-1">Track your refund requests and order reports here. You’ll also receive an email and in-app notification when an admin responds.</p>
          </div>
          {casesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your cases…</div>
          ) : reports.length === 0 && refunds.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">You have no order reports or refund requests yet.</Card>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Reports ({reports.length})</h3>
                {reports.map((item) => <CaseCard key={item.id} item={item} kind="report" />)}
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Refunds ({refunds.length})</h3>
                {refunds.map((item) => <CaseCard key={item.id} item={item} kind="refund" />)}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
