import { useState, useEffect, useRef } from "react";
import { 
  useListChatMessages, 
  useSendChatMessage, 
  useResetChat, 
  getListChatMessagesQueryKey, 
  getGetCartQueryKey, 
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Send, Trash2, Bot, User, Check, X, Package, CreditCard, Building2, Truck, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

type PaymentMethod = "stripe" | "bank_transfer" | "pay_on_delivery";

type BankDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber?: string;
  email?: string;
};

type TurnState = {
  needsConfirmation?: boolean;
  needsShippingAddress?: boolean;
  placedOrder?: any;
  stripeCheckoutUrl?: string | null;
  stripeError?: string | null;
  bankDetails?: BankDetails | null;
  addedToCart?: any[];
};

export default function Assistant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [content, setContent] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("pay_on_delivery");
  const [turnStates, setTurnStates] = useState<Record<number, TurnState>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: messages, isLoading } = useListChatMessages();

  const sendChat = useSendChatMessage({
    mutation: {
      onSuccess: (data: any) => {
        // Set turnStates BEFORE invalidating queries so the UI card is ready
        // when the refetched message list re-renders (avoids the race where
        // the message appears but stripeCheckoutUrl is still null).
        if (data.assistantMessage?.id) {
          setTurnStates(prev => ({
            ...prev,
            [data.assistantMessage.id]: {
              needsConfirmation: data.needsConfirmation,
              needsShippingAddress: data.needsShippingAddress,
              placedOrder: data.placedOrder,
              stripeCheckoutUrl: data.stripeCheckoutUrl ?? null,
              stripeError: data.stripeError ?? null,
              bankDetails: data.bankDetails ?? null,
              addedToCart: data.addedToCart ?? [],
            }
          }));
        }
        queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      }
    }
  });

  const resetChat = useResetChat({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChatMessagesQueryKey() });
        setTurnStates({});
        setContent("");
      }
    }
  });

  useEffect(() => {
    const prefill = sessionStorage.getItem("nb_prefill");
    const initialQuery = sessionStorage.getItem("initial_assistant_query");
    if (prefill) {
      setContent(prefill);
      sessionStorage.removeItem("nb_prefill");
    } else if (initialQuery) {
      setContent(initialQuery);
      sessionStorage.removeItem("initial_assistant_query");
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendChat.isPending, turnStates]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim() || sendChat.isPending) return;
    sendChat.mutate({ data: { content: content.trim() } });
    setContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleConfirmOrder = (messageId: number) => {
    // Always require a shipping address — collected upfront in the confirm card
    if (!shippingAddress || shippingAddress.trim().length < 3) {
      toast({ title: "Address required", description: "Please enter a valid shipping address.", variant: "destructive" });
      return;
    }
    const paymentLabel = {
      stripe: "Pay with card (Stripe)",
      bank_transfer: "Bank transfer",
      pay_on_delivery: "Pay on delivery",
    }[selectedPaymentMethod];
    sendChat.mutate({ 
      data: { 
        content: `Yes, please place the order. Payment method: ${paymentLabel}.`, 
        confirmOrder: true, 
        shippingAddress: shippingAddress.trim(),
        paymentMethod: selectedPaymentMethod,
      } 
    });
    setTurnStates(prev => ({
      ...prev,
      [messageId]: { ...prev[messageId], needsConfirmation: false }
    }));
  };

  const handleCancelOrder = (messageId: number) => {
    setTurnStates(prev => ({
      ...prev,
      [messageId]: { ...prev[messageId], needsConfirmation: false }
    }));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto w-full px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg leading-tight">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">Always here to help you shop</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2"
            onClick={() => resetChat.mutate()}
            disabled={resetChat.isPending || isLoading}
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-8 scroll-smooth">
        {isLoading ? (
          <div className="space-y-6">
            <div className="flex gap-4">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-20 w-3/4 rounded-2xl rounded-tl-sm" />
              </div>
            </div>
            <div className="flex gap-4 flex-row-reverse">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="space-y-2 flex-1 flex flex-col items-end">
                <Skeleton className="h-16 w-1/2 rounded-2xl rounded-tr-sm" />
              </div>
            </div>
          </div>
        ) : messages?.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-serif font-bold text-foreground">How can I help you today?</h2>
            <p className="max-w-sm">I can find products, add them to your cart, and place orders for you.</p>
          </div>
        ) : (
          messages?.map((msg) => {
            const isUser = msg.role === "user";
            const turnState = turnStates[msg.id];
            
            return (
              <div key={msg.id} className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${isUser ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"}`}>
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                
                <div className={`flex flex-col gap-1.5 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                  <div className={`px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${
                    isUser 
                      ? "bg-foreground text-background rounded-3xl rounded-tr-sm" 
                      : "bg-card border border-border/50 rounded-3xl rounded-tl-sm"
                  }`}>
                    {msg.content}
                  </div>

                  {/* Product suggestion cards */}
                  {!isUser && msg.productSuggestions && msg.productSuggestions.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5 w-full max-w-2xl">
                      {msg.productSuggestions.map((prod) => (
                        <Link key={prod.id} href={`/products/${prod.id}`}>
                          <Card className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer border-border/50 shadow-none">
                            <div className="w-14 h-14 rounded-lg bg-background flex items-center justify-center overflow-hidden shrink-0 border border-border/40">
                              {prod.imageUrl ? (
                                <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-contain mix-blend-multiply p-1" />
                              ) : (
                                <Package className="h-6 w-6 text-muted" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{prod.name}</h4>
                              <p className="text-primary text-sm font-semibold mt-0.5">
                                {new Intl.NumberFormat("en-US", { style: "currency", currency: prod.currency }).format(prod.price)}
                              </p>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Order confirmation widget */}
                  {turnState?.needsConfirmation && (
                    <Card className="mt-2 p-5 border-primary/20 bg-primary/5 w-full max-w-md space-y-4">
                      <h4 className="font-semibold text-primary flex items-center gap-2">
                        <Package className="h-4 w-4" /> Confirm your order
                      </h4>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Shipping Address</label>
                        <Textarea
                          value={shippingAddress}
                          onChange={(e) => setShippingAddress(e.target.value)}
                          placeholder="Enter your full delivery address..."
                          className="resize-none h-20 bg-background"
                        />
                      </div>

                      {/* Payment method picker */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Payment Method</label>
                        <div className="grid grid-cols-1 gap-2">
                          {(
                            [
                              { value: "stripe",           label: "Pay with Card",    icon: CreditCard },
                              { value: "bank_transfer",    label: "Bank Transfer",    icon: Building2 },
                              { value: "pay_on_delivery",  label: "Pay on Delivery",  icon: Truck },
                            ] as { value: PaymentMethod; label: string; icon: typeof CreditCard }[]
                          ).map(({ value, label, icon: Icon }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setSelectedPaymentMethod(value)}
                              className={cn(
                                "flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-sm font-medium transition-all text-left",
                                selectedPaymentMethod === value
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              {label}
                              {selectedPaymentMethod === value && (
                                <Check className="h-3.5 w-3.5 ml-auto" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3 pt-1">
                        <Button
                          onClick={() => handleConfirmOrder(msg.id)}
                          className="flex-1 gap-2"
                          disabled={sendChat.isPending}
                        >
                          <Check className="h-4 w-4" /> Confirm Order
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleCancelOrder(msg.id)}
                          className="flex-1 gap-2 bg-background"
                          disabled={sendChat.isPending}
                        >
                          <X className="h-4 w-4" /> Cancel
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* Stripe error */}
                  {turnState?.stripeError && !turnState.stripeCheckoutUrl && (
                    <Card className="mt-2 p-4 border-destructive/20 bg-destructive/5 w-full max-w-md space-y-2">
                      <h4 className="font-semibold text-destructive flex items-center gap-2 text-sm">
                        <CreditCard className="h-4 w-4" /> Card payment unavailable
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {turnState.stripeError}. Please choose bank transfer or pay on delivery instead.
                      </p>
                    </Card>
                  )}

                  {/* Stripe payment button */}
                  {turnState?.stripeCheckoutUrl && (
                    <Card className="mt-2 p-4 border-blue-500/20 bg-blue-500/5 w-full max-w-md space-y-3">
                      <h4 className="font-semibold text-blue-700 flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Complete Card Payment
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Click below to pay securely with Stripe. Your order will be confirmed after payment.
                      </p>
                      <a href={turnState.stripeCheckoutUrl} target="_blank" rel="noreferrer">
                        <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
                          <ExternalLink className="h-4 w-4" /> Pay with Card →
                        </Button>
                      </a>
                    </Card>
                  )}

                  {/* Bank transfer details */}
                  {turnState?.placedOrder && turnState.bankDetails && (
                    <Card className="mt-2 p-5 border-amber-500/20 bg-amber-500/5 w-full max-w-md space-y-3">
                      <h4 className="font-semibold text-amber-700 flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> Bank Transfer Details
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Transfer the exact order total and use your tracking code as the reference.
                      </p>
                      <div className="space-y-1.5 text-sm">
                        {turnState.bankDetails.bankName && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bank</span>
                            <span className="font-medium">{turnState.bankDetails.bankName}</span>
                          </div>
                        )}
                        {turnState.bankDetails.accountName && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Account Name</span>
                            <span className="font-medium">{turnState.bankDetails.accountName}</span>
                          </div>
                        )}
                        {turnState.bankDetails.accountNumber && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Account No.</span>
                            <span className="font-mono font-bold text-foreground">{turnState.bankDetails.accountNumber}</span>
                          </div>
                        )}
                        {turnState.bankDetails.routingNumber && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Routing</span>
                            <span className="font-mono">{turnState.bankDetails.routingNumber}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-amber-500/20">
                          <span className="text-muted-foreground">Tracking ref</span>
                          <span className="font-mono font-bold text-foreground">{turnState.placedOrder.trackingCode}</span>
                        </div>
                      </div>
                      <Link href={`/orders/${turnState.placedOrder.id}`}>
                        <Button variant="outline" size="sm" className="w-full bg-background">
                          View Order
                        </Button>
                      </Link>
                    </Card>
                  )}

                  {/* Pay on delivery / plain order success */}
                  {turnState?.placedOrder && !turnState.bankDetails && !turnState.stripeCheckoutUrl && (
                    <Card className="mt-2 p-4 border-emerald-500/20 bg-emerald-500/5 w-full max-w-md">
                      <div>
                        <h4 className="font-semibold text-emerald-700 flex items-center gap-2 mb-1">
                          <Check className="h-4 w-4" /> Order Placed Successfully
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Tracking Code: <span className="font-mono text-foreground font-medium">{turnState.placedOrder.trackingCode}</span>
                        </p>
                      </div>
                      <Link href={`/orders/${turnState.placedOrder.id}`}>
                        <Button variant="outline" size="sm" className="w-full bg-background border-emerald-500/20 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800">
                          View Order Details
                        </Button>
                      </Link>
                    </Card>
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {sendChat.isPending && (
          <div className="flex gap-4">
            <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-card border border-border/50 rounded-3xl rounded-tl-sm px-5 py-4 flex items-center gap-1.5 h-[52px]">
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="py-4 pb-8 shrink-0 relative bg-background">
        <form 
          onSubmit={handleSubmit}
          className="relative flex items-end gap-2 bg-card border-2 border-primary/20 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 rounded-3xl p-2 transition-all duration-300 shadow-sm"
        >
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to find products or place an order..."
            className="flex-1 min-h-[56px] max-h-32 resize-none border-0 shadow-none focus-visible:ring-0 py-3.5 px-4 bg-transparent text-[15px]"
            disabled={sendChat.isPending}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="h-12 w-12 rounded-full shrink-0 mb-1 mr-1"
            disabled={!content.trim() || sendChat.isPending}
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function Sparkles({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  );
}
