import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Users, DollarSign, Link2, Gift, Loader2, CheckCircle2, Share2, Sparkles, Clock, AlertTriangle } from "lucide-react";

type AdminGift = {
  id: number;
  amount: number;
  reason: string | null;
  claimed: boolean;
  expired: boolean;
  expiresAt: string | null;
  createdAt: string;
};

type ReferralData = {
  referralCode: string | null;
  referralLink: string | null;
  bonusBalance: number;
  totalReferrals: number;
  totalEarned: number;
  unclaimedTotal: number;
  note: string;
  referrals: { id: number; name: string; joinedAt: string; referrerBonus: number; claimed: boolean }[];
  adminGifts: AdminGift[];
};

function fetchReferralData(): Promise<ReferralData> {
  return fetch("/api/referral", { credentials: "include" }).then(r => r.json());
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function GiftExpiryBadge({ expiresAt, expired }: { expiresAt: string | null; expired: boolean }) {
  if (!expiresAt) return null;
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-600 border border-red-200 rounded-full px-1.5 py-0.5 font-medium">
        <AlertTriangle className="h-2.5 w-2.5" /> Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
      <Clock className="h-2.5 w-2.5" /> Expires {fmtDate(expiresAt)}
    </span>
  );
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
  const [claimingGift, setClaimingGift] = useState<number | null>(null);
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

  async function claimGift(giftId: number) {
    setClaimingGift(giftId);
    try {
      const res = await fetch(`/api/bonus/claim-admin/${giftId}`, { method: "POST", credentials: "include" });
      const d = await res.json() as { bonusBalance?: number; claimed?: number; error?: string };
      if (!res.ok) {
        toast({ title: d.error ?? "Failed to claim", variant: "destructive" });
        return;
      }
      await refetch();
      await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({
        title: `$${(d.claimed ?? 0).toFixed(2)} gift claimed!`,
        description: `Your bonus balance is now $${(d.bonusBalance ?? 0).toFixed(2)}.`,
      });
    } catch {
      toast({ title: "Failed to claim", variant: "destructive" });
    } finally {
      setClaimingGift(null);
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

  // Split gifts: claimable (unclaimed + not expired), expired (unclaimed + expired), claimed
  const unclaimedGifts = (data?.adminGifts ?? []).filter(g => !g.claimed && !g.expired);
  const expiredGifts   = (data?.adminGifts ?? []).filter(g => !g.claimed && g.expired);
  const claimedGifts   = (data?.adminGifts ?? []).filter(g => g.claimed);

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold">Referrals &amp; Bonus</h1>
          <p className="text-sm text-muted-foreground">Invite friends, earn rewards</p>
        </div>
      </div>

      {data?.note && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/90 leading-relaxed">
          {data.note}
        </div>
      )}

      {/* Stats row — responsive text to prevent overflow */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-3 sm:p-4 text-center border-border/50 shadow-sm">
          <div className="text-xl sm:text-2xl font-bold text-primary leading-tight">
            {isLoading ? "…" : data?.totalReferrals ?? 0}
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-tight">Total referrals</p>
        </Card>
        <Card className="p-3 sm:p-4 text-center border-border/50 shadow-sm">
          <div className="text-base sm:text-2xl font-bold text-emerald-600 leading-tight break-all">
            {isLoading ? "…" : fmt(data?.totalEarned ?? 0)}
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-tight">Total earned</p>
        </Card>
        <Card className="p-3 sm:p-4 text-center border-border/50 shadow-sm">
          <div className="text-base sm:text-2xl font-bold text-violet-600 leading-tight break-all">
            {isLoading ? "…" : fmt(data?.bonusBalance ?? 0)}
          </div>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-tight">Bonus balance</p>
        </Card>
      </div>

      {/* Referral link card */}
      <Card className="p-5 sm:p-6 border-border/50 shadow-sm space-y-4">
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

      {/* Bonus balance card */}
      <Card className="p-5 sm:p-6 border-border/50 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-violet-500" />
          <h2 className="font-semibold">Bonus balance</h2>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-3xl font-bold text-violet-600 break-all">{fmt(data?.bonusBalance ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Available to use at checkout</p>
          </div>
          {(data?.unclaimedTotal ?? 0) > 0 && (
            <div className="text-right shrink-0">
              <div className="text-xs text-muted-foreground">Unclaimed referrals</div>
              <div className="text-xl font-semibold text-amber-600">{fmt(data?.unclaimedTotal ?? 0)}</div>
            </div>
          )}
        </div>

        {/* Claimable admin gifts */}
        {unclaimedGifts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Store gifts — ready to claim</p>
            {unclaimedGifts.map(gift => (
              <div
                key={gift.id}
                className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 gap-3"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-semibold text-amber-700">{fmt(gift.amount)}</div>
                    {gift.reason && <p className="text-xs text-amber-600/80 truncate">{gift.reason}</p>}
                    <GiftExpiryBadge expiresAt={gift.expiresAt} expired={gift.expired} />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => claimGift(gift.id)}
                  disabled={claimingGift === gift.id}
                  className="shrink-0 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-0"
                >
                  {claimingGift === gift.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <><Sparkles className="h-3.5 w-3.5" /> Claim</>}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Expired gifts */}
        {expiredGifts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expired gifts</p>
            {expiredGifts.map(gift => (
              <div
                key={gift.id}
                className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-3 gap-3 opacity-60"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <Sparkles className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-semibold text-muted-foreground line-through">{fmt(gift.amount)}</div>
                    {gift.reason && <p className="text-xs text-muted-foreground truncate">{gift.reason}</p>}
                    <GiftExpiryBadge expiresAt={gift.expiresAt} expired={gift.expired} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Claimed gifts history */}
        {claimedGifts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Claimed gifts</p>
            {claimedGifts.map(gift => (
              <div key={gift.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/20 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium text-emerald-700">{fmt(gift.amount)}</span>
                    {gift.reason && <span className="text-muted-foreground text-xs ml-2 truncate">{gift.reason}</span>}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{fmtDate(gift.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Referral unclaimed claim button */}
        {(data?.unclaimedTotal ?? 0) > 0 && (
          <Button onClick={claimBonus} disabled={claiming} className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white border-0">
            {claiming ? <><Loader2 className="h-4 w-4 animate-spin" /> Claiming…</> : <><DollarSign className="h-4 w-4" /> Claim {fmt(data?.unclaimedTotal ?? 0)} referral bonus</>}
          </Button>
        )}

        {(data?.unclaimedTotal ?? 0) === 0 && unclaimedGifts.length === 0 && (data?.bonusBalance ?? 0) > 0 && (
          <p className="text-xs text-center text-muted-foreground">Use this balance at checkout — tick "Use bonus balance" in the order summary.</p>
        )}
        {(data?.unclaimedTotal ?? 0) === 0 && unclaimedGifts.length === 0 && expiredGifts.length === 0 && (data?.bonusBalance ?? 0) === 0 && (
          <p className="text-xs text-center text-muted-foreground">Refer friends to earn bonus credits!</p>
        )}
      </Card>

      {/* Referrals table */}
      {(data?.referrals?.length ?? 0) > 0 && (
        <Card className="p-5 sm:p-6 border-border/50 shadow-sm">
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
