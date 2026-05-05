import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TreePine, Package, TrendingUp, Loader2 } from "lucide-react";
import {
  formatKsh,
  useBranchSelection,
  useHardware,
  useTimber,
  useSales,
} from "@/lib/cloud-store";

type Range = "today" | "week" | "month";

export function ReportsPage() {
  const { activeBranchId } = useBranchSelection();
  const { items: sales, loading: salesLoading } = useSales(activeBranchId);
  const { items: hardware } = useHardware(activeBranchId);
  const { items: timber } = useTimber(activeBranchId);
  const [range, setRange] = useState<Range>("week");

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === "today" ? 86400000 : range === "week" ? 7 * 86400000 : 30 * 86400000;
    return sales.filter(
      (s) => s.status !== "refunded" && now - new Date(s.created_at).getTime() <= cutoff,
    );
  }, [sales, range]);

  const totalRev = filtered.reduce((s, x) => s + Number(x.total), 0);
  const cashRev = filtered.filter((s) => s.payment_method !== "credit").reduce((s, x) => s + Number(x.total), 0);
  const creditRev = filtered.filter((s) => s.payment_method === "credit").reduce((s, x) => s + Number(x.total), 0);
  const avgSale = filtered.length ? totalRev / filtered.length : 0;

  const days = range === "today" ? 1 : range === "week" ? 7 : 30;
  const series = Array.from({ length: days }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const label = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
    const dayKey = d.toDateString();
    const total = sales
      .filter((s) => s.status !== "refunded" && new Date(s.created_at).toDateString() === dayKey)
      .reduce((sum, s) => sum + Number(s.total), 0);
    return { label, total };
  });
  const max = Math.max(...series.map((s) => s.total), 1);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Sales & inventory insights.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {(["today", "week", "month"] as Range[]).map((r) => (
            <Button
              key={r}
              variant={range === r ? "default" : "ghost"}
              size="sm"
              onClick={() => setRange(r)}
              className="capitalize"
            >
              {r}
            </Button>
          ))}
        </div>
      </header>

      {salesLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Revenue" value={formatKsh(totalRev)} icon={TrendingUp} />
            <StatCard label="Transactions" value={filtered.length.toString()} icon={BarChart3} />
            <StatCard label="Cash / Card / M-Pesa" value={formatKsh(cashRev)} />
            <StatCard label="Credit Sales" value={formatKsh(creditRev)} />
          </div>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-1">Revenue Trend</h2>
            <p className="text-xs text-muted-foreground mb-4">Average sale: {formatKsh(avgSale)}</p>
            <div className="flex items-end gap-2 h-48">
              {series.map((d) => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                  <div className="text-[10px] font-semibold text-muted-foreground">
                    {d.total > 0 ? formatKsh(d.total).replace("KSh ", "") : ""}
                  </div>
                  <div
                    className="w-full rounded-t-md bg-[image:var(--gradient-amber)] min-h-[2px] transition-all"
                    style={{ height: `${(d.total / max) * 100}%` }}
                  />
                  <div className="text-[10px] text-muted-foreground truncate">{d.label}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <TreePine className="h-5 w-5 text-timber" /> Timber Stock
              </h2>
              <div className="space-y-2">
                {timber.length === 0 && <p className="text-sm text-muted-foreground">No timber.</p>}
                {timber.map((t) => {
                  const cap = Math.max(t.low_stock_threshold * 5, 100);
                  const pct = Math.min(100, (t.pieces / cap) * 100);
                  return (
                    <div key={t.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">
                          {t.species} {t.thickness}×{t.width}×{t.length}
                        </span>
                        <span className="text-muted-foreground">{t.pieces} pcs</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[image:var(--gradient-timber)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-hardware" /> Top Hardware (by value)
              </h2>
              <div className="space-y-2">
                {hardware.length === 0 && <p className="text-sm text-muted-foreground">No hardware.</p>}
                {[...hardware]
                  .sort((a, b) => Number(b.price) * Number(b.stock) - Number(a.price) * Number(a.stock))
                  .slice(0, 6)
                  .map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div>
                        <div className="text-sm font-medium">{h.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {h.stock} {h.unit} @ {formatKsh(Number(h.price))}
                        </div>
                      </div>
                      <div className="text-sm font-bold">
                        {formatKsh(Number(h.price) * Number(h.stock))}
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3">Recent Transactions</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="py-2">Date</th>
                    <th className="py-2">Customer</th>
                    <th className="py-2">Payment</th>
                    <th className="py-2 text-right">Subtotal</th>
                    <th className="py-2 text-right">Discount</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 20).map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-2 text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 font-medium">{s.customer_name ?? "Walk-in"}</td>
                      <td className="py-2 uppercase text-xs font-semibold">{s.payment_method}</td>
                      <td className="py-2 text-right">{formatKsh(Number(s.subtotal))}</td>
                      <td className="py-2 text-right text-success">−{formatKsh(Number(s.discount))}</td>
                      <td className="py-2 text-right font-bold">{formatKsh(Number(s.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof BarChart3;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-xl font-bold mt-1">{value}</div>
        </div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
    </Card>
  );
}
