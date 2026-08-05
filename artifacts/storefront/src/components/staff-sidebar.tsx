import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  signOut,
  getGetCurrentUserQueryKey,
  getGetCartQueryKey,
  getListOrdersQueryKey,
  getListChatMessagesQueryKey,
} from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  ClipboardList,
  LayoutDashboard,
  Users,
  Package,
  PackagePlus,
  KeyRound,
  LogOut,
  ChevronRight,
  UserCircle2,
  Landmark,
  Bell,
  HeadphonesIcon,
  LayoutList,
  Tag,
  Globe,
  Eye,
  Send,
  Gift,
  Zap,
  Activity,
  Megaphone,
  MousePointerClick,
  Mail,
  PenLine,
  Paintbrush,
  Flag,
  RotateCcw,
  Star,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/catalog", label: "Add product", icon: PackagePlus },
  { href: "/admin/products", label: "Manage products", icon: LayoutList },
  { href: "/admin/flash-sale", label: "Flash sale", icon: Zap },
  { href: "/admin/cashback", label: "Cashback codes", icon: Tag },
  { href: "/admin/landing-pages", label: "Landing pages", icon: Globe },
  { href: "/admin/promotions", label: "Promotions", icon: Megaphone },
  { href: "/admin/email-campaigns", label: "Email campaigns", icon: Mail },
  { href: "/admin/email-templates", label: "Email templates", icon: PenLine },
  { href: "/admin/support", label: "Support desk", icon: HeadphonesIcon },
  { href: "/admin/visitors", label: "Visitors", icon: Eye },
  { href: "/admin/telegram", label: "Telegram bot", icon: Send },
  { href: "/admin/referrals", label: "Referrals", icon: Gift },
  { href: "/admin/bank", label: "Bank details", icon: Landmark },
  { href: "/admin/password", label: "Admin password", icon: KeyRound },
  { href: "/admin/health", label: "Service health", icon: Activity },
  { href: "/admin/site-ui", label: "Site UI editor", icon: Paintbrush },
  { href: "/admin/order-reports", label: "Order reports", icon: Flag },
  { href: "/admin/order-refunds", label: "Refund requests", icon: RotateCcw },
  { href: "/admin/order-ratings", label: "Order ratings", icon: Star },
];

const PM_ITEMS: NavItem[] = [
  { href: "/pm", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pm/orders", label: "Orders", icon: Package },
  { href: "/pm/catalog", label: "Add product", icon: PackagePlus },
];

export function StaffSidebarTrigger({
  role,
  name,
}: {
  role: "admin" | "pm";
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const items = role === "admin" ? ADMIN_ITEMS : PM_ITEMS;
  const Icon = role === "admin" ? ShieldCheck : ClipboardList;
  const label = role === "admin" ? "Admin" : "PM";
  const accent = role === "admin" ? "text-primary" : "text-blue-600";

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() }),
    ]);
    setLocation("/");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-sm font-medium hover:bg-primary/5 hover:text-primary"
        >
          <Icon className={`h-4 w-4 ${accent}`} />
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 sm:w-80 p-0 flex flex-col bg-background"
      >
        <SheetHeader className="px-6 py-5 border-b border-border/50 text-left">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                role === "admin" ? "bg-primary/10" : "bg-blue-50"
              }`}
            >
              <Icon className={`h-5 w-5 ${accent}`} />
            </div>
            <div>
              <SheetTitle className="font-serif text-lg leading-tight">
                {label} console
              </SheetTitle>
              <SheetDescription className="text-xs flex items-center gap-1.5">
                <UserCircle2 className="h-3 w-3" />
                {name}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {items.map((item) => {
              const active = location === item.href;
              const ItemIcon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <ItemIcon
                        className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
                      />
                      {item.label}
                    </span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-opacity ${active ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-50"}`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border/50 px-3 py-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
