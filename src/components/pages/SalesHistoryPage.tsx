import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBranches, useBranchSelection, formatKsh } from "@/lib/cloud-store";
import { printReceipt, downloadReceiptPDF } from "@/lib/receipt";
import type { SaleRecord, CartItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Printer,
  Download,
  Receipt,
  Loader2,
  RefreshCw,
  Calendar,
} from "lucide-react";

type SaleRow = {
  id: string;
  business_id: string;
  branch_id: string;
  customer_id: string | null;
  customer_name: string | null;
  receipt_no: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  status: string;
  created_at: string;
};

type SaleItemRow = {
  id: string;
  sale_id: string;
  product_kind: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  meta: Record<string, unknown> | null;
};

type DateFilter = "today" | "7d" | "30d" | "all";

function startOfRange(filter: DateFilter): Date | null {
  const now = new Date();
  if (filter === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (filter === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (filter === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  return null;
}

function paymentBadgeVariant(method: string) {
  switch (method) {
    case "cash":
      return "default" as const;
    case "mpesa":
      return "secondary" as const;
    case "card":
      return "outline" as const;
    case "credit":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function SalesHistoryPage() {
  const { activeBusinessId, isBusinessAdmin, isSystemOwner, isSupervisor, businesses } = useAuth();
  const { branches } = useBranches();
  const { activeBranchId } = useBranchSelection();
  const canViewAll = isSystemOwner || isBusinessAdmin || isSupervisor;

  const [scope, setScope] = useState<"branch" | "all">("branch");
  const [dateRange, setDateRange] = useState<DateFilter>("7d");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [openSale, setOpenSale] = useState<SaleRow | null>(null);
  const [openItems, setOpenItems] = useState<SaleItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const activeBiz = businesses.find((b) => b.id === activeBusinessId);
  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const receiptOpts = useMemo(
    () => ({
      businessName: activeBiz?.name ?? "TimberYard POS",
      branchName: activeBranch?.name ?? "Main Branch",
    }),
    [activeBiz, activeBranch],
  );

  // Force scope=branch if user can't view all
  useEffect(() => {
    if (!canViewAll && scope !== "branch") setScope("branch");
  }, [canViewAll, scope]);

  const loadSales = async () => {
    if (!activeBusinessId) {
      setSales([]);
      setLoading(false);
      return;
    }
    setRefreshing(true);
    let q = supabase
      .from("sales")
      .select("id,business_id,branch_id,customer_id,customer_name,receipt_no,subtotal,discount,total,payment_method,status,created_at")
      .eq("business_id", activeBusinessId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (scope === "branch" && activeBranchId) q = q.eq("branch_id", activeBranchId);
    const start = startOfRange(dateRange);
    if (start) q = q.gte("created_at", start.toISOString());
    if (paymentFilter !== "all") q = q.eq("payment_method", paymentFilter);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);

    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setSales([]);
    } else {
      setSales((data as SaleRow[]) ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    setLoading(true);
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, activeBranchId, scope, dateRange, paymentFilter, statusFilter]);

  // Realtime: refresh on new sales
  useEffect(() => {
    if (!activeBusinessId) return;
    const channel = supabase
      .channel("sales-history")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales", filter: `business_id=eq.${activeBusinessId}` },
        () => loadSales(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, activeBranchId, scope, dateRange, paymentFilter, statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sales;
    const q = search.toLowerCase();
    return sales.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        (s.receipt_no ?? "").toLowerCase().includes(q) ||
        (s.customer_name ?? "").toLowerCase().includes(q),
    );
  }, [sales, search]);

  const totals = useMemo(() => {
    const total = filtered.reduce((sum, s) => sum + Number(s.total ?? 0), 0);
    const count = filtered.length;
    const credit = filtered.filter((s) => s.status === "credit").reduce((sum, s) => sum + Number(s.total ?? 0), 0);
    return { total, count, credit };
  }, [filtered]);

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";

  async function openSaleDetail(sale: SaleRow) {
    setOpenSale(sale);
    setOpenItems([]);
    setLoadingItems(true);
    const { data, error } = await supabase
      .from("sale_items")
      .select("id,sale_id,product_kind,product_id,description,quantity,unit_price,total,meta")
      .eq("sale_id", sale.id)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setOpenItems((data as SaleItemRow[]) ?? []);
    setLoadingItems(false);
  }

  function buildReceipt(sale: SaleRow, items: SaleItemRow[]): SaleRecord {
    const cartItems: CartItem[] = items.map((it) => ({
      lineId: it.id,
      kind: it.product_kind === "timber" ? "timber" : "hardware",
      productId: it.product_id ?? "",
      name: it.description.split(" — ")[0] ?? it.description,
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      unitLabel: ((it.meta as { unit?: string } | null)?.unit) ?? "",
      total: Number(it.total),
    }));
    return {
      id: sale.id,
      date: sale.created_at,
      customerId: sale.customer_id,
      customerName: sale.customer_name ?? "Walk-in",
      items: cartItems,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      total: Number(sale.total),
      payment: (sale.payment_method as SaleRecord["payment"]) ?? "cash",
      status: (sale.status as SaleRecord["status"]) ?? "paid",
    };
  }

  async function reprint(sale: SaleRow, action: "print" | "pdf") {
    let items = openSale?.id === sale.id ? openItems : [];
    if (items.length === 0) {
      const { data } = await supabase
        .from("sale_items")
        .select("id,sale_id,product_kind,product_id,description,quantity,unit_price,total,meta")
        .eq("sale_id", sale.id)
        .order("created_at", { ascending: true });
      items = (data as SaleItemRow[]) ?? [];
    }
    const opts = {
      ...receiptOpts,
      branchName: branches.find((b) => b.id === sale.branch_id)?.name ?? receiptOpts.branchName,
    };
    const record = buildReceipt(sale, items);
    if (action === "print") printReceipt(record, opts);
    else downloadReceiptPDF(record, opts);
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Sales History</h1>
        <p className="text-sm text-muted-foreground">
          Browse, search and reprint past sales{canViewAll ? " across branches." : " in your branch."}
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Card className="p-3 md:p-4">
          <div className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Sales</div>
          <div className="text-xl md:text-2xl font-bold">{totals.count}</div>
        </Card>
        <Card className="p-3 md:p-4">
          <div className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">Revenue</div>
          <div className="text-xl md:text-2xl font-bold truncate">{formatKsh(totals.total)}</div>
        </Card>
        <Card className="p-3 md:p-4">
          <div className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">On Credit</div>
          <div className="text-xl md:text-2xl font-bold truncate text-warning">{formatKsh(totals.credit)}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 md:p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipt #, customer..."
              className="pl-9 h-10"
            />
          </div>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateFilter)}>
            <SelectTrigger className="h-10">
              <Calendar className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="mpesa">M-Pesa</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {canViewAll ? (
            <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
              <button
                onClick={() => setScope("branch")}
                className={`px-3 py-1.5 text-xs font-semibold rounded ${scope === "branch" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                Current branch
              </button>
              <button
                onClick={() => setScope("all")}
                className={`px-3 py-1.5 text-xs font-semibold rounded ${scope === "all" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                All branches
              </button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{activeBranch?.name ?? "Branch"}</span>
          )}
          <Button variant="outline" size="sm" onClick={loadSales} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </Card>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No sales found</p>
            <p className="text-xs mt-1">Try widening the date range or clearing filters.</p>
          </Card>
        ) : (
          filtered.map((sale) => (
            <Card
              key={sale.id}
              className="p-3 md:p-4 hover:border-accent/50 transition-colors cursor-pointer"
              onClick={() => openSaleDetail(sale)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">
                      #{(sale.receipt_no ?? sale.id).slice(-6).toUpperCase()}
                    </span>
                    <Badge variant={paymentBadgeVariant(sale.payment_method)} className="text-[10px] uppercase">
                      {sale.payment_method}
                    </Badge>
                    {sale.status === "credit" && (
                      <Badge variant="outline" className="text-[10px] uppercase border-warning text-warning">
                        Credit
                      </Badge>
                    )}
                    {scope === "all" && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {branchName(sale.branch_id)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {sale.customer_name ?? "Walk-in"} · {new Date(sale.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-base md:text-lg font-bold">{formatKsh(Number(sale.total))}</div>
                  {Number(sale.discount) > 0 && (
                    <div className="text-[10px] text-success">−{formatKsh(Number(sale.discount))}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    reprint(sale, "print");
                  }}
                >
                  <Printer className="h-3 w-3 mr-1" /> Reprint
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    reprint(sale, "pdf");
                  }}
                >
                  <Download className="h-3 w-3 mr-1" /> PDF
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!openSale} onOpenChange={(o) => !o && setOpenSale(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Receipt #{openSale ? (openSale.receipt_no ?? openSale.id).slice(-6).toUpperCase() : ""}
            </SheetTitle>
          </SheetHeader>
          {openSale && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Date</div>
                  <div className="font-medium">{new Date(openSale.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Customer</div>
                  <div className="font-medium truncate">{openSale.customer_name ?? "Walk-in"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Branch</div>
                  <div className="font-medium">{branchName(openSale.branch_id)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Payment</div>
                  <div className="font-medium uppercase">{openSale.payment_method}</div>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Items
                </div>
                {loadingItems ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : openItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-3">No items recorded.</div>
                ) : (
                  <ul className="space-y-2">
                    {openItems.map((it) => (
                      <li key={it.id} className="flex items-start justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{it.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {it.quantity} × {formatKsh(Number(it.unit_price))}
                          </div>
                        </div>
                        <div className="font-semibold flex-shrink-0">{formatKsh(Number(it.total))}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatKsh(Number(openSale.subtotal))}</span>
                </div>
                {Number(openSale.discount) > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount</span>
                    <span>−{formatKsh(Number(openSale.discount))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                  <span>Total</span>
                  <span>{formatKsh(Number(openSale.total))}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={() => reprint(openSale, "print")}>
                  <Printer className="h-4 w-4 mr-2" /> Reprint
                </Button>
                <Button variant="outline" onClick={() => reprint(openSale, "pdf")}>
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </Button>
              </div>
              {(isBusinessAdmin || isSystemOwner) && openSale.status !== "refunded" && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={async () => {
                    const reason = prompt("Refund reason?");
                    if (reason == null) return;
                    const { error } = await supabase.rpc("refund_sale", { _sale_id: openSale.id, _reason: reason });
                    if (error) return toast.error(error.message);
                    toast.success("Sale refunded — stock restored");
                    setOpenSale(null);
                    loadSales();
                  }}
                >
                  Refund Sale
                </Button>
              )}
              {openSale.status === "refunded" && (
                <div className="rounded-md bg-destructive/10 text-destructive p-3 text-xs">
                  Refunded{openSale.refund_reason ? ` — ${openSale.refund_reason}` : ""}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
