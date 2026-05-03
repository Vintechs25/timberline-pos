import { useState } from "react";
import { useSuppliers, useBranchSelection, formatKsh, type CloudSupplier } from "@/lib/cloud-store";
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
import { Truck, Plus, Pencil, Trash2, Loader2, Phone, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  name: string; contact_person: string; phone: string; email: string; address: string; notes: string;
}
const empty: FormState = { name: "", contact_person: "", phone: "", email: "", address: "", notes: "" };

interface PayState { amount: number; method: string; reference: string; notes: string; }

export function SuppliersPage() {
  const { activeBusinessId, isBusinessAdmin, isSystemOwner } = useAuth();
  const { activeBranchId } = useBranchSelection();
  const { items, loading, reload } = useSuppliers();
  const canEdit = isBusinessAdmin || isSystemOwner;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CloudSupplier | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [paySupplier, setPaySupplier] = useState<CloudSupplier | null>(null);
  const [payForm, setPayForm] = useState<PayState>({ amount: 0, method: "cash", reference: "", notes: "" });

  const totalOwed = items.reduce((s, x) => s + Number(x.balance), 0);

  function startCreate() { setEditing(null); setForm(empty); setOpen(true); }
  function startEdit(s: CloudSupplier) {
    setEditing(s);
    setForm({
      name: s.name, contact_person: s.contact_person ?? "", phone: s.phone ?? "",
      email: s.email ?? "", address: s.address ?? "", notes: s.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!activeBusinessId) return;
    setBusy(true);
    const payload = {
      business_id: activeBusinessId,
      name: form.name,
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("suppliers").update(payload).eq("id", editing.id)
      : await supabase.from("suppliers").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Supplier updated" : "Supplier added");
    setOpen(false); reload();
  }

  async function remove(s: CloudSupplier) {
    if (!confirm(`Delete ${s.name}?`)) return;
    const { error } = await supabase.from("suppliers").update({ is_active: false }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Removed"); reload();
  }

  function startPay(s: CloudSupplier) {
    setPaySupplier(s);
    setPayForm({ amount: Number(s.balance), method: "cash", reference: "", notes: "" });
    setPayOpen(true);
  }

  async function recordPayment() {
    if (!paySupplier || !activeBusinessId) return;
    setBusy(true);
    const { error } = await supabase.rpc("pay_supplier", {
      _supplier_id: paySupplier.id,
      _amount: payForm.amount,
      _method: payForm.method,
      _reference: payForm.reference || null,
      _notes: payForm.notes || null,
      _branch_id: activeBranchId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment recorded");
    setPayOpen(false); reload();
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 md:h-7 md:w-7 text-primary" /> Suppliers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage suppliers, balances and payments.</p>
        </div>
        {canEdit && <Button onClick={startCreate} size="lg"><Plus className="mr-2 h-4 w-4" /> Add Supplier</Button>}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Total Owed</div><div className="text-2xl font-bold mt-1 text-warning">{formatKsh(totalOwed)}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Active Suppliers</div><div className="text-2xl font-bold mt-1">{items.length}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">With Outstanding</div><div className="text-2xl font-bold mt-1">{items.filter((s) => Number(s.balance) > 0).length}</div></Card>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…</div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No suppliers yet. Add your first supplier to track purchases and balances.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-lg">{s.name}</div>
                  {s.contact_person && <div className="text-xs text-muted-foreground">{s.contact_person}</div>}
                  {s.phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" /> {s.phone}</div>}
                  {s.address && <div className="text-xs text-muted-foreground mt-0.5">{s.address}</div>}
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance Owed</div>
                  <div className={`text-xl font-bold ${Number(s.balance) > 0 ? "text-warning" : "text-success"}`}>{formatKsh(Number(s.balance))}</div>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                {canEdit && <Button size="sm" variant="outline" onClick={() => startPay(s)}><DollarSign className="h-4 w-4 mr-1" /> Pay</Button>}
                {canEdit && <Button size="icon" variant="ghost" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>}
                {canEdit && <Button size="icon" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.name || busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay {paySupplier?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted p-3 text-sm">Current balance: <span className="font-bold">{formatKsh(Number(paySupplier?.balance ?? 0))}</span></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Amount</Label><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} /></div>
              <div><Label>Method</Label><Input value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} placeholder="cash / mpesa / bank" /></div>
            </div>
            <div><Label>Reference</Label><Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={recordPayment} disabled={!payForm.amount || busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
