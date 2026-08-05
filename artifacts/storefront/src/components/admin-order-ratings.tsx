import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

type OrderRating = {
  id: number;
  orderId: number;
  userId: number | null;
  orderTrackingCode: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}`}
        />
      ))}
    </div>
  );
}

const ratingLabel: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
};

const ratingColor: Record<number, string> = {
  1: "bg-rose-50 text-rose-700 border-rose-200",
  2: "bg-orange-50 text-orange-700 border-orange-200",
  3: "bg-amber-50 text-amber-700 border-amber-200",
  4: "bg-emerald-50 text-emerald-700 border-emerald-200",
  5: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export function AdminOrderRatings() {
  const { data: ratings, isLoading } = useQuery<OrderRating[]>({
    queryKey: ["admin-order-ratings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/order-ratings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;

  const total = ratings?.length ?? 0;
  const avg = total > 0
    ? (ratings!.reduce((s, r) => s + r.rating, 0) / total).toFixed(1)
    : null;

  // Distribution
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: ratings?.filter(r => r.rating === star).length ?? 0,
  }));

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
          <h2 className="text-lg font-semibold">Order Ratings</h2>
        </div>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-border/50 p-12 text-center text-muted-foreground">
          <Star className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No ratings yet</p>
        </div>
      ) : (
        <>
          {/* Stats summary card */}
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 grid sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="text-4xl font-bold text-amber-500">{avg}</div>
              <div>
                <div className="flex gap-0.5 mb-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      className={`h-4 w-4 ${s <= Math.round(Number(avg)) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{total} {total === 1 ? "rating" : "ratings"}</p>
              </div>
            </div>
            <div className="space-y-1">
              {dist.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs w-4 text-right text-muted-foreground">{star}</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-4">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Individual ratings */}
          <div className="space-y-3">
            {ratings!.map((rating) => (
              <div key={rating.id} className="rounded-xl border border-border/50 bg-card p-4 flex flex-col sm:flex-row justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold bg-muted px-2 py-0.5 rounded">
                      #{rating.orderTrackingCode}
                    </span>
                    <Badge variant="outline" className={`text-xs px-2 py-0.5 flex items-center gap-1 ${ratingColor[rating.rating]}`}>
                      <Star className="h-3 w-3 fill-current" />
                      {ratingLabel[rating.rating] ?? rating.rating}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(rating.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <StarDisplay rating={rating.rating} />
                  {rating.comment && (
                    <p className="text-sm text-muted-foreground italic">"{rating.comment}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
