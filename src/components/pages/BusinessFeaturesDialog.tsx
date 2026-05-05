import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const FEATURES: { key: string; label: string; desc: string }[] = [
  { key: "hardware", label: "Hardware Inventory", desc: "Hardware products & POS" },
  { key: "timber", label: "Timber Yard", desc: "Timber products & dimensional pricing" },
  { key: "credit", label: "Customer Credit", desc: "Customer accounts & credit sales" },
  { key: "reports", label: "Reports", desc: "Analytics & reporting page" },
  { key: "suppliers", label: "Suppliers", desc: "Supplier ledger & POs" },
  { key: "customer_requests", label: "Customer Requests", desc: "Out-of-stock requests log" },
  { key: "mpesa", label: "M-Pesa STK Push", desc: "Allow STK push payments" },
  { key: "refunds", label: "Refunds", desc: "Allow admin to refund sales" },
  { key: "price_override", label: "Price Override", desc: "Admin override of cart total" },
];

export function BusinessFeaturesDialog({
  businessId,
  businessName,
  open,
  onOpenChange,
  onSaved,
}: {
  businessId: string;
  businessName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("businesses")
        .select("features")
        .eq("id", businessId)
        .maybeSingle();
      const f = (data?.features as Record<string, boolean>) ?? {};
      const merged: Record<string, boolean> = {};
      FEATURES.forEach((x) => {
        merged[x.key] = f[x.key] !== false;
      });
      setFeatures(merged);
      setLoading(false);
    })();
  }, [open, businessId]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({ features })
      .eq("id", businessId);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Features updated");
      onSaved?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Features — {businessName}</DialogTitle>
          <DialogDescription>
            Toggle modules available to this business. Changes apply immediately.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div
                key={f.key}
                className="flex items-start justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <Label className="text-sm font-semibold">{f.label}</Label>
                  <div className="text-xs text-muted-foreground">{f.desc}</div>
                </div>
                <Switch
                  checked={features[f.key] ?? true}
                  onCheckedChange={(v) => setFeatures((p) => ({ ...p, [f.key]: v }))}
                />
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
