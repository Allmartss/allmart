import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MailCheck, RefreshCw } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: meData, isLoading } = useGetCurrentUser();
  const user = meData?.user as ({ email?: string; emailVerified?: boolean }) | null | undefined;

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  // Redirect if already verified or not signed in
  useEffect(() => {
    if (isLoading) return;
    if (!user) { setLocation("/account"); return; }
    if (user.emailVerified) { setLocation("/"); return; }
  }, [isLoading, user, setLocation]);

  // Auto-send code on first load
  useEffect(() => {
    if (user && !user.emailVerified && !codeSent) {
      sendCode(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function sendCode(silent = false) {
    setResending(true);
    try {
      const res = await fetch("/api/auth/send-verification", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setCodeSent(true);
      if (!silent) toast({ title: "Code sent!", description: "Check your inbox." });
    } catch {
      if (!silent) toast({ title: "Failed to send code", variant: "destructive" });
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Invalid or expired code. Try resending.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({ title: "Email verified! 🎉", description: "You can now place orders." });
      setLocation("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="container max-w-md mx-auto px-6 py-16">
      <Card className="p-8 border-border/60 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a 6-digit code to <strong className="text-foreground">{user?.email}</strong>.
            Enter it below to activate your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ve-code">Verification code</Label>
            <Input
              id="ve-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="text-center text-2xl tracking-[0.5em] font-mono h-14"
              required
              maxLength={6}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-11 text-base" disabled={submitting || code.length < 6}>
            {submitting ? "Verifying…" : "Verify email"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => sendCode()}
            disabled={resending}
            className="flex items-center gap-1.5 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
            {resending ? "Sending…" : "Resend code"}
          </button>
        </div>
      </Card>
    </div>
  );
}
