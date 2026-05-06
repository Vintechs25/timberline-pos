import { useState } from "react";
import { useTimber, useBranchSelection, formatKsh, type CloudTimber } from "@/lib/cloud-store";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { TreePine, Plus, Pencil, Trash2, Loader2, AlertTriangle, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkImportDialog } from "@/components/inventory/BulkImportDialog";
import { ExportMenu } from "@/components/shared/ExportMenu";

interface FormState {
  species: string; grade: string;
  thickness: number; width: number; length: number;
  dim_unit: string; length_unit: string;
  price_per_unit: number; price_unit: string;
  pieces: number; low_stock_threshold: number;
}
const empty: FormState = {
  species: "", grade: "",
  thickness: 2, width: 4, length: 12,
  dim_unit: "in", length_unit: "ft",
  price_per_unit: 0, price_unit: "piece",
  pieces: 0, low_stock_threshold: 10,
};

export function TimberInventory() {
  const { activeBranchId } = useBranchSelection();
  const { activeBusinessId, isBusinessAdmin, isSystemOwner } = useAuth();
  const { items, loading, reload } = useTimber(activeBranchId);
  const canEdit = isBusinessAdmin || isSystemOwner;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CloudTimber | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [busy, setBusy] = useState(false);

  function startCreate() { setEditing(null); setForm(empty); setOpen(true); }
  function startEdit(t: CloudTimber) {
    setEditing(t);
    setForm({
      species: t.species, grade: t.grade ?? "",
      thickness: Number(t.thickness), width: Number(t.width), length: Number(t.length),
      dim_unit: t.dim_unit, length_unit: t.length_unit,
      price_per_unit: Number(t.price_per_unit), price_unit: t.price_unit,
      pieces: Number(t.pieces), low_stock_threshold: Number(t.low_stock_threshold),
    });
    setOpen(true);
  }

  async function save() {
    if (!activeBusinessId || !activeBranchId) return;
    setBusy(true);
    const payload = {
      business_id: activeBusinessId, branch_id: activeBranchId,
      species: form.species, grade: form.grade || null,
      thickness: form.thickness, width: form.width, length: form.length,
      dim_unit: form.dim_unit, length_unit: form.length_unit,
      price_per_unit: form.price_per_unit, price_unit: form.price_unit,
      pieces: form.pieces, low_stock_threshold: form.low_stock_threshold,
    };
    const { error } = editing
      ? await supabase.from("timber_products").update(payload).eq("id", editing.id)
      : await supabase.from("timber_products").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Updated" : "Added");
    setOpen(false); reload();
  }

  async function remove(t: CloudTimber) {
    if (!confirm(`Delete ${t.species} ${t.thickness}x${t.width}?`)) return;
    const { error } = await supabase.from("timber_products").update({ is_active: false }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Removed"); reload();
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <TreePine className="h-6 w-6 md:h-7 md:w-7 text-timber" /> Timber Yard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Wood species, dimensions, and per-unit pricing for the active branch.</p>
        </div>
        {canEdit && (
          <Button onClick={startCreate} size="lg" className="bg-timber text-timber-foreground hover:bg-timber/90">
            <Plus className="mr-2 h-4 w-4" /> Add Timber
          </Button>
        )}
      </header>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…</div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No timber yet for this branch.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((t) => {
            const low = t.pieces <= t.low_stock_threshold;
            return (
              <Card key={t.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{t.species}</h3>
                    <p className="text-xs text-muted-foreground">
                      {t.thickness}×{t.width} {t.dim_unit} · {t.length} {t.length_unit}{t.grade ? ` · Grade ${t.grade}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-foreground">{t.pieces}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">pieces</div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Price</div>
                    <div className="font-bold">{formatKsh(Number(t.price_per_unit))} / {t.price_unit}</div>
                  </div>
                  {low && <span className="inline-flex items-center gap-1 text-xs font-bold uppercase text-warning"><AlertTriangle className="h-3 w-3" /> Low</span>}
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Timber" : "Add Timber"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Species</Label><Input value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} placeholder="Cypress" /></div>
              <div><Label>Grade (optional)</Label><Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Thickness</Label><Input type="number" value={form.thickness} onChange={(e) => setForm({ ...form, thickness: Number(e.target.value) })} /></div>
              <div><Label>Width</Label><Input type="number" value={form.width} onChange={(e) => setForm({ ...form, width: Number(e.target.value) })} /></div>
              <div><Label>Length</Label><Input type="number" value={form.length} onChange={(e) => setForm({ ...form, length: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Dim unit</Label><Input value={form.dim_unit} onChange={(e) => setForm({ ...form, dim_unit: e.target.value })} placeholder="in" /></div>
              <div><Label>Length unit</Label><Input value={form.length_unit} onChange={(e) => setForm({ ...form, length_unit: e.target.value })} placeholder="ft" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Price</Label><Input type="number" value={form.price_per_unit} onChange={(e) => setForm({ ...form, price_per_unit: Number(e.target.value) })} /></div>
              <div><Label>Per</Label><Input value={form.price_unit} onChange={(e) => setForm({ ...form, price_unit: e.target.value })} placeholder="piece / ft" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Pieces in stock</Label><Input type="number" value={form.pieces} onChange={(e) => setForm({ ...form, pieces: Number(e.target.value) })} /></div>
              <div><Label>Low stock at</Label><Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.species || busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
