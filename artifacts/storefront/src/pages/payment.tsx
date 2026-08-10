import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCart,
  usePlaceOrder,
  useGetCurrentUser,
  clearCart,
  getGetCartQueryKey,
  getListOrdersQueryKey,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Building2,
  Wallet,
  CreditCard,
  Sparkles,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Upload,
  X,
  ImageIcon,
  Gift,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useImageUpload } from "@/hooks/use-image-upload";

const STORAGE_KEY = "nb_checkout_address";
const CONTACT_KEY = "nb_checkout_contact";
const CASHBACK_KEY = "nb_checkout_cashback";
const BONUS_KEY = "nb_checkout_bonus";

type Method = "stripe" | "transfer" | "delivery";

const ALL_METHODS: { id: Method; label: string; icon: React.ReactNode; hint: string; minTier?: number }[] = [
  { id: "stripe", label: "Pay with Stripe", icon: <CreditCard className="h-4 w-4" />, hint: "Card payment via Stripe — Visa, Mastercard & more" },
  { id: "transfer", label: "Manual bank transfer", icon: <Building2 className="h-4 w-4" />, hint: "Transfer to our account and confirm below" },
  { id: "delivery", label: "Pay on delivery", icon: <Wallet className="h-4 w-4" />, hint: "Cash or card when your order arrives", minTier: 3 },
];

type BankDetails = { bankName: string; accountName: string; accountNumber: string; routingNumber?: string; bankLogo?: string; email?: string };
type Contact = { name: string; email: string; phone: string };
type CashbackState = { code: string; amount: number } | null;
type CheckoutQuote = {
  subtotal: number;
  shippingFee: number;
  cashbackDiscount: number;
  bonusDiscount: number;
  total: number;
  currency: string;
  bonusBalance: number;
};

