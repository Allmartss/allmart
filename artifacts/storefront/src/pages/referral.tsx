import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Users, DollarSign, Link2, Gift, Loader2, CheckCircle2, Share2, Sparkles } from "lucide-react";

type ReferralData = {
  referralCode: string | null;
  referralLink: string | null;
  bonusBalance: number;
  pendingAdminBonus: number;
  totalReferrals: number;
  totalEarned: number;
  unclaimedTotal: number;
  note: string;
  referrals: { id: number; name: string; joinedAt: string; referrerBonus: number; claimed: boolean }[];
};

function fetchReferralData(): Promise<ReferralData> {
  return fetch("/api/referral", { credentials: "include" }).then(r => r.json());
}

export default function Referral() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: meData } = useGetCurrentUser();
  const me = meData?.user ?? null;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["referral"],
    queryFn: fetchReferralData,
    enabled: !!me,
  });

  const [claiming, setClaiming] = useState(false);
  const [claimingAdmin, setClaimingAdmin] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!me) { setLocation("/account"); return null; }

  function copyLink() {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Referral link copied!" });
    });
  }

  function share() {
    if (!data?.referralLink) return;
    if (navigator.share) {
      navigator.share({
        title: "Join AllMart",
        text: "Use my referral link to sign up on AllMart and get a bonus!",
        url: data.referralLink,
      }).catch(() => {});
    } else {
      copyLink();
    }
  }

  async function claimAdminBonus() {
    setClaimingAdmin(true);
    try {
      const res = await fetch("/api/bonus/claim-admin", { method: "POST", credentials: "include" });
      const d = await res.json() as { bonusBalance: number; claimed: number };
      if (!res.ok) throw new Error("Claim failed");
      await refetch();
      await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({
        title: `$${d.claimed.toFixed(2)} bonus claimed!`,
        description: `Your bonus balance is now $${d.bonusBalance.toFixed(2)}.`,
      });
    } catch {
      toast({ title: "Failed to claim", variant: "destructive" });
    } finally {
      setClaimingAdmin(false);
    }
  }

  async function claimBonus() {
    setClaiming(true);
    try {
      const res = await fetch("/api/referral/claim", { method: "POST", credentials: "include" });
      const d = await res.json() as { bonusBalance: number; claimed: number };
      if (!res.ok) throw new Error("Claim failed");
      await refetch();
      await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({
        title: `$${d.claimed.toFixed(2)} claimed!`,
        description: `Your bonus balance is now $${d.bonusBalance.toFixed(2)}.`,
      });
    } catch {
      toast({ title: "Failed to claim", variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="container max-w-2xl mx-auto py-12 px-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-serif text-3xl font-bold">Referrals & Bonus</h1>
          <p className="text-sm text-muted-foreground">Invite friends, earn rewards</p>
        </div>
      </div>

      {data?.note && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/90 leading-relaxed">
          {data.note}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center border-border/50 shadow-sm">
          <div className="text-2xl font-bold text-primary">{isLoading ? "…" : data?.totalReferrals ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Total referrals</p>
        </Card>
        <Card className="p-4 text-center border-border/50 shadow-sm">
          <div className="text-2xl font-bold text-emerald-600">{isLoading ? "…" : fmt(data?.totalEarned ?? 0)}</div>
          <p className="text-xs text-muted-foreground mt-1">Total earned</p>
        </Card>
        <Card className="p-4 text-center border-border/50 shadow-sm">
          <div className="text-2xl font-bold text-violet-600">{isLoading ? "…" : fmt(data?.bonusBalance ?? 0)}</div>
          <p className="text-xs text-muted-foreground mt-1">Bonus balance</p>
        </Card>
      </div>

      {/* Referral link card */}
      <Card className="p-6 border-border/50 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Your referral link</h2>
        </div>
        {data?.referralLink ? (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
              <span className="text-sm font-mono truncate flex-1 text-muted-foreground">{data.referralLink}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={copyLink}>
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={share}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your code: <span className="font-mono font-semibold text-foreground">{data.referralCode}</span>
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No referral code yet — sign out and back in to generate one.</p>
        )}
      </Card>

      {/* Admin-gifted pending bonus */}
      {(data?.pendingAdminBonus ?? 0) > 0 && (
        <Card className="p-6 border-amber-200 bg-amber-50/50 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-amber-800">You have a bonus gift!</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-amber-600">{fmt(data.pendingAdminBonus)}</div>
              <p className="text-xs text-amber-700/70 mt-1">Gifted to you by the store — claim it to add to your balance</p>
            </div>
          </div>
          <Button
            onClick={claimAdminBonus}
            disabled={claimingAdmin}
            className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0"
          >
            {claimingAdmin
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Claiming…</>
              : <><Sparkles className="h-4 w-4" /> Claim {fmt(data.pendingAdminBonus)} gift</>}
          </Button>
        </Card>
      )}

      {/* Bonus balance + claim */}
      <Card className="p-6 border-border/50 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-violet-500" />
          <h2 className="font-semibold">Bonus balance</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-violet-600">{fmt(data?.bonusBalance ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Available to use at checkout</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Unclaimed</div>
            <div className="text-xl font-semibold text-amber-600">{fmt(data?.unclaimedTotal ?? 0)}</div>
          </div>
        </div>
        {(data?.unclaimedTotal ?? 0) > 0 && (
          <Button onClick={claimBonus} disabled={claiming} className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white border-0">
            {claiming ? <><Loader2 className="h-4 w-4 animate-spin" /> Claiming…</> : <><DollarSign className="h-4 w-4" /> Claim {fmt(data?.unclaimedTotal ?? 0)} bonus</>}
          </Button>
        )}
        {(data?.unclaimedTotal ?? 0) === 0 && (data?.bonusBalance ?? 0) > 0 && (
          <p className="text-xs text-center text-muted-foreground">Use this balance at checkout — tick "Use bonus balance" in the order summary.</p>
        )}
        {(data?.unclaimedTotal ?? 0) === 0 && (data?.bonusBalance ?? 0) === 0 && (
          <p className="text-xs text-center text-muted-foreground">Refer friends to earn bonus credits!</p>
        )}
      </Card>

      {/* Referrals table */}
      {(data?.referrals?.length ?? 0) > 0 && (
        <Card className="p-6 border-border/50 shadow-sm">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> People you referred
          </h2>
          <div className="space-y-2">
            {data!.referrals.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 text-sm">
                <div>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{new Date(r.joinedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-violet-600 font-medium">+{fmt(r.referrerBonus)}</span>
                  {r.claimed
                    ? <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.5 font-medium">Claimed</span>
                    : <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5 font-medium">Pending</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
