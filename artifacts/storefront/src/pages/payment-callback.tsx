import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearCart } from "@workspace/api-client-react";

const STORAGE_KEY = "nb_checkout_address";
const CONTACT_KEY = "nb_checkout_contact";
const CASHBACK_KEY = "nb_checkout_cashback";
const BONUS_KEY = "nb_checkout_bonus";

type Status = "loading" | "success" | "error" | "cancelled";

export default function PaymentCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    const stripeSessionId = params.get("session_id");
    const cancelled = params.get("cancelled");

    if (cancelled) {
      setStatus("cancelled");
      return;
    }

    async function verify() {
      try {
        let res: Response;

        if (stripeSessionId) {
          res = await fetch("/api/stripe/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ sessionId: stripeSessionId }),
          });
        } else {
          setStatus("error");
          setErrorMsg("No Stripe payment session was found in the return URL.");
          return;
        }

        const data = await res.json() as { id?: number; error?: string };

        if (!res.ok || data.error) {
          setStatus("error");
          setErrorMsg(data.error ?? "Payment verification failed. Please contact support.");
          return;
        }

        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(CONTACT_KEY);
        sessionStorage.removeItem(CASHBACK_KEY);
        sessionStorage.removeItem(BONUS_KEY);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CONTACT_KEY);
        localStorage.removeItem(CASHBACK_KEY);
        localStorage.removeItem(BONUS_KEY);
        void clearCart().catch(() => {
          // Keeping the cart is safer than losing it if cleanup is interrupted.
        });
        setOrderId(data.id ?? null);
        setStatus("success");
      } catch {
        setStatus("error");
        setErrorMsg("Network error. Please contact support if you were charged.");
      }
    }

    void verify();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold mb-2">Verifying your payment…</h1>
              <p className="text-muted-foreground text-sm">Please wait while we confirm your payment.</p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold mb-2">Payment confirmed!</h1>
              <p className="text-muted-foreground text-sm">Your order has been placed successfully. Check your email for confirmation.</p>
            </div>
            <div className="flex flex-col gap-3">
              {orderId && (
                <Button size="lg" onClick={() => setLocation(`/orders/${orderId}`)}>
                  View my order
                </Button>
              )}
              <Button variant="outline" size="lg" onClick={() => setLocation("/orders")}>
                All orders
              </Button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold mb-2">Verification failed</h1>
              <p className="text-muted-foreground text-sm">{errorMsg}</p>
            </div>
            <div className="flex flex-col gap-3">
              <Button size="lg" onClick={() => setLocation("/payment")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Try again
              </Button>
              <Button variant="outline" size="lg" onClick={() => setLocation("/support")}>
                Contact support
              </Button>
            </div>
          </>
        )}

        {status === "cancelled" && (
          <>
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <XCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold mb-2">Payment cancelled</h1>
              <p className="text-muted-foreground text-sm">You cancelled the payment. Your cart is still saved.</p>
            </div>
            <Button size="lg" onClick={() => setLocation("/payment")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to payment
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
