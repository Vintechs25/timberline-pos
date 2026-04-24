import { useMemo, useState } from "react";
import { usePOS, formatKsh } from "@/lib/store";
import type { HardwareProduct, TimberWoodType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TimberSaleDialog } from "@/components/pos/TimberSaleDialog";
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

type Tab = "all" | "timber" | string; // string = hardware category

export function POSScreen() {
  const {
    hardware,
    timber,
    customers,
    cart,
    activeCustomerId,
    cartDiscountPct,
    addCartItem,
    updateCartItem,
    removeCartItem,
    clearCart,
    setCustomer,
    setDiscount,
    completeSale,
  } = usePOS();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [timberDialog, setTimberDialog] = useState<TimberWoodType | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastSaleNo, setLastSaleNo] = useState<string>("");

  const categories = useMemo(() => {
    const set = new Set(hardware.map((h) => h.category));
    return Array.from(set).sort();
  }, [hardware]);

  const filteredHardware = useMemo(() => {
    let list = hardware;
    if (tab !== "all" && tab !== "timber") list = list.filter((h) => h.category === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (h) => h.name.toLowerCase().includes(q) || h.sku.toLowerCase().includes(q),
      );
    }
    return list;
  }, [hardware, tab, search]);

  const showTimber = tab === "all" || tab === "timber";
  const filteredTimber = useMemo(() => {
    if (!showTimber) return [];
    if (!search.trim()) return timber;
    const q = search.toLowerCase();
    return timber.filter((t) => t.name.toLowerCase().includes(q));
  }, [timber, showTimber, search]);

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const customer = customers.find((c) => c.id === activeCustomerId);
  const totalDiscPct = cartDiscountPct + (customer?.discountPct ?? 0);
  const discount = (subtotal * totalDiscPct) / 100;
  const total = subtotal - discount;

  function addHardwareItem(h: HardwareProduct) {
    const existing = cart.find((c) => c.kind === "hardware" && c.productId === h.id);
    if (existing) {
      updateCartItem(existing.lineId, existing.quantity + 1);
    } else {
      addCartItem({
        kind: "hardware",
        productId: h.id,
        name: h.name,
        description: h.sku,
        quantity: 1,
        unitPrice: h.price,
        unitLabel: h.unit,
      });
    }
  }

  function pay(method: "cash" | "card" | "mpesa" | "credit") {
    if (cart.length === 0) return;
    if (method === "credit" && activeCustomerId === "c-walkin") {
      alert("Select a contractor account for credit sales.");
      return;
    }
    const sale = completeSale(method);
    setLastSaleNo(sale.id);
    setPayOpen(false);
    setConfirmOpen(true);
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

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
        <Select value={activeCustomerId} onValueChange={setCustomer}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.type === "contractor" && (
                    <span className="text-[10px] uppercase font-bold text-accent">
                      Contractor
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {customer && customer.type === "contractor" && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Balance: {formatKsh(customer.balance)}</span>
            <span>{customer.discountPct}% loyalty discount</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <Receipt className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Cart is empty</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Tap items to add them.
            </p>
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
                  <div className="text-sm font-semibold text-foreground truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{item.description}</div>
                </div>
              </div>
              <button
                onClick={() => removeCartItem(item.lineId)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                aria-label="Remove"
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
                  onClick={() => updateCartItem(item.lineId, Math.max(1, item.quantity - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-12 text-center text-sm font-bold">
                  {item.quantity}
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {item.unitLabel}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => updateCartItem(item.lineId, item.quantity + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">{formatKsh(item.total)}</div>
                <div className="text-[10px] text-muted-foreground">
                  @ {formatKsh(item.unitPrice)}
                </div>
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
            value={cartDiscountPct}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            className="h-8 w-20 text-right"
            min={0}
            max={100}
          />
        </div>
        {totalDiscPct > 0 && (
          <div className="flex justify-between text-xs text-success">
            <span>Discount ({totalDiscPct}%)</span>
            <span>−{formatKsh(discount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-base font-bold uppercase">Total</span>
          <span className="text-2xl font-bold text-foreground">{formatKsh(total)}</span>
        </div>
        <Button
          size="lg"
          disabled={cart.length === 0}
          onClick={() => {
            setMobileCartOpen(false);
            setPayOpen(true);
          }}
          className="w-full h-14 text-base font-bold bg-accent text-accent-foreground hover:bg-accent/90 shadow-[var(--shadow-elevated)]"
        >
          <Receipt className="mr-2 h-5 w-5" /> Pay {formatKsh(total)}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-[calc(100vh-7rem)] md:min-h-screen flex-col lg:flex-row">
      {/* CART PANEL — desktop only */}
      <section className="hidden lg:flex w-[420px] flex-col border-r border-border bg-card">
        {cartPanel}
      </section>


      {/* PRODUCT GRID — right */}
      <section className="flex-1 flex flex-col bg-background lg:overflow-hidden">
        <div className="sticky top-14 md:top-0 z-10 border-b border-border p-3 md:p-4 space-y-3 bg-card">{/* mobile-friendly sticky search */}
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

        <div className="flex-1 lg:overflow-y-auto p-3 md:p-4 pb-28 lg:pb-4">{/* extra bottom padding for mobile FAB */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredTimber.map((w) => (
              <button
                key={w.id}
                onClick={() => setTimberDialog(w)}
                className="relative rounded-xl bg-[image:var(--gradient-timber)] text-timber-foreground p-4 text-left h-32 flex flex-col justify-between shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)] hover:scale-[1.02] active:scale-95 transition-all"
              >
                <div className="absolute top-2 right-2 text-[9px] font-bold uppercase bg-timber-foreground/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                  Timber
                </div>
                <TreePine className="h-6 w-6 opacity-70" />
                <div>
                  <div className="font-bold text-base leading-tight">{w.name}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">{w.pieces} pcs available</div>
                </div>
              </button>
            ))}
            {filteredHardware.map((h) => {
              const low = h.stock <= h.reorderLevel;
              return (
                <button
                  key={h.id}
                  onClick={() => addHardwareItem(h)}
                  disabled={h.stock === 0}
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
                    <div className="font-semibold text-sm leading-tight text-foreground line-clamp-2">
                      {h.name}
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-bold text-foreground">
                        {formatKsh(h.price)}
                      </span>
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

      {/* Timber dialog */}
      {timberDialog && (
        <TimberSaleDialog
          wood={timberDialog}
          open={!!timberDialog}
          onOpenChange={(o) => !o && setTimberDialog(null)}
          onAdd={(line) => addCartItem({ kind: "timber", ...line })}
        />
      )}

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Payment Method</DialogTitle>
          </DialogHeader>
          <div className="text-center py-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Amount Due
            </div>
            <div className="text-4xl font-bold text-foreground">{formatKsh(total)}</div>
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
                onClick={() => pay(m.id as "cash" | "card" | "mpesa" | "credit")}
                className="rounded-xl border-2 border-border p-5 hover:border-accent hover:bg-accent/5 transition-all flex flex-col items-center gap-2"
              >
                <m.icon className="h-7 w-7 text-foreground" />
                <span className="font-semibold text-sm">{m.label}</span>
              </button>
            ))}
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
            <p className="text-sm text-muted-foreground mt-1">Receipt #{lastSaleNo.slice(-6)}</p>
          </div>
          <DialogFooter className="sm:justify-center">
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
            {formatKsh(total)}
          </span>
        </button>
      )}

      {/* Mobile cart sheet */}
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="right" className="lg:hidden p-0 w-full sm:max-w-md flex flex-col">
          <SheetTitle className="sr-only">Current Sale</SheetTitle>
          {cartPanel}
        </SheetContent>
      </Sheet>
    </div>
  );
}
