import { useRoute, Link } from "wouter";
import { useGetOrder } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, Truck, CheckCircle2, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const id = Number(params?.id);
  
  const { data: order, isLoading } = useGetOrder(id);

  if (isLoading) {
    return (
      <div className="container max-w-screen-xl mx-auto py-12 px-6">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container max-w-screen-xl mx-auto py-24 px-6 text-center">
        <h2 className="text-3xl font-serif font-bold tracking-tight mb-4">Order not found</h2>
        <Link href="/orders">
          <Button variant="outline">Back to orders</Button>
        </Link>
      </div>
    );
  }

  const steps = [
    { id: 'placed', label: 'Order Placed', icon: Clock },
    { id: 'processing', label: 'Processing', icon: Package },
    { id: 'shipped', label: 'Shipped', icon: Truck },
    { id: 'delivered', label: 'Delivered', icon: CheckCircle2 }
  ];
  
  const currentStepIndex = steps.findIndex(s => s.id === order.status);
  const itemSubtotal = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cashbackDiscount = order.cashbackDiscount ?? 0;
  const bonusDiscount = order.bonusDiscount ?? 0;

  return (
    <div className="container max-w-screen-xl mx-auto py-12 px-6">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <Link href="/orders">
          <Button variant="ghost" className="gap-2 pl-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back to orders
          </Button>
        </Link>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Order ID</p>
          <p className="font-mono font-medium">{order.trackingCode}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          <Card className="p-6 border-border/50 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/50 to-muted" />
            <h2 className="font-serif font-bold text-xl mb-8">Order Status</h2>
            
            <div className="relative">
              <div className="absolute top-5 left-6 right-6 h-0.5 bg-muted" />
              <div className="absolute top-5 left-6 h-0.5 bg-primary transition-all duration-500" 
                   style={{ width: `${(Math.max(0, currentStepIndex) / (steps.length - 1)) * 100}%` }} />
              
              <div className="relative flex justify-between">
                {steps.map((step, index) => {
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  const Icon = step.icon;
                  
                  return (
                    <div key={step.id} className="flex flex-col items-center gap-3 relative z-10 w-12 sm:w-24">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors bg-background ${
                        isCompleted ? 'border-primary text-primary' : 'border-muted text-muted-foreground'
                      } ${isCurrent ? 'ring-4 ring-primary/10' : ''}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className={`text-xs font-medium text-center ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="bg-muted/30 p-4 px-6 border-b border-border/50">
              <h2 className="font-serif font-bold text-xl">Items</h2>
            </div>
            <div className="divide-y divide-border/50">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-4 px-6 flex gap-4 sm:items-center">
                  <div className="w-20 h-20 shrink-0 bg-muted/20 rounded-xl flex items-center justify-center overflow-hidden border border-border/40">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain mix-blend-multiply p-2" />
                    ) : (
                      <Package className="h-8 w-8 text-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:justify-between gap-2">
                    <div>
                      <h3 className="font-semibold line-clamp-1">{item.productName}</h3>
                      <p className="text-sm text-muted-foreground mt-1">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-left sm:text-right font-medium">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(item.unitPrice * item.quantity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          
        </div>
        
        <div className="space-y-8">
          <Card className="p-6 border-border/50 shadow-sm">
            <h2 className="font-serif font-bold text-xl mb-6">Order Summary</h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(itemSubtotal)}</span>
              </div>
              {cashbackDiscount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Cashback{order.cashbackCode ? ` (${order.cashbackCode})` : ""}</span>
                  <span>-{new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(cashbackDiscount)}</span>
                </div>
              )}
              {bonusDiscount > 0 && (
                <div className="flex justify-between text-violet-600">
                  <span>Bonus balance</span>
                  <span>-{new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(bonusDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{(order.shippingFee ?? 0) > 0
                  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(order.shippingFee ?? 0)
                  : "Free"}</span>
              </div>
              {order.paymentMethod && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Paid with</span>
                  <span className="capitalize">{order.paymentMethod.replace("_", " ")}</span>
                </div>
              )}
              <div className="border-t border-border/50 pt-4 flex justify-between font-bold text-xl">
                <span>Total</span>
                <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(order.total)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-border/50 shadow-sm">
            <h2 className="font-serif font-bold text-xl mb-6">Shipping Details</h2>
            <div className="flex items-start gap-3 text-muted-foreground">
              <MapPin className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
              <p className="leading-relaxed whitespace-pre-wrap text-foreground">
                {order.shippingAddress}
              </p>
            </div>
            
            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Order Date</span>
                <span className="font-medium">{format(new Date(order.createdAt), "MMMM d, yyyy")}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
