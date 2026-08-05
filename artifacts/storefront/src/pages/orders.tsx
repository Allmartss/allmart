import { useRef, useState } from "react";
import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Package, ArrowRight, Clock, CreditCard, ImageIcon,
  ShieldCheck, ShieldX, Upload, X, Loader2, RefreshCcw,
  Flag, RotateCcw, Star,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useImageUpload } from "@/hooks/use-image-upload";

type ExtOrder = {
  id: number;
  status: string;
  total: number;
  currency: string;
  trackingCode: string;
  createdAt: string;
  items: { productId: number; productName: string; quantity: number; imageUrl?: string }[];
  paymentScreenshotUrl?: string;
  paymentVerified?: string;
  paymentNote?: string;
};

/* ─── Resubmit Payment Panel ─────────────────────────────────────────────── */
function ResubmitPanel({ order, onDone }: { order: ExtOrder; onDone: () => void }) {
  const { toast } = useToast();
  const { upload, isUploading, progress, error } = useImageUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [note, setNote] = useState(order.paymentNote ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    try {
      const result = await upload(file);
      setScreenshotUrl(result.servingUrl);
    } catch {
      setPreview(null);
    }
  }

  async function handleSubmit() {
    if (!screenshotUrl) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/resubmit-payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paymentScreenshotUrl: screenshotUrl, paymentNote: note }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Payment screenshot resubmitted", description: "We'll review it shortly." });
      onDone();
    } catch {
      toast({ title: "Failed to resubmit", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-5 sm:px-8 pb-5 pt-0">
      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldX className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-700">Payment rejected</p>
            <p className="text-xs text-rose-600/80 mt-0.5">
              Your previous screenshot could not be verified. Please upload a clear photo of your payment receipt.
            </p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {!preview ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-rose-200 rounded-lg p-4 flex flex-col items-center gap-2 text-rose-400 hover:border-rose-400 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <Upload className="h-6 w-6" />
            <span className="text-xs font-medium">Click to upload new payment screenshot</span>
          </button>
        ) : (
          <div className="relative">
            <img src={preview} alt="Preview" className="w-full max-h-48 rounded-lg object-contain border border-border/40" />
            {!isUploading && !screenshotUrl && (
              <button
                onClick={() => { setPreview(null); setScreenshotUrl(null); }}
                className="absolute top-2 right-2 bg-background/90 rounded-full p-1 shadow"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {isUploading && (
              <div className="mt-2 space-y-1">
                <Progress value={progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground text-center">{progress}% uploading…</p>
              </div>
            )}
            {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
          </div>
        )}

        <Textarea
          placeholder="Add a note (optional) — e.g. reference number, transfer time…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="text-xs resize-none"
        />

        <div className="flex gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!screenshotUrl || isUploading || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Resubmit payment
          </Button>
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setPreview(null); setScreenshotUrl(null); setNote(""); }}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Report Order Panel ──────────────────────────────────────────────────── */
function ReportPanel({ order, onClose }: { order: ExtOrder; onClose: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/order-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: order.id, reason: reason.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Report submitted", description: "Our team will review your report shortly." });
      onClose();
    } catch {
      toast({ title: "Failed to submit report", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-5 sm:px-8 pb-5 pt-0">
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Flag className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-700">Report order #{order.trackingCode}</p>
              <p className="text-xs text-amber-600/80 mt-0.5">
                Describe the issue with this order. We'll investigate and follow up.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <Textarea
          placeholder="Describe the issue — e.g. wrong item received, item damaged, missing package…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="text-xs resize-none"
        />

        <div className="flex gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            disabled={!reason.trim() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
            Submit report
          </Button>
          <Button size="sm" variant="ghost" className="text-xs" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Refund Request Panel ────────────────────────────────────────────────── */
const REFUND_REASONS = [
  "Item not as described",
  "Item damaged or defective",
  "Wrong item received",
  "Item never arrived",
  "Changed my mind",
  "Duplicate order",
  "Other",
];

function RefundPanel({ order, onClose }: { order: ExtOrder; onClose: () => void }) {
  const { toast } = useToast();
  const { upload, isUploading, progress, error: uploadError } = useImageUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    try {
      const result = await upload(file);
      setImageUrl(result.servingUrl);
    } catch {
      setPreview(null);
    }
  }

  async function handleSubmit() {
    if (!reason || !description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/order-refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orderId: order.id,
          reason,
          description: description.trim(),
          imageUrl: imageUrl ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed");
      }
      toast({ title: "Refund request submitted", description: "We'll review your request and respond within 2–3 business days." });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast({ title: "Failed to submit", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-5 sm:px-8 pb-5 pt-0">
      <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <RotateCcw className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-violet-700">Request refund — #{order.trackingCode}</p>
              <p className="text-xs text-violet-600/80 mt-0.5">
                Explain what happened and upload a photo as proof.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Reason select */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-violet-700">Reason</p>
          <div className="flex flex-wrap gap-1.5">
            {REFUND_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  reason === r
                    ? "bg-violet-600 text-white border-violet-600"
                    : "border-violet-200 text-violet-700 hover:bg-violet-100"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <Textarea
          placeholder="Describe exactly what happened to the product…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="text-xs resize-none"
        />

        {/* Image proof upload */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-violet-700">Upload proof image <span className="text-rose-600">*</span></p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {!preview ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-violet-200 rounded-lg p-4 flex flex-col items-center gap-2 text-violet-400 hover:border-violet-400 hover:text-violet-500 transition-colors cursor-pointer"
            >
              <Upload className="h-5 w-5" />
              <span className="text-xs font-medium">Click to upload a photo of the issue</span>
            </button>
          ) : (
            <div className="relative">
              <img src={preview} alt="Proof" className="w-full max-h-40 rounded-lg object-contain border border-border/40" />
              {!isUploading && (
                <button
                  onClick={() => { setPreview(null); setImageUrl(null); }}
                  className="absolute top-2 right-2 bg-background/90 rounded-full p-1 shadow"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {isUploading && (
                <div className="mt-2 space-y-1">
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground text-center">{progress}% uploading…</p>
                </div>
              )}
              {uploadError && <p className="text-xs text-rose-600 mt-1">{uploadError}</p>}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            disabled={!reason || !description.trim() || !imageUrl || isUploading || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Submit refund request
          </Button>
          <Button size="sm" variant="ghost" className="text-xs" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Rate Order Panel ────────────────────────────────────────────────────── */
function RatePanel({ order, onClose }: { order: ExtOrder; onClose: () => void }) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/order-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: order.id, rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Thank you for your rating!", description: "Your feedback helps us improve." });
      onClose();
    } catch {
      toast({ title: "Failed to submit rating", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  return (
    <div className="px-5 sm:px-8 pb-5 pt-0">
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Star className="h-4 w-4 text-amber-500 mt-0.5 shrink-0 fill-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-700">Rate order #{order.trackingCode}</p>
              <p className="text-xs text-amber-600/80 mt-0.5">How was your overall experience?</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Star picker */}
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setRating(s)}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
                    s <= (hovered || rating)
                      ? "fill-amber-400 text-amber-400"
                      : "fill-muted text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          {(hovered || rating) > 0 && (
            <p className="text-xs font-semibold text-amber-600">{labels[hovered || rating]}</p>
          )}
        </div>

        <Textarea
          placeholder="Leave a comment (optional) — what did you love or what could be better?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="text-xs resize-none"
        />

        <div className="flex gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
            disabled={!rating || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5 fill-white" />}
            Submit rating
          </Button>
          <Button size="sm" variant="ghost" className="text-xs" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Orders Page ────────────────────────────────────────────────────── */
export default function Orders() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useListOrders();
  const [activePanel, setActivePanel] = useState<{ id: number; type: "report" | "refund" | "rate" } | null>(null);

  function handleResubmitDone() {
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  }

  function togglePanel(orderId: number, type: "report" | "refund" | "rate") {
    setActivePanel((prev) =>
      prev?.id === orderId && prev?.type === type ? null : { id: orderId, type }
    );
  }

  if (isLoading) {
    return (
      <div className="container max-w-screen-xl mx-auto py-12 px-6">
        <h1 className="text-4xl font-serif font-bold tracking-tight mb-10">Your Orders</h1>
        <div className="grid gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="container max-w-screen-xl mx-auto py-24 px-6 text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Package className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-3xl font-serif font-bold tracking-tight mb-4">No orders yet</h2>
        <p className="text-muted-foreground mb-8">
          You haven't placed any orders. Start exploring our collection to find something you love.
        </p>
        <Link href="/products">
          <Button size="lg" className="w-full sm:w-auto h-12 px-8">Start Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-screen-xl mx-auto py-12 px-6">
      <h1 className="text-4xl font-serif font-bold tracking-tight mb-10">Your Orders</h1>

      <div className="grid gap-6">
        {orders.map((order) => {
          const ext = order as unknown as ExtOrder;
          const pv = ext.paymentVerified ?? "pending";
          const hasScreenshot = !!ext.paymentScreenshotUrl;
          const isRejected = hasScreenshot && pv === "rejected";
          const panel = activePanel?.id === order.id ? activePanel.type : null;

          return (
            <Card key={order.id} className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="bg-muted/30 p-5 sm:px-8 border-b border-border/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-0.5">Order Placed</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(new Date(order.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Total</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(order.total)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Tracking</p>
                    <p className="font-mono text-xs mt-0.5 font-medium bg-background px-2 py-0.5 rounded border border-border/50">
                      {order.trackingCode}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Badge variant="outline" className={`capitalize px-3 py-1 font-medium ${
                    order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200' :
                    order.status === 'dispatched' ? 'bg-violet-500/10 text-violet-700 border-violet-200' :
                    order.status === 'confirmed' ? 'bg-blue-500/10 text-blue-700 border-blue-200' :
                    order.status === 'cancelled' ? 'bg-rose-500/10 text-rose-700 border-rose-200' :
                    'bg-primary/10 text-primary border-primary/20'
                  }`}>
                    {order.status}
                  </Badge>
                  {hasScreenshot && (
                    <Badge variant="outline" className={`px-3 py-1 font-medium flex items-center gap-1 ${
                      pv === "verified" ? "bg-emerald-500/10 text-emerald-700 border-emerald-200" :
                      pv === "rejected" ? "bg-rose-500/10 text-rose-700 border-rose-200" :
                      "bg-amber-500/10 text-amber-700 border-amber-200"
                    }`}>
                      {pv === "verified" ? <ShieldCheck className="h-3.5 w-3.5" /> :
                       pv === "rejected" ? <ShieldX className="h-3.5 w-3.5" /> :
                       <ImageIcon className="h-3.5 w-3.5" />}
                      {pv === "verified" ? "Payment verified" :
                       pv === "rejected" ? "Payment rejected" :
                       "Awaiting verification"}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Items + actions row */}
              <div className="p-5 sm:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex gap-3">
                  {order.items.slice(0, 4).map((item, i) => (
                    <div key={i} className="w-16 h-16 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-center overflow-hidden relative">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain mix-blend-multiply p-1" />
                      ) : (
                        <Package className="h-6 w-6 text-muted" />
                      )}
                      {item.quantity > 1 && (
                        <span className="absolute bottom-0 right-0 bg-background/90 text-[10px] font-bold px-1.5 rounded-tl">
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                  ))}
                  {order.items.length > 4 && (
                    <div className="w-16 h-16 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center text-sm font-medium text-muted-foreground">
                      +{order.items.length - 4}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {/* Report */}
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-1.5 text-xs ${panel === "report" ? "bg-amber-50 border-amber-300 text-amber-700" : "text-muted-foreground hover:text-amber-700 hover:border-amber-300"}`}
                    onClick={() => togglePanel(order.id, "report")}
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Report
                  </Button>

                  {/* Request Refund */}
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-1.5 text-xs ${panel === "refund" ? "bg-violet-50 border-violet-300 text-violet-700" : "text-muted-foreground hover:text-violet-700 hover:border-violet-300"}`}
                    onClick={() => togglePanel(order.id, "refund")}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Request Refund
                  </Button>

                  {/* Rate */}
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-1.5 text-xs ${panel === "rate" ? "bg-amber-50 border-amber-300 text-amber-600" : "text-muted-foreground hover:text-amber-600 hover:border-amber-300"}`}
                    onClick={() => togglePanel(order.id, "rate")}
                  >
                    <Star className="h-3.5 w-3.5" />
                    Rate Order
                  </Button>

                  {/* View Details */}
                  <Link href={`/orders/${order.id}`}>
                    <Button variant="outline" className="shrink-0 gap-2 text-xs">
                      View Details <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Active panels */}
              {panel === "report" && (
                <ReportPanel order={ext} onClose={() => setActivePanel(null)} />
              )}
              {panel === "refund" && (
                <RefundPanel order={ext} onClose={() => setActivePanel(null)} />
              )}
              {panel === "rate" && (
                <RatePanel order={ext} onClose={() => setActivePanel(null)} />
              )}

              {/* Resubmit payment (always shown if rejected) */}
              {isRejected && (
                <ResubmitPanel order={ext} onDone={handleResubmitDone} />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
