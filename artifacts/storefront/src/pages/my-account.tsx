import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCurrentUser,
  signOut,
  getGetCurrentUserQueryKey,
  getGetCartQueryKey,
  getListOrdersQueryKey,
  getListChatMessagesQueryKey,
} from "@workspace/api-client-react";
import {
  UserCog,
  Lock,
  Package,
  Bell,
  LifeBuoy,
  Users,
  LogOut,
  ChevronRight,
  ShieldCheck,
  MapPin,
  CreditCard,
  Star,
  Loader2,
} from "lucide-react";

// ── Menu row ───────────────────────────────────────────────────────────────────
function MenuRow({
  icon: Icon,
  label,
  sub,
  href,
  danger,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  sub?: string;
  href?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${
        danger ? "hover:bg-red-50 dark:hover:bg-red-950/20" : "hover:bg-muted/60"
      } cursor-pointer`}
      onClick={onClick}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          danger ? "bg-red-100 dark:bg-red-900/30" : "bg-primary/10"
        }`}
      >
        <Icon
          className={`h-4 w-4 ${danger ? "text-red-500" : "text-primary"}`}
        />
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            danger ? "text-red-500" : "text-foreground"
          }`}
        >
          {label}
        </p>
        {sub && (
          <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
        )}
      </div>
      {!onClick && (
        <ChevronRight
          className={`h-4 w-4 shrink-0 ${
            danger ? "text-red-400" : "text-muted-foreground"
          }`}
        />
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

// ── Divider group ──────────────────────────────────────────────────────────────
function MenuGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="rounded-2xl bg-background border border-border/50 overflow-hidden divide-y divide-border/40">
        {children}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function MyAccount() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: meData, isLoading } = useGetCurrentUser();
  const me = meData?.user ?? null;

  // Redirect guests to login — must be a useEffect, not inline during render
  useEffect(() => {
    if (!isLoading && !me) {
      setLocation("/account");
    }
  }, [isLoading, me, setLocation]);

  if (isLoading || !me) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  async function handleSignOut() {
    await signOut();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() }),
    ]);
    setLocation("/");
  }

  const initial = me.name ? me.name.charAt(0).toUpperCase() : "?";
  const email = (me as { email?: string }).email ?? "";
  const phone = (me as { phone?: string | null }).phone ?? null;
  const address = (me as { address?: string | null }).address ?? null;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-muted/30 dark:bg-[#0D0B1A]">

      {/* ── Purple header ─────────────────────────────────────────────────── */}
      <div className="bg-primary px-4 pt-safe pb-10 rounded-b-[32px] shadow-xl shadow-primary/30">
        <div className="pt-4 pb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-white/80">My Account</p>
          <Link href="/notifications">
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors">
              <Bell className="h-4 w-4 text-white" />
            </button>
          </Link>
        </div>

        {/* Avatar + name */}
        <div className="flex flex-col items-center mt-3 gap-2">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/40 text-3xl font-extrabold text-white shadow-lg">
            {initial}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white leading-tight">{me.name}</p>
            {email && (
              <p className="text-sm text-white/70 mt-0.5">{email}</p>
            )}
            {phone && (
              <p className="text-xs text-white/55 mt-0.5">{phone}</p>
            )}
          </div>

          {/* Member badge */}
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white">
            <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" />
            AllMart Member
          </span>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="px-4 pb-24 pt-5 space-y-3 max-w-lg mx-auto w-full">

        {/* Personal info summary card */}
        <div className="rounded-2xl bg-background border border-border/50 px-4 py-3.5 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
            <MapPin className="h-4 w-4 text-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground mb-0.5">Delivery address</p>
            <p className="text-sm text-foreground leading-snug">
              {address || <span className="text-muted-foreground italic">Not set</span>}
            </p>
          </div>
          <Link href="/profile">
            <button className="text-[11px] font-semibold text-primary shrink-0 pt-0.5 hover:underline">
              Edit
            </button>
          </Link>
        </div>

        {/* Account settings */}
        <MenuGroup title="Account">
          <MenuRow
            icon={UserCog}
            label="Personal Information"
            sub="Name, email, gender, phone"
            href="/profile"
          />
          <MenuRow
            icon={Lock}
            label="Security"
            sub="Change password"
            href="/security"
          />
          <MenuRow
            icon={Bell}
            label="Notifications"
            sub="Alerts &amp; updates"
            href="/notifications"
          />
        </MenuGroup>

        {/* Shopping */}
        <MenuGroup title="Shopping">
          <MenuRow
            icon={Package}
            label="My Orders"
            sub="Track and manage orders"
            href="/orders"
          />
          <MenuRow
            icon={CreditCard}
            label="Payment Methods"
            sub="Cards &amp; wallets"
            href="/checkout"
          />
          <MenuRow
            icon={Users}
            label="Referrals &amp; Bonus"
            sub="Invite friends, earn rewards"
            href="/referral"
          />
        </MenuGroup>

        {/* Support */}
        <MenuGroup title="Support">
          <MenuRow
            icon={LifeBuoy}
            label="Help &amp; Support"
            sub="FAQs and contact"
            href="/support"
          />
          <MenuRow
            icon={ShieldCheck}
            label="Privacy &amp; Terms"
            sub="How we use your data"
            href="/terms"
          />
        </MenuGroup>

        {/* Sign out */}
        <div className="rounded-2xl bg-background border border-border/50 overflow-hidden">
          <MenuRow
            icon={LogOut}
            label="Sign Out"
            danger
            onClick={handleSignOut}
          />
        </div>
      </div>
    </div>
  );
}
