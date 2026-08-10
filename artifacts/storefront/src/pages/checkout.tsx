import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetCart, useGetCurrentUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ArrowLeft, MapPin, Package, User, Tag, CheckCircle2, XCircle, Gift, BookUser } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "nb_checkout_address";
const CONTACT_KEY = "nb_checkout_contact";
const CASHBACK_KEY = "nb_checkout_cashback";
const BONUS_KEY = "nb_checkout_bonus";

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

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: cart, isLoading } = useGetCart();
  const { data: meData, isLoading: isUserLoading } = useGetCurrentUser();
  const me = meData?.user ?? null;

  const [shippingAddress, setShippingAddress] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) ?? "",
  );
  const [contact, setContact] = useState<Contact>(() => {
    try { return JSON.parse(sessionStorage.getItem(CONTACT_KEY) ?? "null") ?? { name: "", email: "", phone: "" }; }
    catch { return { name: "", email: "", phone: "" }; }
  });
  const [cashbackInput, setCashbackInput] = useState("");
  const [cashback, setCashback] = useState<CashbackState>(() => {
    try { return JSON.parse(sessionStorage.getItem(CASHBACK_KEY) ?? "null"); }
    catch { return null; }
  });
  const [validating, setValidating] = useState(false);
  const [useBonus, setUseBonus] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(BONUS_KEY) ?? "false"); }
    catch { return false; }
  });
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const bonusBalance = (me as { bonusBalance?: number } | null)?.bonusBalance ?? 0;
  const profileAddress = (me as { address?: string | null } | null)?.address ?? null;
  const [useProfileAddr, setUseProfileAddr] = useState(false);

  // When user ticks "use profile address", fill the textarea; untick = clear to let them type
  function handleUseProfileAddr(checked: boolean) {
    setUseProfileAddr(checked);
    if (checked && profileAddress) {
      setShippingAddress(profileAddress);
    } else {
      setShippingAddress("");
    }
  }

  useEffect(() => {
    // Clear sensitive values that may have been left by older builds which
    // stored checkout state in localStorage.
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CONTACT_KEY);
    localStorage.removeItem(CASHBACK_KEY);
    localStorage.removeItem(BONUS_KEY);
  }, []);

  useEffect(() => {
    if (!isLoading && cart && cart.items.length === 0) setLocation("/cart");
  }, [isLoading, cart, setLocation]);

  useEffect(() => {
    if (!cart || cart.items.length === 0 || !me) {
      setQuote(null);
      return;
    }
    const controller = new AbortController();
    setQuoteLoading(true);
    fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        cashbackCode: cashback?.code || undefined,
        bonusApplied: useBonus,
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
  }, [cart, me, cashback?.code, useBonus]);

  // Guests must sign in; signed-in users must verify email before checkout
  useEffect(() => {
    if (isLoading || isUserLoading) return;
    const u = meData?.user as ({ emailVerified?: boolean } & Record<string, unknown>) | null | undefined;
    if (!u) {
      toast({ title: "Sign in required", description: "Please sign in to continue.", variant: "destructive" });
      setLocation("/account");
    } else if (!u.emailVerified) {
      toast({ title: "Verify your email", description: "Please verify your email before checking out.", variant: "destructive" });
      setLocation("/verify-email");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, meData]);

  async function validateCashback() {
    if (!cashbackInput.trim()) return;
    setValidating(true);
    try {
      const res = await fetch("/api/cashback/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cashbackInput.trim() }),
      });
      const data = await res.json() as { valid: boolean; amount?: number; code?: string; message?: string };
      if (data.valid && data.amount && data.code) {
        const cb = { code: data.code, amount: data.amount };
        setCashback(cb);
        sessionStorage.setItem(CASHBACK_KEY, JSON.stringify(cb));
        toast({ title: "Cashback applied!", description: data.message });
      } else {
        setCashback(null);
        sessionStorage.removeItem(CASHBACK_KEY);
        toast({ title: "Invalid code", description: data.message ?? "That code is not valid.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not validate code.", variant: "destructive" });
    } finally { setValidating(false); }
  }

  function removeCashback() {
    setCashback(null);
    setCashbackInput("");
    sessionStorage.removeItem(CASHBACK_KEY);
  }

  function toggleBonus(checked: boolean) {
    setUseBonus(checked);
    sessionStorage.setItem(BONUS_KEY, JSON.stringify(checked));
  }

  function continueToPayment() {
    if (shippingAddress.trim().length < 3) return;
    sessionStorage.setItem(STORAGE_KEY, shippingAddress.trim());
    sessionStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
    sessionStorage.setItem(BONUS_KEY, JSON.stringify(useBonus));
    setLocation("/payment");
  }

  if (isLoading || !cart) {
    return (
      <div className="container max-w-screen-lg mx-auto py-12 px-6">
        <Skeleton className="h-10 w-64 mb-8" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cart.currency }).format(n);

  const totalShipping = quote?.shippingFee ?? 0;
  const bonusApplied = useBonus;
  const bonusDeduction = quote?.bonusDiscount ?? 0;
  const grandTotal = quote?.total ?? 0;

  const canContinue =
    shippingAddress.trim().length >= 3 &&
    contact.name.trim().length >= 2 &&
    contact.phone.trim().length >= 7 &&
    (!contact.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) &&
    !!quote &&
    !quoteLoading;

  return (
    <div className="container max-w-screen-lg mx-auto py-12 px-6">
      <Link href="/cart">
        <Button variant="ghost" className="mb-6 gap-2 pl-0 hover:bg-transparent hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to cart
        </Button>
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
          <span className="font-semibold text-primary">Step 1 of 2</span>
          <span>· Shipping & Contact</span>
        </div>
        <h1 className="font-serif text-4xl font-bold tracking-tight">Checkout</h1>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-10 items-start">
        <div className="space-y-6">
          {/* Receiver info */}
          <Card className="p-6 border-border/50 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-lg">Receiver details</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="rec-name">Full name *</Label>
                <Input id="rec-name" placeholder="John Doe" value={contact.name}
                  onChange={e => setContact(c => ({ ...c, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-phone">Phone number *</Label>
                <Input id="rec-phone" placeholder="+1 (555) 000-0000" value={contact.phone}
                  onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-email">Email <span className="text-muted-foreground font-normal">(optional, for order updates)</span></Label>
              <Input id="rec-email" type="email" placeholder="john@example.com" value={contact.email}
                onChange={e => setContact(c => ({ ...c, email: e.target.value }))} />
              {contact.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) && (
                <p className="text-xs text-destructive">Enter a valid email address.</p>
              )}
            </div>
          </Card>

          {/* Shipping address */}
          <Card className="p-6 border-border/50 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-lg">Delivery address *</h2>
            </div>

            {/* Profile address shortcut — only shown when user has a saved address */}
            {profileAddress && (
              <label className="flex items-start gap-3 cursor-pointer p-3 mb-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
                <input
                  type="checkbox"
                  checked={useProfileAddr}
                  onChange={e => handleUseProfileAddr(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <BookUser className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-sm font-medium text-primary">Use my saved address</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{profileAddress}</p>
                </div>
                {useProfileAddr && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
              </label>
            )}

            <Textarea
              value={shippingAddress}
              onChange={(e) => {
                setShippingAddress(e.target.value);
                if (useProfileAddr) setUseProfileAddr(false);
              }}
              placeholder="Street address, city, state, postal code…"
              className="h-28 resize-none"
            />
          </Card>

          {/* Cashback */}
          <Card className="p-6 border-border/50 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-lg">Cashback code <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
            </div>
            {cashback ? (
              <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-primary">{cashback.code}</p>
                  <p className="text-xs text-muted-foreground">Saves you {fmt(cashback.amount)}</p>
                </div>
                <button onClick={removeCashback} className="p-1 hover:bg-muted rounded-full transition-colors">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code e.g. SAVE500"
                  value={cashbackInput}
                  onChange={e => setCashbackInput(e.target.value.toUpperCase())}
                  className="uppercase"
                />
                <Button onClick={validateCashback} disabled={validating || !cashbackInput.trim()} variant="outline">
                  {validating ? "..." : "Apply"}
                </Button>
              </div>
            )}
          </Card>

          <Button
            size="lg"
            className="w-full h-12 text-base font-semibold gap-2"
            disabled={!canContinue}
            onClick={continueToPayment}
          >
            {quoteLoading ? "Calculating total…" : "Continue to payment"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Order summary */}
        <Card className="p-6 border-border/50 shadow-sm sticky top-24">
          <h2 className="font-serif font-bold text-xl mb-4">Order summary</h2>
          <div className="space-y-3 mb-4 max-h-56 overflow-y-auto">
            {cart.items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/40 bg-muted/30 flex items-center justify-center">
                  {item.product.imageUrl
                    ? <img src={item.product.imageUrl} alt="" className="h-full w-full object-cover" />
                    : <Package className="h-4 w-4 text-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{item.product.name}</p>
                  <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                </div>
                <span className="text-sm font-medium">{fmt(item.product.price * item.quantity)}</span>
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

            {/* Bonus balance toggle */}
            {me && bonusBalance > 0 && (
              <div className="pt-1">
                <label className="flex items-start gap-3 cursor-pointer p-2.5 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={useBonus}
                    onChange={e => toggleBonus(e.target.checked)}
                    className="mt-0.5 accent-violet-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <Gift className="h-3.5 w-3.5 text-violet-600" />
                      <span className="text-sm font-medium text-violet-700">Use my bonus balance</span>
                    </div>
                    <p className="text-xs text-violet-500 mt-0.5">{fmt(bonusBalance)} available</p>
                  </div>
                </label>
                {bonusApplied && (
                  <div className="flex justify-between text-sm text-violet-600 font-medium mt-2">
                    <span>Bonus discount</span>
                    <span>-{fmt(bonusDeduction)}</span>
                  </div>
                )}
              </div>
            )}

             <div className="flex justify-between font-bold text-lg pt-2 border-t border-border/30">
              <span>Total</span>
               <span>{quoteLoading ? "Calculating…" : fmt(grandTotal)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
