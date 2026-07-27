import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers,
  updateUserRole,
  deleteUser,
  createUserResetCode,
  getListUsersQueryKey,
  type AuthUser,
  type ResetCodeResponse,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, UserCircle2, KeyRound, Copy, Shield, Pencil, MailCheck, Ban, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const ROLES = ["buyer", "pm", "admin"] as const;
const TIERS = [0, 1, 2, 3] as const;

const roleColor: Record<string, string> = {
  buyer: "bg-muted text-muted-foreground border-border",
  pm: "bg-blue-50 text-blue-700 border-blue-200",
  admin: "bg-primary/10 text-primary border-primary/20",
};

const tierLabel: Record<number, string> = {
  0: "No tier",
  1: "Tier 1",
  2: "Tier 2",
  3: "Tier 3 (Pay on delivery)",
};

const tierColor: Record<number, string> = {
  0: "bg-muted text-muted-foreground",
  1: "bg-blue-50 text-blue-600",
  2: "bg-violet-50 text-violet-600",
  3: "bg-emerald-50 text-emerald-700",
};

type UserWithTier = AuthUser & { tier?: number; emailVerified?: boolean };

export function UsersManager({ currentUserId }: { currentUserId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: users, isLoading } = useListUsers();
  const [issuingFor, setIssuingFor] = useState<number | null>(null);
  const [issuedCode, setIssuedCode] = useState<ResetCodeResponse | null>(null);
  const [tierLoading, setTierLoading] = useState<number | null>(null);
  const [editUser, setEditUser] = useState<UserWithTier | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function saveEditUser() {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}/profile`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      await queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Profile updated" });
      setEditUser(null);
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Failed to update profile", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }

  async function changeRole(user: AuthUser, role: (typeof ROLES)[number]) {
    if (user.role === role) return;
    await updateUserRole(user.id, { role });
    await queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
  }

  async function changeTier(user: UserWithTier, tier: number) {
    if ((user.tier ?? 0) === tier) return;
    setTierLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/tier`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) throw new Error();
      await queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: `Tier updated to ${tierLabel[tier]}` });
    } catch {
      toast({ title: "Failed to update tier", variant: "destructive" });
    } finally {
      setTierLoading(null);
    }
  }

  async function verifyEmail(user: UserWithTier) {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/verify-email`, {
        method: "PATCH", credentials: "include",
      });
      if (!res.ok) throw new Error();
      await queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: `${user.email} marked as verified` });
    } catch {
      toast({ title: "Failed to verify email", variant: "destructive" });
    }
  }

  async function remove(user: AuthUser) {
    if (!confirm(`Delete ${user.email}? This can't be undone.`)) return;
    await deleteUser(user.id);
    await queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
  }

  async function generateResetCode(user: AuthUser) {
    setIssuingFor(user.id);
    try {
      const result = await createUserResetCode(user.id);
      setIssuedCode(result);
    } catch {
      toast({ title: "Couldn't generate code", description: "Please try again.", variant: "destructive" });
    } finally {
      setIssuingFor(null);
    }
  }

  function copyCode() {
    if (!issuedCode) return;
    navigator.clipboard.writeText(issuedCode.code).then(() => toast({ title: "Code copied" }));
  }

  function copyShareLink() {
    if (!issuedCode) return;
    const url = `${window.location.origin}/reset-password?email=${encodeURIComponent(issuedCode.userEmail)}&code=${encodeURIComponent(issuedCode.code)}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: "Reset link copied" }));
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
      <h3 className="font-serif text-xl font-bold mb-1">Users</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Manage roles, tiers, and accounts. Tier 3 unlocks Pay on Delivery for the user.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading users…</p>
      ) : (
        <div className="space-y-3">
          {(users as UserWithTier[] | undefined)?.map((user) => {
            const isSelf = user.id === currentUserId;
            const tier = user.tier ?? 0;
            return (
              <div key={user.id} className="rounded-xl border border-border/40 bg-background p-4 space-y-3">
                {/* User info row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      <UserCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{user.name}</span>
                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${roleColor[user.role] ?? roleColor.buyer}`}>
                          {user.role}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${tierColor[tier] ?? tierColor[0]}`}>
                          <Shield className="h-2.5 w-2.5" />{tierLabel[tier] ?? `Tier ${tier}`}
                        </span>
                        {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:bg-muted"
                      onClick={() => { setEditUser(user); setEditName(user.name); setEditEmail(user.email); }}
                      aria-label="Edit profile" title="Edit name / email">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!user.emailVerified ? (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600 hover:bg-amber-50"
                        onClick={() => verifyEmail(user)}
                        aria-label="Manually verify email" title="Mark email as verified">
                        <MailCheck className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <span title="Email verified" className="flex h-7 w-7 items-center justify-center text-emerald-600">
                        <MailCheck className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/10"
                      disabled={issuingFor === user.id} onClick={() => generateResetCode(user)}
                      aria-label="Generate password reset code" title="Generate password reset code">
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      disabled={isSelf} onClick={() => remove(user)} aria-label="Delete user">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Role buttons */}
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-8">Role</span>
                  {ROLES.map((r) => (
                    <Button key={r} size="sm" variant={r === user.role ? "default" : "outline"}
                      className="h-7 text-xs px-2" disabled={isSelf && r !== "admin"}
                      onClick={() => changeRole(user, r)}>
                      {r}
                    </Button>
                  ))}
                </div>

                {/* Tier buttons */}
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider w-8">Tier</span>
                  {TIERS.map((t) => (
                    <Button key={t} size="sm"
                      variant={t === tier ? "default" : "outline"}
                      className="h-7 text-xs px-2"
                      disabled={tierLoading === user.id}
                      onClick={() => changeTier(user, t)}>
                      {t === 0 ? "None" : `T${t}`}
                    </Button>
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1">{tierLabel[tier]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!issuedCode} onOpenChange={(o) => !o && setIssuedCode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Password reset code</DialogTitle>
            <DialogDescription>
              Share this code with{" "}
              <span className="font-medium text-foreground">{issuedCode?.userEmail}</span>.
              They can use it on the reset password page. The code expires in 30 minutes and can only be used once.
            </DialogDescription>
          </DialogHeader>
          {issuedCode && (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">One-time code</p>
                <div className="flex items-center justify-between gap-3">
                  <code className="font-mono text-2xl font-bold text-primary tracking-wider">{issuedCode.code}</code>
                  <Button size="icon" variant="ghost" onClick={copyCode} aria-label="Copy code">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Expires {new Date(issuedCode.expiresAt).toLocaleTimeString()}
                  {issuedCode.scope === "admin" && " · admin-scoped"}
                </p>
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={copyShareLink}>
                <Copy className="h-4 w-4" /> Copy ready-to-share reset link
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIssuedCode(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user profile dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>Update name and email for {editUser?.email}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="user@example.com" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditUser(null)} disabled={editSaving}>Cancel</Button>
            <Button onClick={saveEditUser} disabled={editSaving || !editName.trim() || !editEmail.trim()} className="gap-2">
              {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
