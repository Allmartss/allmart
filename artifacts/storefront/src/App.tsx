import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useVisitorTracker } from "@/hooks/use-visitor-tracker";
import { useGetCurrentUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Landing from "@/pages/landing";
import VideoPreview from "@/pages/video-preview";
import Home from "@/pages/home";
import Products from "@/pages/products";
import ProductDetail from "@/pages/product-detail";
import Assistant from "@/pages/assistant";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import Payment from "@/pages/payment";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Account from "@/pages/account";
import Admin from "@/pages/admin";
import PMConsole from "@/pages/pm";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import Notifications from "@/pages/notifications";
import Support from "@/pages/support";
import PaymentCallback from "@/pages/payment-callback";
import ShopLanding from "@/pages/shop-landing";
import Profile from "@/pages/profile";
import Security from "@/pages/security";
import Referral from "@/pages/referral";
import UserDashboard from "@/pages/user-dashboard";
import MyAccount from "@/pages/my-account";

const queryClient = new QueryClient();

const PROFILE_EXEMPT = ["/profile", "/my-account", "/account", "/signin", "/signup", "/reset-password"];

function ProfileGate() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: meData, isLoading } = useGetCurrentUser();
  const me = meData?.user ?? null;

  useEffect(() => {
    if (isLoading || !me) return;
    const exempt = PROFILE_EXEMPT.some(p => location === p || location.startsWith(p + "/"));
    if (!(me as { profileComplete?: boolean }).profileComplete && !exempt) {
      toast({
        title: "Complete your profile",
        description: "Please fill in your details to continue.",
      });
      setLocation("/profile");
    }
  }, [isLoading, me, location, setLocation, toast]);

  return null;
}

/** Auth-based redirects:
 *  - Guests at /home or /dashboard → /account (must log in first)
 *  - Logged-in users at / (landing) → /home (the store)
 */
function AuthRedirect() {
  const [location, setLocation] = useLocation();
  const { data: meData, isLoading } = useGetCurrentUser();
  const isLoggedIn = !isLoading && !!meData?.user;
  const isGuest    = !isLoading && !meData?.user;

  useEffect(() => {
    if (isLoading) return;
    if (isLoggedIn && location === "/") setLocation("/home");
    if (isGuest && (location === "/home" || location === "/dashboard")) setLocation("/account");
  }, [isLoading, isLoggedIn, isGuest, location, setLocation]);

  return null;
}

function Router() {
  const [location] = useLocation();
  useVisitorTracker();

  // Full-screen video page — no nav, no layout chrome
  if (location === "/video") {
    return <VideoPreview />;
  }

  return (
    <Layout>
      <ProfileGate />
      <AuthRedirect />
      <Switch>
        <Route path="/video" component={VideoPreview} />
        <Route path="/" component={Landing} />
        <Route path="/home" component={Home} />
        <Route path="/dashboard" component={UserDashboard} />
        <Route path="/products" component={Products} />
        <Route path="/products/:slug" component={ProductDetail} />
        <Route path="/assistant" component={Assistant} />
        <Route path="/cart" component={Cart} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/payment" component={Payment} />
        <Route path="/payment/callback" component={PaymentCallback} />
        <Route path="/orders" component={Orders} />
        <Route path="/orders/:id" component={OrderDetail} />
        <Route path="/account" component={Account} />
        <Route path="/signin" component={Account} />
        <Route path="/signup" component={Account} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/support" component={Support} />
        <Route path="/shop/:slug" component={ShopLanding} />
        <Route path="/profile" component={Profile} />
        <Route path="/security" component={Security} />
        <Route path="/referral" component={Referral} />
        <Route path="/my-account" component={MyAccount} />
        <Route path="/admin" component={() => <Admin section="dashboard" />} />
        <Route path="/admin/users" component={() => <Admin section="users" />} />
        <Route path="/admin/orders" component={() => <Admin section="orders" />} />
        <Route path="/admin/catalog" component={() => <Admin section="catalog" />} />
        <Route path="/admin/products" component={() => <Admin section="products" />} />
        <Route path="/admin/bank" component={() => <Admin section="bank" />} />
        <Route path="/admin/password" component={() => <Admin section="password" />} />
        <Route path="/admin/notifications" component={() => <Admin section="notifications" />} />
        <Route path="/admin/support" component={() => <Admin section="support" />} />
        <Route path="/admin/cashback" component={() => <Admin section="cashback" />} />
        <Route path="/admin/landing-pages" component={() => <Admin section="landing-pages" />} />
        <Route path="/admin/visitors" component={() => <Admin section="visitors" />} />
        <Route path="/admin/telegram" component={() => <Admin section="telegram" />} />
        <Route path="/admin/referrals" component={() => <Admin section="referrals" />} />
        <Route path="/admin/flash-sale" component={() => <Admin section="flash-sale" />} />
        <Route path="/admin/health" component={() => <Admin section="health" />} />
        <Route path="/pm" component={() => <PMConsole section="dashboard" />} />
        <Route path="/pm/orders" component={() => <PMConsole section="orders" />} />
        <Route path="/pm/catalog" component={() => <PMConsole section="catalog" />} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
