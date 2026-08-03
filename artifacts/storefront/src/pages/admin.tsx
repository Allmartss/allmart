import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { ProductForm } from "@/components/product-form";
import { OrdersManager } from "@/components/orders-manager";
import { UsersManager } from "@/components/users-manager";
import { StaffPageHeader } from "@/components/staff-page-header";
import { ChangeAdminPassword } from "@/components/change-admin-password";
import { BankDetailsManager } from "@/components/bank-details-manager";
import { AdminProductsManager } from "@/components/admin-products-manager";
import { PushNotificationForm } from "@/components/push-notification-form";
import { AdminSupportDesk } from "@/components/admin-support-desk";
import { AdminPopAds } from "@/components/admin-pop-ads";
import { AdminAdNotifications } from "@/components/admin-ad-notifications";
import { AdminCashbackManager } from "@/components/admin-cashback";
import { AdminLandingPages } from "@/components/admin-landing-pages";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminVisitors } from "@/components/admin-visitors";
import { AdminTelegram } from "@/components/admin-telegram";
import { CsvImportExport } from "@/components/csv-import-export";
import { AdminReferrals } from "@/components/admin-referrals";
import { AdminFlashSaleManager } from "@/components/admin-flash-sale";
import { AdminHealthWatch } from "@/components/admin-health-watch";
import { AdminEmailCampaigns } from "@/components/admin-email-campaigns";
import {
  ShieldCheck,
  Users as UsersIcon,
  Package,
  PackagePlus,
  KeyRound,
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
} from "lucide-react";

type Section =
  | "dashboard"
  | "users"
  | "orders"
  | "catalog"
  | "bank"
  | "password"
  | "products"
  | "notifications"
  | "support"
  | "cashback"
  | "landing-pages"
  | "visitors"
  | "telegram"
  | "referrals"
  | "flash-sale"
  | "health"
  | "pop-ads"
  | "ad-notifications"
  | "email-campaigns";

export default function Admin({ section = "dashboard" }: { section?: Section }) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetCurrentUser();
  const me = data?.user ?? null;

  useEffect(() => {
    if (!isLoading && (!me || me.role !== "admin")) {
      setLocation("/account");
    }
  }, [isLoading, me, setLocation]);

  if (isLoading || !me || me.role !== "admin") return null;

  return (
    <div className="container max-w-screen-xl mx-auto px-6 py-10 space-y-8">
      {section === "dashboard" && (
        <>
          <StaffPageHeader
            icon={ShieldCheck}
            title="Admin console"
            description={`Welcome back, ${me.name}. Here's your store overview.`}
          />
          <AdminDashboard />
          <div className="grid gap-8 lg:grid-cols-2">
            <ProductForm sellerName={me.name} />
          </div>
          <OrdersManager />
        </>
      )}

      {section === "users" && (
        <>
          <StaffPageHeader icon={UsersIcon} title="Users" description="Promote, demote, remove accounts, or generate password reset codes." />
          <UsersManager currentUserId={me.id} />
        </>
      )}

      {section === "orders" && (
        <>
          <StaffPageHeader icon={Package} title="Orders" description="Track every order and update its status." />
          <OrdersManager />
        </>
      )}

      {section === "catalog" && (
        <>
          <StaffPageHeader icon={PackagePlus} title="Add a product" description="List a new item in the AllMart catalog." />
          <div className="grid gap-8 xl:grid-cols-2">
            <ProductForm sellerName={me.name} />
            <CsvImportExport sellerName={me.name} />
          </div>
        </>
      )}

      {section === "products" && (
        <>
          <StaffPageHeader icon={LayoutList} title="Manage products" description="Edit details, images, colors, pricing and rating for any product." />
          <AdminProductsManager />
        </>
      )}

      {section === "bank" && (
        <>
          <StaffPageHeader icon={Landmark} title="Bank details" description="Set the bank account and logo shown to customers who pay by bank transfer." />
          <BankDetailsManager />
        </>
      )}

      {section === "password" && (
        <>
          <StaffPageHeader icon={KeyRound} title="Change admin password" description="Generate a unique admin reset code, then use it to set a new password." />
          <ChangeAdminPassword adminEmail={me.email} />
        </>
      )}

      {section === "notifications" && (
        <>
          <StaffPageHeader icon={Bell} title="Push notifications" description="Send an announcement to every registered user at once." />
          <div className="max-w-lg">
            <PushNotificationForm />
          </div>
        </>
      )}

      {section === "support" && (
        <>
          <StaffPageHeader icon={HeadphonesIcon} title="Support desk" description="View and reply to customer support tickets. Replies are sent via email." />
          <AdminSupportDesk />
        </>
      )}

      {section === "cashback" && (
        <>
          <StaffPageHeader icon={Tag} title="Cashback codes" description="Create discount codes that customers can apply at checkout." />
          <AdminCashbackManager />
        </>
      )}

      {section === "landing-pages" && (
        <>
          <StaffPageHeader icon={Globe} title="Landing pages" description="Create shareable collection pages with selected products." />
          <AdminLandingPages />
        </>
      )}

      {section === "visitors" && (
        <>
          <StaffPageHeader icon={Eye} title="Visitors" description="See who's browsing your store — page views, unique sessions, and referrers." />
          <AdminVisitors />
        </>
      )}

      {section === "telegram" && (
        <>
          <StaffPageHeader icon={Send} title="Telegram bot" description="Register the webhook and see available bot commands for your AllMart bot." />
          <AdminTelegram />
        </>
      )}

      {section === "referrals" && (
        <>
          <StaffPageHeader icon={Gift} title="Referrals" description="Manage referral bonuses, signup rewards, and view all referral records." />
          <AdminReferrals />
        </>
      )}

      {section === "flash-sale" && (
        <>
          <StaffPageHeader icon={Zap} title="Flash sale" description="Pick the products on sale and set the countdown shown on the storefront." />
          <AdminFlashSaleManager />
        </>
      )}

      {section === "health" && (
        <>
          <StaffPageHeader icon={Activity} title="Service health" description="Live status of every connected service — database, email, storage, payments, and AI. Auto-refreshes every 30 s." />
          <AdminHealthWatch />
        </>
      )}

      {section === "pop-ads" && (
        <>
          <StaffPageHeader icon={MousePointerClick} title="Pop-up ad banner" description="Create a promotional popup shown to visitors when they land on the storefront. Enable or disable it at any time." />
          <AdminPopAds />
        </>
      )}

      {section === "ad-notifications" && (
        <>
          <StaffPageHeader icon={Megaphone} title="Ad notifications" description="Send a promotional notification to all users or specific individuals. Appears in their notifications feed." />
          <AdminAdNotifications />
        </>
      )}

      {section === "email-campaigns" && (
        <>
          <StaffPageHeader icon={Mail} title="Email campaigns" description="Design and send promotional emails to all users or selected individuals using customizable content blocks." />
          <AdminEmailCampaigns />
        </>
      )}
    </div>
  );
}
