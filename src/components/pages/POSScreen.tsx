import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  useHardware,
  useTimber,
  useCustomers,
  useBranchSelection,
  useBranches,
  useMpesaTransactions,
  formatKsh,
  type CloudHardware,
  type CloudTimber,
} from "@/lib/cloud-store";
import { initiateStkPush, queryStkStatus, attachMpesaToSale } from "@/server/mpesa.functions";
import { useServerFn } from "@tanstack/react-start";
import { printReceipt, downloadReceiptPDF } from "@/lib/receipt";
import type { SaleRecord, CartItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  Plus,
  Minus,
  TreePine,
  Package,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  CheckCircle2,
  ShoppingBag,
  Printer,
  Download,
  Loader2,
  RefreshCw,
  Lock,
} from "lucide-react";

interface PosLine {
  lineId: string;
  kind: "hardware" | "timber";
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitLabel: string;
  total: number;
  meta?: Record<string, unknown>;
}

type Tab = "all" | "timber" | string;

export function POSScreen() {
  const { activeBusinessId, isBusinessAdmin, isSystemOwner, businesses } = useAuth();
  const activeBiz = businesses.find((b) => b.id === activeBusinessId);
  const canOverride = isBusinessAdmin || isSystemOwner;

  const { activeBranchId } = useBranchSelection();
  const { branches } = useBranches();
  const activeBranch = branches.find((b) => b.id === activeBranchId);

  const { items: hardware, reload: reloadHardware } = useHardware(activeBranchId);
  const { items: timber, reload: reloadTimber } = useTimber(activeBranchId);
  const { items: customers } = useCustomers();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [cart, setCart] = useState<PosLine[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string>("");
  const [discountPct, setDiscountPct] = useState(0);
  const [overrideTotal, setOverrideTotal] = useState<string>("");
  const [overridePinOpen, setOverridePinOpen] = useState(false);
  const [pin, setPin] = useState("");

  const [timberDialog, setTimberDialog] = useState<CloudTimber | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastSale, setLastSale] = useState<SaleRecord | null>(null);

  // M-Pesa STK
  const [mpesaOpen, setMpesaOpen] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [mpesaTxnId, setMpesaTxnId] = useState<string | null>(null);
  const [mpesaPolling, setMpesaPolling] = useState(false);
  const stkPushFn = useServerFn(initiateStkPush);
  const queryStkFn = useServerFn(queryStkStatus);
  const attachFn = useServerFn(attachMpesaToSale);
  const { items: mpesaTxns, reload: reloadMpesa } = useMpesaTransactions(activeBranchId);

  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const customer = customers.find((c) => c.id === activeCustomerId);
  const categories = useMemo(() => {
    const set = new Set(hardware.map((h) => h.category).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [hardware]);

  const filteredHardware = useMemo(() => {
    let list = hardware;
    if (tab !== "all" && tab !== "timber") list = list.filter((h) => h.category === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.sku ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [hardware, tab, search]);

  const showTimber = tab === "all" || tab === "timber";
  const filteredTimber = useMemo(() => {
    if (!showTimber) return [];
    if (!search.trim()) return timber;
    const q = search.toLowerCase();
    return timber.filter(
      (t) =>
        t.species.toLowerCase().includes(q) ||
        (t.grade ?? "").toLowerCase().includes(q),
    );
  }, [timber, showTimber, search]);

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const totalDiscPct = discountPct + Number(customer?.loyalty_discount_pct ?? 0);
  const discountAmt = (subtotal * totalDiscPct) / 100;
  const computed = Math.max(0, subtotal - discountAmt);
  const overrideNum = parseFloat(overrideTotal);
  const usingOverride = canOverride && !isNaN(overrideNum) && overrideTotal !== "";
  const finalTotal = usingOverride ? overrideNum : computed;

  function addHardwareItem(h: CloudHardware) {
    setCart((prev) => {
      const existing = prev.find((c) => c.kind === "hardware" && c.productId === h.id);
      if (existing) {
        return prev.map((c) =>
          c.lineId === existing.lineId
            ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.unitPrice }
            : c,
        );
      }
      return [
        ...prev,
        {
          lineId: `L-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: "hardware",
          productId: h.id,
          name: h.name,
          description: h.sku ?? "",
          quantity: 1,
          unitPrice: Number(h.price),
          unitLabel: h.unit,
          total: Number(h.price),
        },
      ];
    });
  }

  function addTimberLine(t: CloudTimber, pieces: number, unitPrice: number) {
    const desc = `${t.thickness}×${t.width}×${t.length}${t.length_unit} ${t.grade ?? ""}`.trim();
    setCart((prev) => [
      ...prev,
      {
        lineId: `L-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: "timber",
        productId: t.id,
        name: t.species,
        description: desc,
        quantity: pieces,
        unitPrice,
        unitLabel: "pc",
        total: pieces * unitPrice,
        meta: { pieces, species: t.species, grade: t.grade },
      },
    ]);
  }

  function updateQty(lineId: string, qty: number) {
    setCart((prev) =>
      prev.map((c) =>
        c.lineId === lineId
          ? { ...c, quantity: qty, total: qty * c.unitPrice }
          : c,
      ),
    );
  }

  function removeLine(lineId: string) {
    setCart((prev) => prev.filter((c) => c.lineId !== lineId));
  }

  function clearCart() {
    setCart([]);
    setDiscountPct(0);
    setOverrideTotal("");
    setActiveCustomerId("");
  }

  async function completePayment(method: "cash" | "card" | "mpesa" | "credit", mpesaTxnAttach?: string) {
    if (!activeBusinessId || !activeBranchId) {
      toast.error("Select an active branch first");
      return;
    }
    if (cart.length === 0) return;
    if (method === "credit" && !activeCustomerId) {
      toast.error("Select a customer for credit sales");
      return;
    }
    setBusy(true);
    try {
      const itemsPayload = cart.map((c) => ({
        product_kind: c.kind,
        product_id: c.productId,
        description: `${c.name}${c.description ? " — " + c.description : ""}`,
        quantity: c.quantity,
        unit_price: c.unitPrice,
        total: c.total,
        meta: c.meta ?? {},
      }));
      const { data: saleId, error } = await supabase.rpc("create_sale", {
        _business_id: activeBusinessId,
        _branch_id: activeBranchId,
        _customer_id: (activeCustomerId || null) as string,
        _customer_name: customer?.name ?? "Walk-in",
        _subtotal: subtotal,
        _discount: subtotal - finalTotal,
        _total: finalTotal,
        _payment_method: method,
        _status: method === "credit" ? "credit" : "paid",
        _price_override: usingOverride,
        _original_total: (usingOverride ? computed : null) as number,
        _items: itemsPayload as never,
      });
      if (error) throw error;

      if (mpesaTxnAttach && saleId) {
        try {
          await attachFn({ data: { txn_id: mpesaTxnAttach, sale_id: saleId as string } });
        } catch (e) {
          console.error(e);
        }
      }

      const cartItems: CartItem[] = cart.map((c) => ({
        lineId: c.lineId,
        kind: c.kind,
        productId: c.productId,
        name: c.name,
        description: c.description,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        unitLabel: c.unitLabel,
        total: c.total,
      }));
      const sale: SaleRecord = {
        id: (saleId as string) ?? `s-${Date.now()}`,
        date: new Date().toISOString(),
        customerId: activeCustomerId || null,
        customerName: customer?.name ?? "Walk-in",
        items: cartItems,
        subtotal,
        discount: subtotal - finalTotal,
        total: finalTotal,
        payment: method,
        status: method === "credit" ? "credit" : "paid",
      };
      setLastSale(sale);
      clearCart();
      setPayOpen(false);
      setMpesaOpen(false);
      setConfirmOpen(true);
      reloadHardware();
      reloadTimber();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // M-Pesa STK push flow
  async function startStkPush() {
    if (!activeBusinessId || !activeBranchId) return;
    if (!mpesaPhone.match(/^(?:254|0|\+254)?[71]\d{8}$/)) {
      toast.error("Enter a valid Kenyan phone (e.g. 0712345678)");
      return;
    }
    setBusy(true);
    try {
      const res = await stkPushFn({
        data: {
          business_id: activeBusinessId,
          branch_id: activeBranchId,
          phone: mpesaPhone,
          amount: finalTotal,
          reference: "POS",
          description: "POS Sale",
        },
      });
      if (!res.ok || !res.txn) {
        toast.error(res.error || "STK push failed");
        return;
      }
      setMpesaTxnId(res.txn.id);
      setMpesaPolling(true);
      toast.success("STK push sent. Awaiting customer PIN...");
      // Poll
      pollMpesa(res.txn.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function pollMpesa(txnId: string) {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const t = await queryStkFn({ data: { txn_id: txnId } });
        await reloadMpesa();
        if (t && (t.status === "success" || t.status === "failed")) {
          setMpesaPolling(false);
          if (t.status === "success") {
            toast.success("M-Pesa payment received");
            await completePayment("mpesa", txnId);
          } else {
            toast.error(`Payment failed: ${t.result_desc ?? "unknown"}`);
          }
          return;
        }
      } catch (e) {
        console.error(e);
      }
      if (attempts < 30) setTimeout(tick, 4000);
      else setMpesaPolling(false);
    };
    setTimeout(tick, 5000);
  }

  async function attachExistingMpesa(txn: { id: string; amount: number }) {
    if (Math.abs(Number(txn.amount) - finalTotal) > 1) {
      if (!confirm(`Transaction amount (KSh ${txn.amount}) differs from sale total. Continue?`)) return;
    }
    await completePayment("mpesa", txn.id);
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const cartPanel = (
    <>
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Current Sale
          </h2>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>
        <Select value={activeCustomerId || "walkin"} onValueChange={(v) => setActiveCustomerId(v === "walkin" ? "" : v)}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Walk-in customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="walkin">Walk-in customer</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.type === "contractor" ? " · Contractor" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {customer && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Balance: {formatKsh(Number(customer.balance))}</span>
            {Number(customer.loyalty_discount_pct) > 0 && (
              <span>{customer.loyalty_discount_pct}% loyalty</span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <Receipt className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Cart is empty</p>
          </div>
        )}
        {cart.map((item) => (
          <div key={item.lineId} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-start gap-2 min-w-0">
                {item.kind === "timber" ? (
                  <TreePine className="h-4 w-4 text-timber flex-shrink-0 mt-0.5" />
                ) : (
                  <Package className="h-4 w-4 text-hardware flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{item.name}</div>
                  <div className="text-[11px] text-muted-foreground">{item.description}</div>
                </div>
              </div>
              <button
                onClick={() => removeLine(item.lineId)}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => updateQty(item.lineId, Math.max(1, item.quantity - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-12 text-center text-sm font-bold">
                  {item.quantity}
                  <span className="text-[10px] text-muted-foreground ml-1">{item.unitLabel}</span>
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => updateQty(item.lineId, item.quantity + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">{formatKsh(item.total)}</div>
                <div className="text-[10px] text-muted-foreground">@ {formatKsh(item.unitPrice)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold">{formatKsh(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">Discount %</span>
          <Input
            type="number"
            value={discountPct}
            onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
            className="h-8 w-20 text-right"
            min={0}
            max={100}
          />
        </div>
        {totalDiscPct > 0 && (
          <div className="flex justify-between text-xs text-success">
            <span>Discount ({totalDiscPct}%)</span>
            <span>−{formatKsh(discountAmt)}</span>
          </div>
        )}
        {/* Admin-only price override */}
        {canOverride ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Override total
            </span>
            <Input
              type="number"
              value={overrideTotal}
              onChange={(e) => setOverrideTotal(e.target.value)}
              placeholder={`${computed.toFixed(0)}`}
              className="h-8 w-28 text-right"
              min={0}
            />
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-base font-bold uppercase">Total</span>
          <span className="text-2xl font-bold">{formatKsh(finalTotal)}</span>
        </div>
        {usingOverride && (
          <Badge variant="outline" className="text-[10px]">
            Override applied (was {formatKsh(computed)})
          </Badge>
        )}
        <Button
          size="lg"
          disabled={cart.length === 0 || busy}
          onClick={() => {
            setMobileCartOpen(false);
            setPayOpen(true);
          }}
          className="w-full h-14 text-base font-bold bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Receipt className="mr-2 h-5 w-5" /> Pay {formatKsh(finalTotal)}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-[calc(100vh-7rem)] md:min-h-screen flex-col lg:flex-row">
      <section className="hidden lg:flex w-[420px] flex-col border-r border-border bg-card">
        {cartPanel}
      </section>

      <section className="flex-1 flex flex-col bg-background lg:overflow-hidden">
        <div className="sticky top-14 md:top-0 z-10 border-b border-border p-3 md:p-4 space-y-3 bg-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU..."
              className="h-12 pl-11 text-base"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "timber", ...categories] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                }`}
              >
                {t === "all" ? "All" : t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 lg:overflow-y-auto p-3 md:p-4 pb-28 lg:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredTimber.map((w) => (
              <button
                key={w.id}
                onClick={() => setTimberDialog(w)}
                disabled={Number(w.pieces) === 0}
                className="relative rounded-xl bg-[image:var(--gradient-timber)] text-timber-foreground p-4 text-left h-32 flex flex-col justify-between shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
              >
                <div className="absolute top-2 right-2 text-[9px] font-bold uppercase bg-timber-foreground/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                  Timber
                </div>
                <TreePine className="h-6 w-6 opacity-70" />
                <div>
                  <div className="font-bold text-base leading-tight">{w.species}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    {w.thickness}×{w.width}×{w.length}{w.length_unit} · {w.pieces} pcs
                  </div>
                </div>
              </button>
            ))}
            {filteredHardware.map((h) => {
              const low = Number(h.stock) <= Number(h.low_stock_threshold);
              return (
                <button
                  key={h.id}
                  onClick={() => addHardwareItem(h)}
                  disabled={Number(h.stock) === 0}
                  className="relative rounded-xl bg-card border-2 border-border p-4 text-left h-32 flex flex-col justify-between shadow-[var(--shadow-soft)] hover:border-accent hover:shadow-[var(--shadow-elevated)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {low && (
                    <div className="absolute top-2 right-2 text-[9px] font-bold uppercase bg-warning/20 text-warning px-2 py-0.5 rounded-full">
                      Low
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-hardware" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {h.category}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm leading-tight line-clamp-2">{h.name}</div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-bold">{formatKsh(Number(h.price))}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {h.stock} {h.unit}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {filteredHardware.length === 0 && filteredTimber.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              No items match "{search}".
            </div>
          )}
        </div>
      </section>

      {/* Timber line dialog */}
      {timberDialog && (
        <TimberLineDialog
          wood={timberDialog}
          open={!!timberDialog}
          onOpenChange={(o) => !o && setTimberDialog(null)}
          canOverride={canOverride}
          onAdd={(pieces, unitPrice) => {
            addTimberLine(timberDialog, pieces, unitPrice);
            setTimberDialog(null);
          }}
        />
      )}

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Payment Method</DialogTitle>
          </DialogHeader>
          <div className="text-center py-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount Due</div>
            <div className="text-4xl font-bold">{formatKsh(finalTotal)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 py-2">
            {[
              { id: "cash", label: "Cash", icon: Banknote },
              { id: "mpesa", label: "M-Pesa", icon: Smartphone },
              { id: "card", label: "Card", icon: CreditCard },
              { id: "credit", label: "On Credit", icon: Receipt },
            ].map((m) => (
              <button
                key={m.id}
                disabled={busy}
                onClick={() => {
                  if (m.id === "mpesa") {
                    setPayOpen(false);
                    setMpesaTxnId(null);
                    setMpesaPhone(customer?.phone ?? "");
                    setMpesaOpen(true);
                    reloadMpesa();
                    return;
                  }
                  completePayment(m.id as "cash" | "card" | "credit");
                }}
                className="rounded-xl border-2 border-border p-5 hover:border-accent hover:bg-accent/5 transition-all flex flex-col items-center gap-2 disabled:opacity-50"
              >
                <m.icon className="h-7 w-7" />
                <span className="font-semibold text-sm">{m.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* M-Pesa dialog */}
      <Dialog open={mpesaOpen} onOpenChange={setMpesaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" /> M-Pesa Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount</div>
              <div className="text-2xl font-bold">{formatKsh(finalTotal)}</div>
            </div>
            <div>
              <Label className="text-xs">Customer phone</Label>
              <Input
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                placeholder="07XXXXXXXX"
                className="h-11 mt-1"
              />
            </div>
            <Button
              className="w-full h-11"
              onClick={startStkPush}
              disabled={busy || mpesaPolling}
            >
              {mpesaPolling ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Awaiting customer...</>
              ) : (
                <>Send STK Push</>
              )}
            </Button>

            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent M-Pesa payments
                </span>
                <Button variant="ghost" size="sm" onClick={() => reloadMpesa()}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                </Button>
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {mpesaTxns.length === 0 && (
                  <div className="text-xs text-muted-foreground py-2 text-center">
                    No recent transactions
                  </div>
                )}
                {mpesaTxns.map((t) => (
                  <button
                    key={t.id}
                    disabled={t.status !== "success" || !!t.sale_id}
                    onClick={() => attachExistingMpesa(t)}
                    className="w-full text-left rounded border border-border p-2 hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {formatKsh(Number(t.amount))} · {t.phone}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {t.mpesa_receipt ?? t.checkout_request_id ?? "—"} ·{" "}
                        {new Date(t.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                    <Badge
                      variant={
                        t.status === "success"
                          ? "default"
                          : t.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-[10px] uppercase"
                    >
                      {t.sale_id ? "used" : t.status}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center py-4">
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <DialogTitle className="text-xl">Sale Complete</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Receipt #{lastSale ? lastSale.id.slice(-6).toUpperCase() : ""}
            </p>
          </div>
          <DialogFooter className="sm:justify-center flex-col gap-2">
            {lastSale && (
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button
                  variant="outline"
                  onClick={() =>
                    printReceipt(lastSale, {
                      businessName: activeBiz?.name ?? "TimberYard POS",
                      branchName: activeBranch?.name ?? "Main Branch",
                    })
                  }
                >
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadReceiptPDF(lastSale, {
                      businessName: activeBiz?.name ?? "TimberYard POS",
                      branchName: activeBranch?.name ?? "Main Branch",
                    })
                  }
                >
                  <Download className="mr-2 h-4 w-4" /> PDF
                </Button>
              </div>
            )}
            <Button onClick={() => setConfirmOpen(false)} size="lg" className="w-full">
              New Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile cart FAB */}
      {cartCount > 0 && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="lg:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-5 py-3 shadow-[var(--shadow-elevated)] font-bold active:scale-95 transition-transform"
        >
          <ShoppingBag className="h-5 w-5" />
          <span className="text-sm">{cartCount}</span>
          <span className="text-sm border-l border-accent-foreground/30 pl-2">
            {formatKsh(finalTotal)}
          </span>
        </button>
      )}

      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="right" className="lg:hidden p-0 w-full sm:max-w-md flex flex-col">
          <SheetTitle className="sr-only">Current Sale</SheetTitle>
          {cartPanel}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---- Timber line dialog (cloud-driven) ----
function TimberLineDialog({
  wood,
  open,
  onOpenChange,
  canOverride,
  onAdd,
}: {
  wood: CloudTimber;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canOverride: boolean;
  onAdd: (pieces: number, unitPrice: number) => void;
}) {
  const [pieces, setPieces] = useState(1);
  const [override, setOverride] = useState("");
  const base = Number(wood.price_per_unit);
  const computed = base * pieces;
  const overrideNum = parseFloat(override);
  const useOverride = canOverride && !isNaN(overrideNum) && override !== "";
  const total = useOverride ? overrideNum : computed;
  const unitPrice = pieces > 0 ? total / pieces : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TreePine className="h-5 w-5 text-timber" /> {wood.species}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            {wood.thickness}×{wood.width}×{wood.length} {wood.length_unit}
            {wood.grade ? ` · Grade ${wood.grade}` : ""} · {formatKsh(base)}/{wood.price_unit}
          </div>
          <div>
            <Label className="text-xs">Pieces</Label>
            <div className="flex items-center gap-2 mt-1">
              <Button variant="outline" size="icon" onClick={() => setPieces(Math.max(1, pieces - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={pieces}
                onChange={(e) => setPieces(Math.max(1, Number(e.target.value) || 1))}
                className="h-12 text-center text-lg font-bold"
              />
              <Button variant="outline" size="icon" onClick={() => setPieces(pieces + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {wood.pieces} available
            </div>
          </div>
          {canOverride && (
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Lock className="h-3 w-3" /> Override total (optional)
              </Label>
              <Input
                placeholder={`Auto: ${formatKsh(computed)}`}
                value={override}
                onChange={(e) => setOverride(e.target.value)}
                className="mt-1"
              />
            </div>
          )}
          <div className="rounded-xl bg-[image:var(--gradient-timber)] text-timber-foreground p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-80">Line Total</div>
              <div className="text-3xl font-bold">{formatKsh(total)}</div>
              <div className="text-xs opacity-80 mt-1">{formatKsh(unitPrice)} per piece</div>
            </div>
            <TreePine className="h-12 w-12 opacity-30" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={pieces < 1 || pieces > Number(wood.pieces)}
            onClick={() => onAdd(pieces, unitPrice)}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
