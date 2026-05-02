import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Smartphone, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface Props {
  businessId: string;
  businessName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MpesaConfig {
  id?: string;
  environment: "sandbox" | "production";
  shortcode: string;
  passkey: string;
  consumer_key: string;
  consumer_secret: string;
  callback_url: string;
  is_active: boolean;
}

const blank: MpesaConfig = {
  environment: "sandbox",
  shortcode: "",
  passkey: "",
  consumer_key: "",
  consumer_secret: "",
  callback_url: "",
  is_active: true,
};

export function MpesaConfigDialog({ businessId, businessName, open, onOpenChange }: Props) {
  const [cfg, setCfg] = useState<MpesaConfig>(blank);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setShowSecrets(false);
    (async () => {
      const { data, error } = await supabase
        .from("mpesa_configs")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle();
      if (error) toast.error(error.message);
      if (data) setCfg({ ...blank, ...(data as Partial<MpesaConfig>) });
      else setCfg(blank);
      setLoading(false);
    })();
  }, [open, businessId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        business_id: businessId,
        environment: cfg.environment,
        shortcode: cfg.shortcode.trim(),
        passkey: cfg.passkey.trim(),
        consumer_key: cfg.consumer_key.trim(),
        consumer_secret: cfg.consumer_secret.trim(),
        callback_url: cfg.callback_url.trim() || null,
        is_active: cfg.is_active,
      };
      const { error } = await supabase
        .from("mpesa_configs")
        .upsert(payload, { onConflict: "business_id" });
      if (error) throw error;
      toast.success("M-Pesa configuration saved");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Remove M-Pesa configuration for this business?")) return;
    setBusy(true);
    const { error } = await supabase.from("mpesa_configs").delete().eq("business_id", businessId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed");
      setCfg(blank);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <DialogTitle>M-Pesa Daraja — {businessName}</DialogTitle>
          </div>
          <DialogDescription>
            Configure Safaricom Daraja STK Push credentials for this business. Only system owners can
            view or edit these credentials.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Environment</Label>
                <Select
                  value={cfg.environment}
                  onValueChange={(v) =>
                    setCfg({ ...cfg, environment: v as "sandbox" | "production" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shortcode">Shortcode (Paybill / Till)</Label>
                <Input
                  id="shortcode"
                  value={cfg.shortcode}
                  onChange={(e) => setCfg({ ...cfg, shortcode: e.target.value })}
                  placeholder="174379"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowSecrets((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showSecrets ? "Hide" : "Show"} secrets
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="passkey">Passkey (LNM Online Passkey)</Label>
              <Input
                id="passkey"
                type={showSecrets ? "text" : "password"}
                value={cfg.passkey}
                onChange={(e) => setCfg({ ...cfg, passkey: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ck">Consumer Key</Label>
              <Input
                id="ck"
                type={showSecrets ? "text" : "password"}
                value={cfg.consumer_key}
                onChange={(e) => setCfg({ ...cfg, consumer_key: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cs">Consumer Secret</Label>
              <Input
                id="cs"
                type={showSecrets ? "text" : "password"}
                value={cfg.consumer_secret}
                onChange={(e) => setCfg({ ...cfg, consumer_secret: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cb">Callback URL (optional)</Label>
              <Input
                id="cb"
                value={cfg.callback_url}
                onChange={(e) => setCfg({ ...cfg, callback_url: e.target.value })}
                placeholder="https://yourdomain.com/api/public/mpesa-callback"
              />
              <p className="text-[11px] text-muted-foreground">
                Where Safaricom posts payment confirmations. Leave blank to use the system default.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div>
                <Label htmlFor="active" className="cursor-pointer">
                  Enabled
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Cashiers can charge via M-Pesa when enabled.
                </p>
              </div>
              <Switch
                id="active"
                checked={cfg.is_active}
                onCheckedChange={(v) => setCfg({ ...cfg, is_active: v })}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              {cfg.id && (
                <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={busy}>
                  Remove
                </Button>
              )}
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save configuration
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
