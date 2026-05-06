import { useState, useMemo } from "react";
import { useHardware, useBranchSelection, formatKsh, type CloudHardware } from "@/lib/cloud-store";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Package, Plus, Search, AlertTriangle, Pencil, Trash2, Loader2, Sparkles, Filter } from "lucide-react";
import { toast } from "sonner";
import { BulkImportDialog } from "@/components/inventory/BulkImportDialog";
import { ExportMenu } from "@/components/shared/ExportMenu";
import { autoSku } from "@/lib/bulk-io";

const UNITS = ["pcs", "kg", "m", "box", "bag", "ft", "l"];

interface FormState {
  name: string; sku: string; category: string; unit: string;
  price: number; cost: number; stock: number; low_stock_threshold: number; supplier: string;
}
const empty: FormState = {
  name: "", sku: "", category: "Tools", unit: "pcs",
  price: 0, cost: 0, stock: 0, low_stock_threshold: 5, supplier: "",
};

export function HardwareInventory() {
  const { activeBranchId } = useBranchSelection();
  const { activeBusinessId, isBusinessAdmin, isSystemOwner } = useAuth();
  const { items, loading, reload } = useHardware(activeBranchId);
  const canEdit = isBusinessAdmin || isSystemOwner;

  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out" | "in">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<CloudHardware | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[], [items]);

  const filtered = items.filter((h) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(h.name.toLowerCase().includes(q) || (h.sku ?? "").toLowerCase().includes(q))) return false;
    }
    if (categoryFilter !== "all" && (h.category ?? "") !== categoryFilter) return false;
    if (stockFilter === "out" && h.stock > 0) return false;
    if (stockFilter === "low" && (h.stock <= 0 || h.stock > h.low_stock_threshold)) return false;
    if (stockFilter === "in" && h.stock <= h.low_stock_threshold) return false;
    return true;
  });

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.id)));
  }
  function toggleOne(id: string) {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n);
  }

  async function bulkDelete() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} item(s)? This cannot be undone.`)) return;
    const { error } = await supabase.from("hardware_products").update({ is_active: false }).in("id", Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success(`Removed ${selected.size}`); setSelected(new Set()); reload();
  }

  function startCreate() { setEditing(null); setForm({ ...empty }); setOpen(true); }
  function startEdit(h: CloudHardware) {
    setEditing(h);
    setForm({
      name: h.name, sku: h.sku ?? "", category: h.category ?? "Tools",
      unit: h.unit, price: Number(h.price), cost: Number(h.cost),
      stock: Number(h.stock), low_stock_threshold: Number(h.low_stock_threshold),
      supplier: h.supplier ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!activeBusinessId || !activeBranchId) return;
    setBusy(true);
    const sku = form.sku || autoSku(form.name, form.category);
    const payload = {
      business_id: activeBusinessId, branch_id: activeBranchId,
      name: form.name, sku, category: form.category || null,
      unit: form.unit, price: form.price, cost: form.cost,
      stock: form.stock, low_stock_threshold: form.low_stock_threshold,
      supplier: form.supplier || null,
    };
    const { error } = editing
      ? await supabase.from("hardware_products").update(payload).eq("id", editing.id)
      : await supabase.from("hardware_products").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Item updated" : "Item added");
    setOpen(false); setForm(empty); setEditing(null);
    reload();
  }

  async function remove(h: CloudHardware) {
    if (!confirm(`Delete "${h.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("hardware_products").update({ is_active: false }).eq("id", h.id);
    if (error) return toast.error(error.message);
    toast.success("Item removed");
    reload();
  }

  const exportRows = filtered.map((h) => ({
    name: h.name, sku: h.sku ?? "", category: h.category ?? "",
    unit: h.unit, price: Number(h.price), cost: Number(h.cost),
    stock: Number(h.stock), low_stock_threshold: Number(h.low_stock_threshold),
    supplier: h.supplier ?? "",
  }));
  const exportCols = [
    { key: "name", label: "Name" }, { key: "sku", label: "SKU" }, { key: "category", label: "Category" },
    { key: "unit", label: "Unit" }, { key: "price", label: "Price" }, { key: "cost", label: "Cost" },
    { key: "stock", label: "Stock" }, { key: "low_stock_threshold", label: "Low at" }, { key: "supplier", label: "Supplier" },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 md:h-7 md:w-7 text-hardware" /> Hardware Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">All non-timber stock for the active branch.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportMenu filename="hardware-inventory" title="Hardware Inventory" columns={exportCols} rows={exportRows} />
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}><Sparkles className="mr-2 h-4 w-4" /> Bulk Import</Button>
              <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative max-w-md flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU..." className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as typeof stockFilter)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="in">In stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
        {canEdit && selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={bulkDelete}><Trash2 className="h-4 w-4 mr-1" /> Delete {selected.size}</Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No hardware items match.</div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {canEdit && <TableHead className="w-8"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>}
                <TableHead>Item</TableHead>
                <TableHead className="hidden sm:table-cell">SKU</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((h) => {
                const low = h.stock <= h.low_stock_threshold;
                const out = h.stock <= 0;
                return (
                  <TableRow key={h.id}>
                    {canEdit && <TableCell><Checkbox checked={selected.has(h.id)} onCheckedChange={() => toggleOne(h.id)} /></TableCell>}
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono hidden sm:table-cell">{h.sku ?? "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">{h.category ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatKsh(Number(h.price))}</TableCell>
                    <TableCell className="text-right">{h.stock} <span className="text-xs text-muted-foreground">{h.unit}</span></TableCell>
                    <TableCell>
                      {out ? <span className="inline-flex items-center gap-1 text-xs font-bold uppercase text-destructive"><AlertTriangle className="h-3 w-3" /> Out</span>
                        : low ? <span className="inline-flex items-center gap-1 text-xs font-bold uppercase text-warning"><AlertTriangle className="h-3 w-3" /> Low</span>
                        : <span className="text-xs font-semibold uppercase text-success">In Stock</span>}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(h)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(h)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Hardware Item" : "Add Hardware Item"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>SKU <span className="text-xs text-muted-foreground">(auto)</span></Label>
                <div className="flex gap-1">
                  <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="auto-generated" />
                  <Button type="button" variant="outline" size="icon" title="Generate SKU" onClick={() => setForm({ ...form, sku: autoSku(form.name || "ITEM", form.category) })}><Sparkles className="h-4 w-4" /></Button>
                </div>
              </div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Price</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
              <div><Label>Cost</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} /></div>
              <div><Label>Low stock at</Label><Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Supplier (optional)</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.name || busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeBusinessId && activeBranchId && (
        <BulkImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          businessId={activeBusinessId}
          branchId={activeBranchId}
          onDone={reload}
        />
      )}
    </div>
  );
}
