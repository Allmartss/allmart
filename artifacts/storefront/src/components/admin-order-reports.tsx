import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Flag, ChevronDown, ChevronUp, CheckCircle2, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type OrderReport = {
  id: number;
  orderId: number;
  userId: number | null;
  orderTrackingCode: string;
  reason: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

const statusColor: Record<string, string> = {
  open: "bg-amber-50 text-amber-700 border-amber-200",
  reviewed: "bg-blue-50 text-blue-700 border-blue-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function AdminOrderReports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: reports, isLoading } = useQuery<OrderReport[]>({
    queryKey: ["admin-order-reports"],
    queryFn: async () => {
      const res = await fetch("/api/admin/order-reports", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const [expanded, setExpanded] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  async function updateReport(id: number, status: string, adminNote?: string) {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/order-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, ...(adminNote !== undefined && { adminNote }) }),
      });
      if (!res.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({ queryKey: ["admin-order-reports"] });
      toast({ title: "Report updated" });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;

  const open = reports?.filter(r => r.status === "open") ?? [];
  const others = reports?.filter(r => r.status !== "open") ?? [];
  const sorted = [...open, ...others];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-semibold">Order Reports</h2>
          {open.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{open.length} open</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{reports?.length ?? 0} total</p>
      </div>

      {sorted.length === 0 && (
        <div className="rounded-xl border border-border/50 p-12 text-center text-muted-foreground">
          <Flag className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No order reports yet</p>
        </div>
      )}

      {sorted.map((report) => {
        const isExpanded = expanded === report.id;
        return (
          <div key={report.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold bg-muted px-2 py-0.5 rounded">
                    #{report.orderTrackingCode}
                  </span>
                  <Badge variant="outline" className={`text-xs px-2 py-0.5 capitalize ${statusColor[report.status] ?? "bg-muted"}`}>
                    {report.status === "open" ? <Clock className="h-3 w-3 mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {report.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(report.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
                <p className="text-sm text-foreground line-clamp-2">{report.reason}</p>
                {report.adminNote && !isExpanded && (
                  <p className="text-xs text-muted-foreground italic">Note: {report.adminNote}</p>
                )}
              </div>
              <div className="flex items-start gap-2 shrink-0">
                {report.status === "open" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                      disabled={saving === report.id}
                      onClick={() => updateReport(report.id, "reviewed")}
                    >
                      <Eye className="h-3 w-3" /> Mark reviewed
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={saving === report.id}
                      onClick={() => updateReport(report.id, "resolved")}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Resolve
                    </Button>
                  </>
                )}
                {report.status === "reviewed" && (
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={saving === report.id}
                    onClick={() => updateReport(report.id, "resolved")}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Resolve
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => setExpanded(isExpanded ? null : report.id)}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border/50 bg-muted/20 p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Full report</p>
                  <p className="text-sm">{report.reason}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Admin note</p>
                  <Textarea
                    placeholder="Add a note about this report…"
                    value={notes[report.id] ?? report.adminNote ?? ""}
                    onChange={(e) => setNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                    rows={2}
                    className="text-xs resize-none"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={saving === report.id}
                    onClick={() => updateReport(report.id, report.status, notes[report.id] ?? report.adminNote ?? "")}
                  >
                    Save note
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
