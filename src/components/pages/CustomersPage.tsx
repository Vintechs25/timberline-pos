import { useState } from "react";
import { useCustomers, useSales, useBranchSelection, formatKsh, type CloudCustomer } from "@/lib/cloud-store";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, Plus, HardHat, User as UserIcon, Phone, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ExportMenu } from "@/components/shared/ExportMenu";

interface FormState {
  name: string; type: string; phone: string; email: string;
  credit_limit: number; loyalty_discount_pct: number; notes: string;
}
const empty: FormState = {
  name: "", type: "contractor", phone: "", email: "",
  credit_limit: 50000, loyalty_discount_pct: 0, notes: "",
};

export function CustomersPage() {
  const { activeBusinessId, isBusinessAdmin, isSystemOwner } = useAuth();
  const { activeBranchId } = useBranchSelection();
  const { items: customers, loading, reload } = useCustomers();
  const { items: sales } = useSales(activeBranchId, true);
  const canEdit = isBusinessAdmin || isSystemOwner;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CloudCustomer | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = customers.filter((c) => {
    if (c.name.toLowerCase() === "walk-in") return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
  });

  const totalOutstanding = customers.reduce((s, c) => s + Number(c.balance), 0);
  const totalCredit = customers.reduce((s, c) => s + Number(c.credit_limit), 0);

  function startCreate() { setEditing(null); setForm(empty); setOpen(true); }
  function startEdit(c: CloudCustomer) {
    setEditing(c);
    setForm({
      name: c.name, type: c.type, phone: c.phone ?? "", email: c.email ?? "",
      credit_limit: Number(c.credit_limit), loyalty_discount_pct: Number(c.loyalty_discount_pct),
      notes: c.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!activeBusinessId) return;
    setBusy(true);
    const payload = {
      business_id: activeBusinessId,
      name: form.name, type: form.type,
      phone: form.phone || null, email: form.email || null,
      credit_limit: form.credit_limit, loyalty_discount_pct: form.loyalty_discount_pct,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("customers").update(payload).eq("id", editing.id)
      : await supabase.from("customers").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Customer updated" : "Customer added");
    setOpen(false); reload();
  }

  async function remove(c: CloudCustomer) {
    if (!confirm(`Delete ${c.name}?`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Removed"); reload();
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 md:h-7 md:w-7 text-primary" /> Customers & Credit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Contractor accounts, balances and custom pricing.</p>
        </div>
        <Button onClick={startCreate} size="lg"><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</div><div className="text-2xl font-bold mt-1 text-warning">{formatKsh(totalOutstanding)}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Total Credit Lines</div><div className="text-2xl font-bold mt-1">{formatKsh(totalCredit)}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Active Customers</div><div className="text-2xl font-bold mt-1">{filtered.length}</div></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." className="pl-9" />
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No customers yet.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c) => {
            const customerSales = sales.filter((s) => s.customer_id === c.id);
            const utilPct = Number(c.credit_limit) > 0 ? (Number(c.balance) / Number(c.credit_limit)) * 100 : 0;
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {c.type === "contractor" ? <HardHat className="h-5 w-5 text-primary" /> : <UserIcon className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <div className="font-bold text-foreground">{c.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.type}</div>
                      {c.phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" /> {c.phone}</div>}
                    </div>
                  </div>
                  {Number(c.loyalty_discount_pct) > 0 && (
                    <span className="rounded-full bg-accent/20 text-accent-foreground border border-accent/30 px-2 py-0.5 text-[10px] font-bold uppercase">{c.loyalty_discount_pct}% off</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
                    <div className={`font-bold ${Number(c.balance) > 0 ? "text-warning" : "text-success"}`}>{formatKsh(Number(c.balance))}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Credit Limit</div>
                    <div className="font-bold">{formatKsh(Number(c.credit_limit))}</div>
                  </div>
                </div>
                {Number(c.credit_limit) > 0 && (
                  <div className="mb-3">
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div className={`h-full ${utilPct > 80 ? "bg-destructive" : utilPct > 50 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(100, utilPct)}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">{utilPct.toFixed(0)}% utilized</div>
                  </div>
                )}
                <div className="border-t border-border pt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{customerSales.length} sales · Last: {customerSales[0] ? new Date(customerSales[0].created_at).toLocaleDateString() : "—"}</span>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="walkin">Walk-in</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Credit limit</Label><Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} /></div>
              <div><Label>Loyalty discount %</Label><Input type="number" value={form.loyalty_discount_pct} onChange={(e) => setForm({ ...form, loyalty_discount_pct: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.name || busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
