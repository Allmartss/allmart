import { useState } from "react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { HeadphonesIcon, Mail, CheckCircle2, Loader2 } from "lucide-react";

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
    </div>
  );
}
