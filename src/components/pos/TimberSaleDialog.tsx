import { useState } from "react";
import type { TimberWoodType, TimberSize } from "@/lib/types";
import { formatKsh } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TreePine, Ruler, Plus, Minus } from "lucide-react";

interface Props {
  wood: TimberWoodType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (line: {
    productId: string;
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
    unitLabel: string;
    meta: { woodType: string; size: string; lengthFt: number; pieces: number };
  }) => void;
}

export function TimberSaleDialog({ wood, open, onOpenChange, onAdd }: Props) {
  const [size, setSize] = useState<TimberSize | null>(wood.sizes[0] ?? null);
  const [length, setLength] = useState<number>(wood.quickLengths[0] ?? 12);
  const [pieces, setPieces] = useState<number>(1);
  const [override, setOverride] = useState<string>("");

  const baseRate = size ? size.ratePerFt * wood.multiplier : 0;
  const computed = baseRate * length * pieces;
  const overrideNum = parseFloat(override);
  const total = !isNaN(overrideNum) && override !== "" ? overrideNum : computed;
  const unitPrice = pieces > 0 ? total / pieces : 0;

  // bulk discount preview
  const bulkDisc = pieces >= 20 ? 10 : pieces >= 10 ? 5 : 0;
  const finalTotal = total * (1 - bulkDisc / 100);

  function handleAdd() {
    if (!size) return;
    onAdd({
      productId: wood.id,
      name: `${wood.name} ${size.label}`,
      description: `${length}ft × ${pieces} pcs${bulkDisc ? ` · ${bulkDisc}% bulk` : ""}`,
      quantity: pieces,
      unitPrice: finalTotal / pieces,
      unitLabel: "pc",
      meta: { woodType: wood.name, size: size.label, lengthFt: length, pieces },
    });
    onOpenChange(false);
    setPieces(1);
    setOverride("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TreePine className="h-5 w-5 text-timber" />
            {wood.name} — Timber Sale
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Step 1: Size */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              1. Dimension
            </div>
            <div className="grid grid-cols-4 gap-2">
              {wood.sizes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSize(s)}
                  className={`rounded-lg border-2 px-3 py-3 text-center transition-all ${
                    size?.id === s.id
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="font-bold text-base">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatKsh(s.ratePerFt * wood.multiplier)}/ft
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Length quick select */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              2. Length (feet)
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {wood.quickLengths.map((l) => (
                <button
                  key={l}
                  onClick={() => setLength(l)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold border transition-all ${
                    length === l
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:border-primary/40"
                  }`}
                >
                  {l} ft
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={length}
                onChange={(e) => setLength(Number(e.target.value) || 0)}
                className="h-9"
                min={1}
              />
              <span className="text-sm text-muted-foreground">ft (custom)</span>
            </div>
          </div>

          {/* Step 3: Pieces */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              3. Pieces
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPieces(Math.max(1, pieces - 1))}
              >
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
            {bulkDisc > 0 && (
              <div className="mt-2 text-xs font-semibold text-success">
                ✓ Bulk discount applied: {bulkDisc}% off
              </div>
            )}
          </div>

          {/* Step 4: Manual override */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              4. Price Override (optional)
            </div>
            <Input
              placeholder={`Auto: ${formatKsh(computed)}`}
              value={override}
              onChange={(e) => setOverride(e.target.value)}
            />
          </div>

          {/* Live total */}
          <div className="rounded-xl bg-[image:var(--gradient-timber)] text-timber-foreground p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider opacity-80">Line Total</div>
              <div className="text-3xl font-bold">{formatKsh(finalTotal)}</div>
              <div className="text-xs opacity-80 mt-1">
                {formatKsh(unitPrice * (1 - bulkDisc / 100))} per piece
              </div>
            </div>
            <TreePine className="h-12 w-12 opacity-30" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="lg"
            onClick={handleAdd}
            disabled={!size || pieces < 1}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
