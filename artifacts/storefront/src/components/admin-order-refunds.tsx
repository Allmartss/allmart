import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type OrderRefund = {
  id: number;
  orderId: number;
  userId: number | null;
  orderTrackingCode: string;
  reason: string;
  description: string;
  imageUrl: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

const statusColor: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  reviewing: "bg-amber-50 text-amber-700 border-amber-200",
  reviewed: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3 mr-1" />,
  reviewing: <Clock className="h-3 w-3 mr-1" />,
  reviewed: <Eye className="h-3 w-3 mr-1" />,
  approved: <CheckCircle2 className="h-3 w-3 mr-1" />,
  rejected: <CheckCircle2 className="h-3 w-3 mr-1" />,
  resolved: <CheckCircle2 className="h-3 w-3 mr-1" />,
};

const statusLabel: Record<string, string> = {
  pending: "Reviewing",
  reviewing: "Reviewing",
  reviewed: "Reviewed",
  approved: "Resolved",
  rejected: "Resolved",
  resolved: "Resolved",
};

export function AdminOrderRefunds() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: refunds, isLoading } = useQuery<OrderRefund[]>({
    queryKey: ["admin-order-refunds"],
    queryFn: async () => {
      const res = await fetch("/api/admin/order-refunds", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const [expanded, setExpanded] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [showImage, setShowImage] = useState<number | null>(null);

  async function updateRefund(id: number, status: string, adminNote?: string) {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/order-refunds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, ...(adminNote !== undefined && { adminNote }) }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: ["admin-order-refunds"] });
      toast({ title: `Refund ${status}` });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;

  const pending = refunds?.filter(r => r.status === "pending" || r.status === "reviewing") ?? [];
  const others = refunds?.filter(r => r.status !== "pending" && r.status !== "reviewing") ?? [];
  const sorted = [...pending, ...others];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-violet-600" />
          <h2 className="text-lg font-semibold">Refund Requests</h2>
          {pending.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{pending.length} reviewing</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{refunds?.length ?? 0} total</p>
      </div>

      {sorted.length === 0 && (
        <div className="rounded-xl border border-border/50 p-12 text-center text-muted-foreground">
          <RotateCcw className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No refund requests yet</p>
        </div>
      )}

      {sorted.map((refund) => {
        const isExpanded = expanded === refund.id;
        return (
          <div key={refund.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold bg-muted px-2 py-0.5 rounded">
                    #{refund.orderTrackingCode}
                  </span>
                  <Badge variant="outline" className={`text-xs px-2 py-0.5 capitalize flex items-center ${statusColor[refund.status] ?? "bg-muted"}`}>
                    {statusIcon[refund.status]}
                    {statusLabel[refund.status] ?? refund.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(refund.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
                <p className="text-xs font-medium text-muted-foreground">{refund.reason}</p>
                <p className="text-sm line-clamp-2">{refund.description}</p>
              </div>
              <div className="flex items-start gap-2 shrink-0">
                {(refund.status === "pending" || refund.status === "reviewing") && (
                  <>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={saving === refund.id}
                      onClick={() => updateRefund(refund.id, "reviewed", notes[refund.id] ?? refund.adminNote ?? undefined)}
                    >
                      <Eye className="h-3 w-3" /> Mark reviewed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                      disabled={saving === refund.id}
                      onClick={() => updateRefund(refund.id, "resolved", notes[refund.id] ?? refund.adminNote ?? undefined)}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Resolve
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => setExpanded(isExpanded ? null : refund.id)}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border/50 bg-muted/20 p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Reason</p>
                    <p className="text-sm">{refund.reason}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{refund.description}</p>
                  </div>
                </div>

                {refund.imageUrl && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-muted-foreground">Proof image</p>
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2 gap-1" onClick={() => setShowImage(showImage === refund.id ? null : refund.id)}>
                        <Eye className="h-3 w-3" /> {showImage === refund.id ? "Hide" : "View"}
                      </Button>
                    </div>
                    {showImage === refund.id && (
                      <a href={refund.imageUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={refund.imageUrl}
                          alt="Proof"
                          className="max-h-64 rounded-lg border border-border/40 object-contain shadow-sm hover:opacity-90 transition-opacity"
                        />
                      </a>
                    )}
                  </div>
                )}

                {refund.resolvedAt && (
                  <p className="text-xs text-muted-foreground">
                    Resolved: {format(new Date(refund.resolvedAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Admin response (sent to customer)</p>
                  <Textarea
                    placeholder="Add a note or rejection reason…"
                    value={notes[refund.id] ?? refund.adminNote ?? ""}
                    onChange={(e) => setNotes(prev => ({ ...prev, [refund.id]: e.target.value }))}
                    rows={2}
                    className="text-xs resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={saving === refund.id}
                      onClick={() => updateRefund(refund.id, refund.status, notes[refund.id] ?? refund.adminNote ?? "")}
                    >
                      Save note
                    </Button>
                    {refund.status !== "resolved" && refund.status !== "approved" && refund.status !== "rejected" && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={saving === refund.id}
                        onClick={() => updateRefund(refund.id, "reviewed", notes[refund.id] ?? refund.adminNote ?? undefined)}
                      >
                        <Eye className="h-3 w-3 mr-1" /> Mark reviewed
                      </Button>
                    )}
                    {refund.status !== "resolved" && refund.status !== "approved" && refund.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                        disabled={saving === refund.id}
                        onClick={() => updateRefund(refund.id, "resolved", notes[refund.id] ?? refund.adminNote ?? undefined)}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve refund
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
