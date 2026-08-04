import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Users, Settings2, CheckCircle2, Gift, Search, X, ChevronDown, RefreshCw, History, Clock, AlertTriangle } from "lucide-react";

type UserRow = { id: number; name: string; email: string };

type BonusGrant = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  amount: number;
  reason: string | null;
  claimed: boolean;
  expired: boolean;
  expiresAt: string | null;
  createdAt: string;
  currentBalance: number;
};

type ReferralRecord = {
  id: number;
  referrer: { id: number; name: string; email: string };
  referred: { id: number; name: string; email: string };
  referrerBonus: number;
  referredBonus: number;
  referrerClaimed: boolean;
  createdAt: string;
};

type ReferralSettings = {
  referralReferrerBonus: number;
  referralSignupBonus: number;
  referralNote: string;
};

function useFetch<T>(url: string, options?: { refetchInterval?: number }) {
  return useQuery<T>({
    queryKey: [url],
    queryFn: () => fetch(url, { credentials: "include" }).then(r => r.json()),
    refetchOnWindowFocus: true,
    ...(options?.refetchInterval ? { refetchInterval: options.refetchInterval } : {}),
  });
}

// ── User picker dropdown ──────────────────────────────────────────────────────
function UserPicker({
  users,
  loading,
  selected,
  onSelect,
}: {
  users: UserRow[];
  loading: boolean;
  selected: UserRow | null;
  onSelect: (u: UserRow | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm hover:bg-muted/40 transition-colors"
      >
        {loading ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading users…</span>
        ) : selected ? (
          <span className="flex flex-col items-start text-left min-w-0">
            <span className="font-medium truncate">{selected.name}</span>
            <span className="text-xs text-muted-foreground truncate">{selected.email}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Select a user…</span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-popover shadow-lg overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/30">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}>
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          {/* List */}
          <div className="max-h-48 overflow-y-auto divide-y divide-border/30">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
            ) : (
              filtered.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { onSelect(u); setOpen(false); setSearch(""); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors ${selected?.id === u.id ? "bg-primary/5" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  {selected?.id === u.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function AdminReferrals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: records = [], isLoading: loadingRecords } = useFetch<ReferralRecord[]>("/api/admin/referrals");
  const { data: settings, isLoading: loadingSettings } = useFetch<ReferralSettings>("/api/admin/referral-settings");
  const { data: bonusGrants = [], isLoading: loadingGrants, refetch: refetchGrants, isFetching: isFetchingGrants } = useFetch<BonusGrant[]>("/api/admin/bonus-grants", { refetchInterval: 30_000 });

  const [referrerBonus, setReferrerBonus] = useState("");
  const [signupBonus, setSignupBonus] = useState("");
  const [note, setNote] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Grant bonus state
  const [grantUsers, setGrantUsers] = useState<UserRow[]>([]);
  const [loadingGrantUsers, setLoadingGrantUsers] = useState(false);
  const [grantTarget, setGrantTarget] = useState<UserRow | null>(null);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantExpiry, setGrantExpiry] = useState("");
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    setLoadingGrantUsers(true);
    fetch("/api/admin/users", { credentials: "include" })
      .then(r => r.json())
      .then((data: UserRow[]) => setGrantUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingGrantUsers(false));
  }, []);

  if (settings && !settingsLoaded) {
    setReferrerBonus(String(settings.referralReferrerBonus));
    setSignupBonus(String(settings.referralSignupBonus));
    setNote(settings.referralNote);
    setSettingsLoaded(true);
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/referral-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralReferrerBonus: Number(referrerBonus),
          referralSignupBonus: Number(signupBonus),
          referralNote: note,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/referral-settings"] });
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  }

  async function grantBonus(e: React.FormEvent) {
    e.preventDefault();
    if (!grantTarget) return;
    const amount = Number(grantAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive number.", variant: "destructive" });
      return;
    }
    setGranting(true);
    try {
      const body: Record<string, unknown> = { userId: grantTarget.id, amount, reason: grantReason || undefined };
      if (grantExpiry) body.expiresAt = new Date(grantExpiry).toISOString();

      const res = await fetch("/api/admin/grant-bonus", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
      toast({
        title: "Bonus gift sent!",
        description: `${grantTarget.name} will see the gift on their referral page and must claim it.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/bonus-grants"] });
      setGrantTarget(null);
      setGrantAmount("");
      setGrantReason("");
      setGrantExpiry("");
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setGranting(false);
    }
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Settings card */}
      <Card className="p-6 border-border/50 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Referral settings</h3>
        </div>

        {loadingSettings ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ref-referrer">Referrer bonus ($)</Label>
                <Input id="ref-referrer" type="number" min="0" step="0.01" value={referrerBonus}
                  onChange={e => setReferrerBonus(e.target.value)} placeholder="10" />
                <p className="text-xs text-muted-foreground">Earned by the person who shared the link (claimable)</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-signup">Sign-up bonus ($)</Label>
                <Input id="ref-signup" type="number" min="0" step="0.01" value={signupBonus}
                  onChange={e => setSignupBonus(e.target.value)} placeholder="20" />
                <p className="text-xs text-muted-foreground">Given to new users who used a referral link</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref-note">Referral note <span className="text-muted-foreground font-normal">(shown to users)</span></Label>
              <Textarea id="ref-note" value={note} onChange={e => setNote(e.target.value)}
                className="h-20 resize-none"
                placeholder="Refer friends and earn bonus credits you can use on your next order!" />
            </div>
            <Button onClick={saveSettings} disabled={savingSettings} className="gap-2">
              {savingSettings ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save settings</>}
            </Button>
          </>
        )}
      </Card>

      {/* Grant bonus card */}
      <Card className="p-6 border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100">
            <Gift className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h3 className="font-semibold">Grant bonus to user</h3>
            <p className="text-xs text-muted-foreground">Manually add bonus credit to any user's account. It appears at checkout alongside their balance.</p>
          </div>
        </div>

        <form onSubmit={grantBonus} className="space-y-4">
          <div className="space-y-1.5">
            <Label>User</Label>
            <UserPicker
              users={grantUsers}
              loading={loadingGrantUsers}
              selected={grantTarget}
              onSelect={setGrantTarget}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="grant-amount">Bonus amount ($) *</Label>
              <Input
                id="grant-amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 25.00"
                value={grantAmount}
                onChange={e => setGrantAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grant-reason">Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="grant-reason"
                placeholder="e.g. Loyalty reward, compensation…"
                value={grantReason}
                onChange={e => setGrantReason(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grant-expiry" className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Expiry date <span className="text-muted-foreground font-normal">(optional — gift cannot be claimed after this date)</span>
            </Label>
            <Input
              id="grant-expiry"
              type="date"
              value={grantExpiry}
              min={new Date().toISOString().split("T")[0]}
              onChange={e => setGrantExpiry(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {/* Preview */}
          {grantTarget && Number(grantAmount) > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-violet-50 border border-violet-200 text-sm">
              <Gift className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
              <span className="text-violet-700">
                <span className="font-semibold">{fmt(Number(grantAmount))}</span> gift will appear on{" "}
                <span className="font-semibold">{grantTarget.name}</span>'s referral page.
                They must click <strong>Claim</strong> to add it to their balance.
                {grantExpiry && (
                  <span className="block text-xs mt-1 text-violet-500">
                    Expires {new Date(grantExpiry).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}.
                  </span>
                )}
              </span>
            </div>
          )}

          <Button
            type="submit"
            disabled={granting || !grantTarget || !grantAmount || Number(grantAmount) <= 0}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {granting ? "Granting…" : "Grant bonus"}
          </Button>
        </form>
      </Card>

      {/* Bonus grants history */}
      <Card className="p-6 border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-4 w-4 text-violet-500" />
          <h3 className="font-semibold">Bonus grant history</h3>
          <span className="text-xs text-muted-foreground ml-1">{bonusGrants.length} total</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => refetchGrants()}
            title="Refresh balances"
            disabled={isFetchingGrants}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetchingGrants ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loadingGrants ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : bonusGrants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bonuses granted yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left pb-2 font-medium text-muted-foreground">User</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">Granted</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">Current Balance</th>
                    <th className="text-left pb-2 font-medium text-muted-foreground pl-3">Reason</th>
                    <th className="text-center pb-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">Expires</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {[...bonusGrants].reverse().map(g => {
                    const fmtDate = (iso: string) =>
                      new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
                    return (
                      <tr key={g.id} className={`border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors ${g.expired ? "opacity-50" : ""}`}>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{g.userName}</div>
                          <div className="text-muted-foreground">{g.userEmail}</div>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-violet-600">{fmt(g.amount)}</td>
                        <td className="py-2.5 pr-3 text-right">
                          <span className={`font-semibold ${g.currentBalance <= 0 ? "text-muted-foreground line-through" : "text-emerald-600"}`}>
                            {fmt(g.currentBalance)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-[140px] truncate">
                          {g.reason ?? <span className="italic opacity-40">—</span>}
                        </td>
                        <td className="py-2.5 text-center">
                          {g.claimed ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.5 font-medium">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Claimed
                            </span>
                          ) : g.expired ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-600 border border-red-200 rounded-full px-1.5 py-0.5 font-medium">
                              <AlertTriangle className="h-2.5 w-2.5" /> Expired
                            </span>
                          ) : (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5 font-medium">
                              Pending claim
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-muted-foreground whitespace-nowrap">
                          {g.expiresAt ? (
                            <span className={g.expired ? "text-red-500" : ""}>
                              {fmtDate(g.expiresAt)}
                            </span>
                          ) : (
                            <span className="opacity-30">No limit</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground whitespace-nowrap">
                          {fmtDate(g.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Referrals table */}
      <Card className="p-6 border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">All referrals</h3>
          <span className="text-xs text-muted-foreground ml-auto">{records.length} total</span>
        </div>

        {loadingRecords ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No referrals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left pb-2 font-medium text-muted-foreground">Referrer</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground">Referred</th>
                  <th className="text-right pb-2 font-medium text-muted-foreground">Referrer bonus</th>
                  <th className="text-right pb-2 font-medium text-muted-foreground">Signup bonus</th>
                  <th className="text-center pb-2 font-medium text-muted-foreground">Claimed</th>
                  <th className="text-right pb-2 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.referrer.name}</div>
                      <div className="text-muted-foreground">{r.referrer.email}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.referred.name}</div>
                      <div className="text-muted-foreground">{r.referred.email}</div>
                    </td>
                    <td className="py-2 pr-3 text-right text-violet-600 font-medium">{fmt(r.referrerBonus)}</td>
                    <td className="py-2 pr-3 text-right text-emerald-600 font-medium">{fmt(r.referredBonus)}</td>
                    <td className="py-2 text-center">
                      {r.referrerClaimed
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                        : <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">Pending</span>}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
