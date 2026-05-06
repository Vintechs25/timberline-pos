/**
 * BulkImportDialog — paste/CSV/XLSX upload, AI classify, review & commit.
 * Used for Inventory (writes to hardware_products / timber_products).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Sparkles, FileSpreadsheet } from "lucide-react";
import { parseFile, parsePasted, autoSku, parseTimberDims, parsePrice, type ParsedTable, type Row } from "@/lib/bulk-io";
import { classifyImportRows } from "@/server/import-classify.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  businessId: string;
  branchId: string;
  onDone?: () => void;
}

interface NormalizedItem {
  kind: "hardware" | "timber";
  name?: string; price?: number; stock?: number; unit?: string;
  category?: string; sku?: string; supplier?: string;
  species?: string; grade?: string;
  thickness?: number; width?: number; length?: number;
  dim_unit?: string; length_unit?: string; pieces?: number;
  source_row: number; confidence: number;
  selected?: boolean;
}

export function BulkImportDialog({ open, onOpenChange, businessId, branchId, onDone }: Props) {
  const [parsed, setParsed] = useState<ParsedTable | null>(null);
  const [pasted, setPasted] = useState("");
  const [items, setItems] = useState<NormalizedItem[]>([]);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [busy, setBusy] = useState(false);

  function reset() {
    setParsed(null); setItems([]); setPasted(""); setStep("upload");
  }

  async function onFile(f: File) {
    try {
      const t = await parseFile(f);
      setParsed(t);
      toast.success(`Parsed ${t.rows.length} rows`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function onPasteParse() {
    const t = parsePasted(pasted);
    if (!t.rows.length) { toast.error("Nothing parsed — paste rows including a header line."); return; }
    setParsed(t);
    toast.success(`Parsed ${t.rows.length} rows`);
  }

  async function aiClassify() {
    if (!parsed) return;
    setBusy(true);
    try {
      const { items: ai } = await classifyImportRows({
        data: { headers: parsed.headers, rows: parsed.rows as Row[] },
      });
      // Enrich: parse measurement strings if AI missed; fill SKUs
      const enriched: NormalizedItem[] = (ai as NormalizedItem[]).map((it) => {
        let dims = {};
        if (it.kind === "timber" && (!it.thickness || !it.width || !it.length)) {
          // try to find a "dimensions" or first cell with x
          const r = parsed.rows[it.source_row];
          for (const v of Object.values(r ?? {})) {
            const parsedDims = parseTimberDims(String(v ?? ""));
            if (parsedDims.thickness) { dims = parsedDims; break; }
          }
        }
        const merged = { ...it, ...dims, selected: true };
        if (it.kind === "hardware" && !merged.sku) merged.sku = autoSku(merged.name ?? "ITEM", merged.category);
        if (typeof merged.price === "string") merged.price = parsePrice(merged.price);
        return merged;
      });
      setItems(enriched);
      setStep("review");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function commit() {
    const chosen = items.filter((i) => i.selected);
    if (!chosen.length) { toast.error("Select at least one row"); return; }
    setBusy(true);
    const hardware = chosen.filter((i) => i.kind === "hardware").map((i) => ({
      business_id: businessId, branch_id: branchId,
      name: i.name ?? "Unnamed",
      sku: i.sku ?? autoSku(i.name ?? "ITEM", i.category),
      category: i.category ?? null,
      unit: i.unit ?? "pcs",
      price: Number(i.price ?? 0), cost: 0,
      stock: Number(i.stock ?? 0),
      low_stock_threshold: 5,
      supplier: i.supplier ?? null,
    }));
    const timber = chosen.filter((i) => i.kind === "timber").map((i) => ({
      business_id: businessId, branch_id: branchId,
      species: i.species ?? i.name ?? "Unknown",
      grade: i.grade ?? null,
      thickness: Number(i.thickness ?? 0),
      width: Number(i.width ?? 0),
      length: Number(i.length ?? 0),
      dim_unit: i.dim_unit ?? "in",
      length_unit: i.length_unit ?? "ft",
      price_per_unit: Number(i.price ?? 0),
      price_unit: i.unit ?? "piece",
      pieces: Number(i.pieces ?? i.stock ?? 0),
      low_stock_threshold: 10,
    }));
    try {
      if (hardware.length) {
        const { error } = await supabase.from("hardware_products").insert(hardware);
        if (error) throw error;
      }
      if (timber.length) {
        const { error } = await supabase.from("timber_products").insert(timber);
        if (error) throw error;
      }
      toast.success(`Imported ${hardware.length} hardware + ${timber.length} timber`);
      onDone?.();
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  function update(idx: number, patch: Partial<NormalizedItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Bulk Import Stock</DialogTitle>
          <DialogDescription>
            Upload CSV/Excel or paste from a sheet. AI auto-classifies wood vs hardware, parses measurements and generates SKUs. Review and confirm before saving.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <Tabs defaultValue="file">
            <TabsList>
              <TabsTrigger value="file"><FileSpreadsheet className="h-4 w-4 mr-1" /> File</TabsTrigger>
              <TabsTrigger value="paste">Paste</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="space-y-3">
              <Label>CSV or Excel (.xlsx) file</Label>
              <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            </TabsContent>
            <TabsContent value="paste" className="space-y-3">
              <Label>Paste rows from your spreadsheet (include header row)</Label>
              <Textarea rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"name\tprice\tstock\nHammer\t450\t20\n2x4x12 Cypress\t850\t100"} />
              <Button variant="outline" onClick={onPasteParse}><Upload className="h-4 w-4 mr-1" /> Parse pasted</Button>
            </TabsContent>
          </Tabs>
        )}

        {step === "upload" && parsed && (
          <Card className="p-3 mt-3 space-y-2">
            <div className="text-sm text-muted-foreground">Detected {parsed.rows.length} rows · columns: {parsed.headers.join(", ")}</div>
            <Button onClick={aiClassify} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Classify with AI
            </Button>
          </Card>
        )}

        {step === "review" && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {items.filter(i => i.selected).length} of {items.length} selected · {items.filter(i => i.kind === "hardware").length} hardware · {items.filter(i => i.kind === "timber").length} timber
            </div>
            <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
              {items.map((it, i) => (
                <Card key={i} className="p-2 flex items-start gap-2 text-xs">
                  <Checkbox checked={!!it.selected} onCheckedChange={(v) => update(i, { selected: !!v })} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={it.kind === "timber" ? "secondary" : "default"} className="text-[10px] uppercase">{it.kind}</Badge>
                      <Badge variant="outline" className="text-[10px]">{Math.round((it.confidence ?? 0) * 100)}%</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                      <Input className="h-7 text-xs" value={it.kind === "timber" ? (it.species ?? "") : (it.name ?? "")}
                        onChange={(e) => update(i, it.kind === "timber" ? { species: e.target.value } : { name: e.target.value })} placeholder="name/species" />
                      <Input className="h-7 text-xs" type="number" value={it.price ?? 0} onChange={(e) => update(i, { price: Number(e.target.value) })} placeholder="price" />
                      <Input className="h-7 text-xs" type="number" value={(it.kind === "timber" ? it.pieces : it.stock) ?? 0}
                        onChange={(e) => update(i, it.kind === "timber" ? { pieces: Number(e.target.value) } : { stock: Number(e.target.value) })} placeholder="qty" />
                      {it.kind === "timber" ? (
                        <Input className="h-7 text-xs" value={`${it.thickness ?? ""}x${it.width ?? ""}x${it.length ?? ""}`} readOnly placeholder="dims" />
                      ) : (
                        <Input className="h-7 text-xs" value={it.sku ?? ""} onChange={(e) => update(i, { sku: e.target.value })} placeholder="SKU" />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "review" && <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>}
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          {step === "review" && <Button onClick={commit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Import {items.filter(i => i.selected).length}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
