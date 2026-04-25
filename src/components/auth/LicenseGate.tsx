import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Clock, Ban, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface BusinessLicense {
  status: "active" | "suspended" | "revoked";
  license_expires_at: string | null;
  name: string;
}

export function LicenseGate({ children }: { children: React.ReactNode }) {
  const { activeBusinessId, isSystemOwner } = useAuth();
  const [biz, setBiz] = useState<BusinessLicense | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!activeBusinessId) {
      setBiz(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("businesses")
      .select("status,license_expires_at,name")
      .eq("id", activeBusinessId)
      .maybeSingle();
    setBiz(data as BusinessLicense | null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // poll every 60s for live validation
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  // System owners bypass license checks
  if (isSystemOwner) return <>{children}</>;
  if (loading || !activeBusinessId) return <>{children}</>;
  if (!biz) return <>{children}</>;

  const expired =
    biz.license_expires_at && new Date(biz.license_expires_at).getTime() < Date.now();
  const blocked = biz.status !== "active" || expired;

  if (!blocked) return <>{children}</>;

  const isSuspended = biz.status === "suspended";
  const isRevoked = biz.status === "revoked";
  const Icon = isRevoked ? Ban : isSuspended ? ShieldAlert : Clock;
  const title = isRevoked
    ? "License revoked"
    : isSuspended
      ? "Account suspended"
      : "License expired";
  const message = isRevoked
    ? "This business account has been revoked. Contact support to restore access."
    : isSuspended
      ? "This business account is currently suspended. All sales and inventory changes are blocked."
      : `Your license expired on ${new Date(biz.license_expires_at!).toLocaleDateString()}. Renew to continue using the system.`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Icon className="h-7 w-7" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="text-base">{biz.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">{message}</p>
          <div className="flex flex-col gap-2">
            <Button onClick={load} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" /> Re-check status
            </Button>
            <Button asChild variant="ghost">
              <Link to="/auth">Sign out / switch account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
