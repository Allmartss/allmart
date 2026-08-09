import { useQueryClient } from "@tanstack/react-query";
import {
  useListAllOrders,
  updateOrderStatus,
  getListAllOrdersQueryKey,
  type Order,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Package, Clock, Truck, CheckCircle2, XCircle, RefreshCcw, ImageIcon, ShieldCheck, ShieldX, Eye, EyeOff, Download, Upload, ChevronDown, ChevronUp, User, MapPin, Phone, Mail, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";

type Status = "placed" | "confirmed" | "dispatched" | "delivered" | "cancelled";
type PaymentVerified = "pending" | "verified" | "rejected";

const STATUS_FLOW: Status[] = ["placed", "confirmed", "dispatched", "delivered"];

const statusIcon: Record<Status, React.ReactNode> = {
  placed: <Clock className="h-3.5 w-3.5" />,
  confirmed: <Package className="h-3.5 w-3.5" />,
  dispatched: <Truck className="h-3.5 w-3.5" />,
  delivered: <CheckCircle2 className="h-3.5 w-3.5" />,
  cancelled: <XCircle className="h-3.5 w-3.5" />,
};

const statusColor: Record<Status, string> = {
  placed: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  dispatched: "bg-violet-50 text-violet-700 border-violet-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

const statusLabel: Record<Status, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const payVerifiedColor: Record<PaymentVerified, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

const payVerifiedLabel: Record<PaymentVerified, string> = {
  pending: "Pending verification",
  verified: "Payment verified",
  rejected: "Payment rejected",
};

type ExtendedOrder = Order & {
  receiverName?: string;
  receiverEmail?: string;
  receiverPhone?: string;
  shippingFee?: number | null;
  cashbackDiscount?: number;
  cashbackCode?: string;
  bonusDiscount?: number | null;
  paymentScreenshotUrl?: string;
  paymentNote?: string;
  paymentVerified?: string;
};

export function OrdersManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: orders, isLoading } = useListAllOrders();
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [expandedScreenshot, setExpandedScreenshot] = useState<number | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    try {
      const res = await fetch("/api/admin/orders/export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Orders exported as CSV" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const csv = await file.text();
      const res = await fetch("/api/admin/orders/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      await queryClient.invalidateQueries({ queryKey: getListAllOrdersQueryKey() });
      toast({ title: `Import complete — ${data.inserted} added, ${data.updated} updated, ${data.skipped} skipped` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  async function setStatus(order: Order, status: Status) {
    if (order.status === status) return;
    setUpdatingId(order.id);
    try {
      await updateOrderStatus(order.id, { status });
      await queryClient.invalidateQueries({ queryKey: getListAllOrdersQueryKey() });
      toast({ title: `Order #${order.id} → ${statusLabel[status]}` });
    } catch {
      toast({ title: "Error updating order", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  }

  async function setPaymentVerified(orderId: number, status: PaymentVerified) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/verify-payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: getListAllOrdersQueryKey() });
      toast({ title: `Payment ${status} for order #${orderId}` });
    } catch {
      toast({ title: "Error updating payment status", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <h3 className="font-serif text-xl font-bold">Orders</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" /> {importing ? "Importing…" : "Import CSV"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Move orders through fulfillment. Verify payment screenshots where provided.</p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading orders…</p>
      ) : !orders || orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const ext = order as ExtendedOrder;
            const status = order.status as Status;
            const isCancelled = status === "cancelled";
            const isDelivered = status === "delivered";
            const isUpdating = updatingId === order.id;
            const payVerified = (ext.paymentVerified ?? "pending") as PaymentVerified;
            const hasScreenshot = !!ext.paymentScreenshotUrl;
            const isExpanded = expandedScreenshot === order.id;

            return (
              <div key={order.id} className={`rounded-xl border p-4 ${isCancelled ? "border-rose-200/60 bg-rose-50/30" : "border-border/40 bg-background"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">Order #{order.id}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${statusColor[status] ?? statusColor.placed}`}>
                        {statusIcon[status] ?? statusIcon.placed}
                        {statusLabel[status] ?? status}
                      </span>
                      {order.placedBy === "ai" && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">AI</span>
                      )}
                      {hasScreenshot && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${payVerifiedColor[payVerified]}`}>
                          {payVerified === "verified" ? <ShieldCheck className="h-3 w-3" /> : payVerified === "rejected" ? <ShieldX className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                          {payVerifiedLabel[payVerified]}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.items.length} item{order.items.length === 1 ? "" : "s"}
                      {" · "}{fmt(order.total)}
                      {ext.cashbackDiscount ? <span className="text-primary"> (cashback -${ext.cashbackDiscount.toLocaleString()})</span> : ""}
                      {" · "}{order.trackingCode}
                    </p>
                    {ext.receiverName && (
                      <p className="text-xs text-muted-foreground">Receiver: {ext.receiverName}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Ship to: {order.shippingAddress}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString("en-US")}</p>
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    {/* Flow buttons */}
                    {!isCancelled && !isDelivered && (
                      <div className="flex flex-wrap gap-1">
                        {STATUS_FLOW.map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={s === status ? "default" : "outline"}
                            className="h-7 text-xs px-2"
                            onClick={() => setStatus(order, s)}
                            disabled={isUpdating}
                          >
                            {statusLabel[s]}
                          </Button>
                        ))}
                      </div>
                    )}
                    {isDelivered && (
                      <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Delivered
                      </span>
                    )}
                    {/* Cancel / restore */}
                    {!isCancelled && !isDelivered && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => { if (confirm("Cancel this order?")) setStatus(order, "cancelled"); }}
                        disabled={isUpdating}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                      </Button>
                    )}
                    {isCancelled && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setStatus(order, "placed")}
                        disabled={isUpdating}
                      >
                        <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Restore
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {order.items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-2 py-1">
                      <img src={item.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      <span className="text-xs">{item.productName} × {item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Full checkout details toggle */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground -ml-1 mb-1"
                  onClick={() => setExpandedDetails(expandedDetails === order.id ? null : order.id)}
                >
                  {expandedDetails === order.id
                    ? <><ChevronUp className="h-3.5 w-3.5" /> Hide details</>
                    : <><ChevronDown className="h-3.5 w-3.5" /> Full checkout details</>}
                </Button>

                {expandedDetails === order.id && (
                  <div className="mt-2 rounded-xl border border-border/40 bg-muted/10 p-4 space-y-4 text-sm">
                    {/* Receiver info */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" /> Receiver
                      </p>
                      <div className="grid gap-1 text-xs">
                        {ext.receiverName && <div className="flex gap-2"><span className="text-muted-foreground w-28 shrink-0">Name</span><span className="font-medium">{ext.receiverName}</span></div>}
                        {ext.receiverEmail && <div className="flex gap-2"><Mail className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" /><span className="text-muted-foreground w-24 shrink-0">Email</span><span>{ext.receiverEmail}</span></div>}
                        {ext.receiverPhone && <div className="flex gap-2"><Phone className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" /><span className="text-muted-foreground w-24 shrink-0">Phone</span><span>{ext.receiverPhone}</span></div>}
                        <div className="flex gap-2"><MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" /><span className="text-muted-foreground w-24 shrink-0">Address</span><span>{order.shippingAddress}</span></div>
                      </div>
                    </div>

                    {/* Items table */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Items</p>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/30">
                            <th className="text-left pb-1 font-medium text-muted-foreground">Product</th>
                            <th className="text-center pb-1 font-medium text-muted-foreground w-12">Qty</th>
                            <th className="text-right pb-1 font-medium text-muted-foreground w-20">Unit price</th>
                            <th className="text-right pb-1 font-medium text-muted-foreground w-20">Line total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item) => (
                            <tr key={item.productId} className="border-b border-border/20 last:border-0">
                              <td className="py-1.5 flex items-center gap-2">
                                <img src={item.imageUrl} alt="" className="h-7 w-7 rounded object-cover border border-border/30" />
                                <span>{item.productName}</span>
                              </td>
                              <td className="py-1.5 text-center">{item.quantity}</td>
                              <td className="py-1.5 text-right">{fmt(item.unitPrice)}</td>
                              <td className="py-1.5 text-right font-medium">{fmt(item.unitPrice * item.quantity)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Price breakdown */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5" /> Price breakdown
                      </p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{fmt(order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0))}</span>
                        </div>
                        {ext.shippingFee != null && ext.shippingFee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Shipping fee</span>
                            <span className="text-red-500">{fmt(ext.shippingFee)}</span>
                          </div>
                        )}
                        {ext.cashbackDiscount != null && ext.cashbackDiscount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Cashback {ext.cashbackCode ? `(${ext.cashbackCode})` : ""}</span>
                            <span className="text-primary">-{fmt(ext.cashbackDiscount)}</span>
                          </div>
                        )}
                        {ext.bonusDiscount != null && ext.bonusDiscount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bonus balance</span>
                            <span className="text-violet-600">-{fmt(ext.bonusDiscount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold pt-1 border-t border-border/30">
                          <span>Total paid</span>
                          <span>{fmt(order.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment screenshot section */}
                {hasScreenshot && (
                  <div className="mt-3 rounded-xl border border-border/40 bg-muted/10 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-primary" /> Payment screenshot attached
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2 gap-1"
                        onClick={() => setExpandedScreenshot(isExpanded ? null : order.id)}
                      >
                        {isExpanded ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> View</>}
                      </Button>
                    </div>

                    {isExpanded && (
                      <a href={ext.paymentScreenshotUrl!} target="_blank" rel="noopener noreferrer" className="block">
                        <img
                          src={ext.paymentScreenshotUrl!}
                          alt="Payment proof"
                          className="max-h-64 rounded-lg border border-border/40 object-contain shadow-sm hover:opacity-90 transition-opacity"
                        />
                      </a>
                    )}

                    {ext.paymentNote && (
                      <p className="text-xs text-muted-foreground italic">"{ext.paymentNote}"</p>
                    )}

                    {/* Verification buttons */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={payVerified === "verified" ? "default" : "outline"}
                        className={`h-7 text-xs gap-1 ${payVerified === "verified" ? "bg-emerald-600 hover:bg-emerald-700 text-white border-0" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}
                        onClick={() => setPaymentVerified(order.id, "verified")}
                        disabled={isUpdating}
                      >
                        <ShieldCheck className="h-3 w-3" /> Approve payment
                      </Button>
                      <Button
                        size="sm"
                        variant={payVerified === "rejected" ? "default" : "outline"}
                        className={`h-7 text-xs gap-1 ${payVerified === "rejected" ? "bg-rose-600 hover:bg-rose-700 text-white border-0" : "border-rose-300 text-rose-700 hover:bg-rose-50"}`}
                        onClick={() => setPaymentVerified(order.id, "rejected")}
                        disabled={isUpdating}
                      >
                        <ShieldX className="h-3 w-3" /> Reject payment
                      </Button>
                      {payVerified !== "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2 text-muted-foreground"
                          onClick={() => setPaymentVerified(order.id, "pending")}
                          disabled={isUpdating}
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