export default function Payment() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: cart, isLoading } = useGetCart();
  const { data: authData } = useGetCurrentUser();
  const user = authData?.user as ({ tier?: number; bonusBalance?: number } & Record<string, unknown>) | null | undefined;
  const [method, setMethod] = useState<Method>("stripe");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [cautionNote, setCautionNote] = useState<string>("");
  const [providerLoading, setProviderLoading] = useState(false);
  const [reference] = useState(
    () => "AM" + Math.random().toString(36).slice(2, 8).toUpperCase(),
  );

  const { upload, isUploading, progress } = useImageUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [paymentNote, setPaymentNote] = useState("");

  const address =
    typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) ?? "" : "";

  const contact: Contact = (() => {
    try { return JSON.parse(sessionStorage.getItem(CONTACT_KEY) ?? "null") ?? { name: "", email: "", phone: "" }; }
    catch { return { name: "", email: "", phone: "" }; }
  })();

  const cashback: CashbackState = (() => {
    try { return JSON.parse(sessionStorage.getItem(CASHBACK_KEY) ?? "null"); }
    catch { return null; }
  })();

  const bonusApplied: boolean = (() => {
    try { return JSON.parse(sessionStorage.getItem(BONUS_KEY) ?? "false"); }
    catch { return false; }
  })();

  // Redirect guests to sign-in before payment
  useEffect(() => {
    if (!isLoading && authData !== undefined && !authData?.user) {
      toast({ title: "Sign in required", description: "Please sign in or create an account to complete your order.", variant: "destructive" });
      setLocation("/account");
    }
  }, [authData, isLoading, setLocation, toast]);

  useEffect(() => {
    if (!address) setLocation("/checkout");
  }, [address, setLocation]);

  useEffect(() => {
    if (!cart || cart.items.length === 0 || !authData?.user) return;
    const controller = new AbortController();
    setQuoteLoading(true);
    fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        cashbackCode: cashback?.code || undefined,
        bonusApplied,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Quote unavailable");
        return await res.json() as CheckoutQuote;
      })
      .then(setQuote)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQuote(null);
      })
      .finally(() => setQuoteLoading(false));
    return () => controller.abort();
  }, [cart, authData?.user, cashback?.code, bonusApplied]);

  useEffect(() => {
    if (!isLoading && cart && cart.items.length === 0) setLocation("/cart");
  }, [isLoading, cart, setLocation]);

  useEffect(() => {
    fetch("/api/settings/bank")
      .then((r) => r.json())
      .then((d) => { setBankDetails(d as BankDetails); setBankLoaded(true); })
      .catch(() => setBankLoaded(true));
    fetch("/api/settings/bank-caution")
      .then((r) => r.json())
      .then((d: { note: string }) => setCautionNote(d.note))
      .catch(() => {});
  }, []);

  const placeOrder = usePlaceOrder({
    mutation: {
      onSuccess: (order) => {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(CONTACT_KEY);
        sessionStorage.removeItem(CASHBACK_KEY);
        sessionStorage.removeItem(BONUS_KEY);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CONTACT_KEY);
        localStorage.removeItem(CASHBACK_KEY);
        localStorage.removeItem(BONUS_KEY);
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["me-stats"] });
        void clearCart().catch(() => {
          // Keeping the cart is safer than losing it if the cleanup request blips.
        });
        toast({ title: "Order placed!", description: "Your order is on the way." });
        setLocation(`/orders/${order.id}`);
      },
      onError: () => {
        toast({ title: "Couldn't place your order", description: "Please try again.", variant: "destructive" });
      },
    },
  });

  const fmt = useCallback(
    (n: number) =>
      cart
        ? new Intl.NumberFormat("en-US", { style: "currency", currency: cart.currency }).format(n)
        : "",
    [cart],
  );

  async function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    try {
      const { servingUrl } = await upload(file);
      setScreenshotUrl(servingUrl);
      toast({ title: "Screenshot uploaded!" });
    } catch {
      setScreenshotPreview(null);
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    }
  }

  function confirmDeliveryOrTransfer() {
    placeOrder.mutate({
      data: {
        shippingAddress: address,
        placedBy: "user",
        receiverName: contact.name || undefined,
        receiverEmail: contact.email || undefined,
        receiverPhone: contact.phone || undefined,
        cashbackCode: cashback?.code || undefined,
        paymentMethod: method === "transfer" ? "bank_transfer" : "pay_on_delivery",
        paymentScreenshotUrl: screenshotUrl || undefined,
        paymentNote: paymentNote.trim() || undefined,
        bonusApplied: bonusApplied || undefined,
        expectedTotal: quote?.total,
        expectedBonusDiscount: quote?.bonusDiscount,
        deferCartClear: true,
      } as Parameters<typeof placeOrder.mutate>[0]["data"],
    });
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() =>
      toast({ title: "Copied", description: `${label} copied to clipboard.` }),
    );
  }

  function getCallbackUrl() {
    return `${window.location.origin}/payment/callback`;
  }

  async function openStripeCheckout() {
    if (!cart || !quote || quoteLoading) {
      toast({ title: "Calculating total", description: "Please wait while we refresh the checkout total." });
      return;
    }
    setProviderLoading(true);
    const email = authData?.user?.email ?? contact.email ?? "guest@allmart.com";

    try {
      const res = await fetch("/api/stripe/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          callbackUrl: getCallbackUrl(),
          shippingAddress: address,
          cashbackCode: cashback?.code || undefined,
          bonusApplied: bonusApplied || undefined,
        }),
      });
      const data = await res.json() as { checkoutUrl?: string; sessionId?: string; error?: string };

      if (!data.checkoutUrl) {
        toast({ title: "Stripe error", description: data.error ?? "Could not initialize payment", variant: "destructive" });
        return;
      }

      window.open(data.checkoutUrl, "_blank", "noopener");
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setProviderLoading(false);
    }
  }

  if (isLoading || !cart) {
    return (
      <div className="container max-w-screen-lg mx-auto py-12 px-6">
        <Skeleton className="h-10 w-64 mb-8" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const totalShipping = quote?.shippingFee ?? 0;
  const bonusDeduction = quote?.bonusDiscount ?? 0;
  const grandTotal = quote?.total ?? 0;

  return (
    <div className="container max-w-screen-lg mx-auto py-12 px-6">
      <Link href="/checkout">
        <Button variant="ghost" className="mb-6 gap-2 pl-0 hover:bg-transparent hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to shipping
        </Button>
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
          <span className="font-semibold text-primary">Step 2 of 2</span>
          <span>· Payment</span>
        </div>
        <h1 className="font-serif text-4xl font-bold tracking-tight">Payment</h1>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-10 items-start">
        <div className="space-y-6">
          <Card className="p-6 border-border/50 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">How would you like to pay?</h2>
            <div className="grid gap-2">
              {ALL_METHODS.map((m) => {
                const userTier = (user as { tier?: number } | null | undefined)?.tier ?? 0;
                const tierLocked = m.minTier !== undefined && userTier < m.minTier;
                const bankUnavailable = m.id === "transfer" && bankLoaded && !bankDetails?.bankName;
                const locked = tierLocked || bankUnavailable;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={locked}
                    onClick={() => !locked && setMethod(m.id)}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      locked
                        ? "opacity-50 cursor-not-allowed border-border/40 bg-muted/20"
                        : method === m.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${method === m.id && !locked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {m.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{m.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {bankUnavailable
                          ? "Not available — please try another payment option."
                          : tierLocked
                          ? "Not available for your account — contact support to upgrade."
                          : m.hint}
                      </p>
                    </div>
                    {method === m.id && !locked && <CheckCircle2 className="h-5 w-5 text-primary" />}
                    {locked && (
                      <span className="text-[10px] font-semibold bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                        {bankUnavailable ? "Unavailable" : "Locked"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {method === "stripe" && (
            <ProviderCard
              title="Pay securely with Stripe"
               description={<>Opens Stripe's checkout in a new tab. Pay <strong className="text-foreground">{quoteLoading ? "the calculated total" : fmt(grandTotal)}</strong> via Visa, Mastercard, or other cards. After payment, you'll be redirected back automatically.</>}
               buttonLabel={`Pay ${quoteLoading ? "…" : fmt(grandTotal)} with Stripe`}
              loading={providerLoading}
              onClick={openStripeCheckout}
            />
          )}

          {method === "transfer" && (
            <Card className="p-6 border-border/50 shadow-sm bg-primary/5 border-primary/20">
              {bankDetails?.bankLogo && (
                <div className="flex justify-center mb-4">
                  <img
                    src={bankDetails.bankLogo}
                    alt={bankDetails.bankName}
                    className="h-16 w-16 rounded-full object-cover border-2 border-border/40 shadow-sm"
                  />
                </div>
              )}
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Bank transfer details
              </h3>
              {bankDetails?.bankName ? (
                <dl className="space-y-3 text-sm">
                  <PayRow label="Bank" value={bankDetails.bankName} onCopy={copyToClipboard} />
                  <PayRow label="Account name" value={bankDetails.accountName} onCopy={copyToClipboard} />
                  <PayRow label="Account number" value={bankDetails.accountNumber} onCopy={copyToClipboard} />
                  {bankDetails.routingNumber && (
                    <PayRow label="Routing number" value={bankDetails.routingNumber} onCopy={copyToClipboard} />
                  )}
                  {(bankDetails as BankDetails).email && (
                    <PayRow label="Contact email" value={(bankDetails as BankDetails).email!} onCopy={copyToClipboard} />
                  )}
                   <PayRow label="Amount" value={quoteLoading ? "Calculating…" : fmt(grandTotal)} onCopy={copyToClipboard} />
                  <PayRow label="Reference" value={reference} onCopy={copyToClipboard} highlight />
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Bank details not yet configured. Please contact the store.</p>
              )}

              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 items-start">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-semibold block mb-0.5">Important</span>
                  {cautionNote || "Always include your reference number in the transfer description so we can match your payment to your order."}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Label className="text-sm font-semibold">Upload payment screenshot <span className="text-destructive font-normal">*</span></Label>
                <p className="text-xs text-muted-foreground">A screenshot of your transfer is required before your order can be submitted.</p>

                {screenshotPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={screenshotPreview}
                      alt="Payment screenshot"
                      className="max-h-48 rounded-xl border border-border/50 shadow-sm object-contain"
                    />
                    {isUploading && (
                      <div className="absolute inset-0 bg-background/60 rounded-xl flex flex-col items-center justify-center gap-2 p-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <Progress value={progress} className="w-full h-1.5" />
                        <span className="text-xs text-muted-foreground">{progress}%</span>
                      </div>
                    )}
                    {!isUploading && screenshotUrl && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <div className="bg-emerald-500 text-white rounded-full px-2 py-0.5 text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Uploaded
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setScreenshotPreview(null); setScreenshotUrl(null); }}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center shadow-sm hover:bg-destructive/90"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isUploading}
                    className="flex flex-col items-center gap-2 w-full rounded-xl border-2 border-dashed border-border/60 bg-muted/20 py-8 hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to upload screenshot</span>
                    <span className="text-xs text-muted-foreground/70">PNG, JPG, JPEG — max 5MB</span>
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleScreenshotUpload}
                />
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="pay-note" className="text-sm font-semibold">Additional note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  id="pay-note"
                  placeholder="e.g. Paid via Bank mobile app, transaction ID: 2927…"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  className="h-20 resize-none text-sm"
                />
              </div>
            </Card>
          )}

          {method === "delivery" && (
            <Card className="p-6 border-border/50 shadow-sm">
              <p className="text-sm text-muted-foreground">
                Our courier will collect payment on delivery. You'll be charged{" "}
                <span className="font-semibold text-foreground">{fmt(grandTotal)}</span>{" "}
                when your order arrives. Click below to confirm your order.
              </p>
            </Card>
          )}

          {(method === "transfer" || method === "delivery") && (
            <div className="space-y-2">
              {method === "transfer" && !screenshotUrl && !isUploading && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                  <Upload className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive font-medium">Upload your payment screenshot to continue.</p>
                </div>
              )}
              <Button
                size="lg"
                className="w-full h-14 text-base font-semibold gap-2"
                disabled={
                  placeOrder.isPending ||
                  isUploading ||
                  quoteLoading ||
                  !quote ||
                  (method === "transfer" && !screenshotUrl)
                }
                onClick={confirmDeliveryOrTransfer}
              >
                <CheckCircle2 className="h-5 w-5" />
                {placeOrder.isPending
                  ? "Placing order…"
                  : isUploading
                  ? "Uploading screenshot…"
                  : method === "transfer"
                  ? `I've paid · ${fmt(grandTotal)}`
                  : `Confirm order · ${fmt(grandTotal)}`}
              </Button>
            </div>
          )}
        </div>

        <Card className="p-6 border-border/50 shadow-sm sticky top-24">
          <h2 className="font-serif font-bold text-xl mb-4">Order summary</h2>
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {cart.items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/40 bg-muted/30">
                  {item.product.imageUrl && (
                    <img src={item.product.imageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{item.product.name}</p>
                  <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                </div>
                <span className="text-sm font-medium">
                  {fmt(item.product.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border/50 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>{fmt(quote?.subtotal ?? cart.subtotal)}</span>
            </div>
            {(quote?.cashbackDiscount ?? 0) > 0 && cashback && (
              <div className="flex justify-between text-sm text-primary font-medium">
                <span>Cashback ({cashback.code})</span>
                <span>-{fmt(quote?.cashbackDiscount ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              {totalShipping > 0
                ? <span className="text-red-500 font-medium">{fmt(totalShipping)}</span>
                : <span className="text-emerald-600 font-medium">Free</span>}
            </div>
            {bonusApplied && bonusDeduction > 0 && (
              <div className="flex justify-between text-sm text-violet-600 font-medium">
                <span className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> Bonus balance</span>
                <span>-{fmt(bonusDeduction)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-border/30">
              <span>Total</span>
              <span>{quoteLoading || !quote ? "Calculating…" : fmt(grandTotal)}</span>
            </div>
          </div>
          {contact.name && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Receiver</p>
              <p className="text-sm font-medium">{contact.name}</p>
              {contact.phone && <p className="text-xs text-muted-foreground">{contact.phone}</p>}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Shipping to</p>
            <p className="text-sm whitespace-pre-line">{address}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProviderCard({
  title,
  description,
  buttonLabel,
  loading,
  onClick,
}: {
  title: string;
  description: React.ReactNode;
  buttonLabel: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Card className="p-6 border-border/50 shadow-sm bg-primary/5 border-primary/20">
      <h3 className="font-semibold mb-2 flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-primary" /> {title}
      </h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <Button
        size="lg"
        className="w-full h-12 text-base font-semibold gap-2"
        disabled={loading}
        onClick={onClick}
      >
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening…</>
          : <><ExternalLink className="h-4 w-4" /> {buttonLabel}</>}
      </Button>
    </Card>
  );
}

function PayRow({
  label,
  value,
  highlight,
  onCopy,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  onCopy: (v: string, l: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2">
        <span className={`font-mono ${highlight ? "font-bold text-primary" : ""}`}>{value}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => onCopy(value, label)}
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </dd>
    </div>
  );
}
