import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ShieldCheck,
  ShieldOff,
  Ban,
  Receipt,
  Users,
  TrendingUp,
  Loader2,
  Plus,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatKsh } from "@/lib/cloud-store";

interface BusinessRow {
  id: string;
  name: string;
  status: "active" | "suspended" | "revoked";
  license_expires_at: string | null;
  created_at: string;
}

interface PlatformStats {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  revokedBusinesses: number;
  expired: number;
  totalSales: number;
  todayRevenue: number;
  todayCount: number;
  totalCustomers: number;
}

export function SystemOwnerDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [{ data: bizData }, { data: salesData }, { count: custCount }] = await Promise.all([
        supabase.from("businesses").select("id,name,status,license_expires_at,created_at").order("created_at", { ascending: false }),
        supabase.from("sales").select("total,created_at,status").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("customers").select("id", { count: "exact", head: true }),
      ]);

      const biz = (bizData as BusinessRow[]) ?? [];
      const sales = (salesData as { total: number; created_at: string; status: string }[]) ?? [];
      const todays = sales.filter((s) => new Date(s.created_at) >= today && s.status !== "refunded");
      const allValid = sales.filter((s) => s.status !== "refunded");

      setBusinesses(biz);
      setStats({
        totalBusinesses: biz.length,
        activeBusinesses: biz.filter((b) => b.status === "active").length,
        suspendedBusinesses: biz.filter((b) => b.status === "suspended").length,
        revokedBusinesses: biz.filter((b) => b.status === "revoked").length,
        expired: biz.filter(
          (b) => b.license_expires_at && new Date(b.license_expires_at) < new Date(),
        ).length,
        totalSales: allValid.reduce((s, x) => s + Number(x.total), 0),
        todayRevenue: todays.reduce((s, x) => s + Number(x.total), 0),
        todayCount: todays.length,
        totalCustomers: custCount ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading platform overview…
      </div>
    );
  }

  const cards = [
    { label: "Businesses", value: stats.totalBusinesses, sub: `${stats.activeBusinesses} active`, icon: Building2, tone: "bg-primary text-primary-foreground" },
    { label: "Today's Revenue", value: formatKsh(stats.todayRevenue), sub: `${stats.todayCount} sales`, icon: TrendingUp, tone: "bg-[image:var(--gradient-amber)] text-accent-foreground" },
    { label: "30-day Revenue", value: formatKsh(stats.totalSales), sub: "all businesses", icon: Receipt, tone: "bg-card border border-border" },
    { label: "Customers", value: stats.totalCustomers, sub: "across platform", icon: Users, tone: "bg-card border border-border" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            System owner view across all businesses.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin">
            <Plus className="mr-2 h-4 w-4" /> Manage Businesses
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className={`p-5 ${c.tone}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider opacity-80">{c.label}</div>
                <div className="text-2xl font-bold mt-2">{c.value}</div>
                <div className="text-xs opacity-70 mt-1">{c.sub}</div>
              </div>
              <c.icon className="h-5 w-5 opacity-70" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <h3 className="text-sm font-semibold">Active</h3>
          </div>
          <div className="text-3xl font-bold">{stats.activeBusinesses}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldOff className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold">Suspended</h3>
          </div>
          <div className="text-3xl font-bold">{stats.suspendedBusinesses}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold">Revoked / Expired</h3>
          </div>
          <div className="text-3xl font-bold">{stats.revokedBusinesses + stats.expired}</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Businesses</CardTitle>
          <CardDescription>Newest provisioned tenants.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {businesses.slice(0, 8).map((b) => {
              const expired = b.license_expires_at && new Date(b.license_expires_at) < new Date();
              return (
                <div key={b.id} className="flex items-center justify-between border-b border-border last:border-0 py-2">
                  <div>
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(b.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant={b.status === "active" ? "default" : b.status === "suspended" ? "secondary" : "destructive"}>
                      {b.status}
                    </Badge>
                    {expired && <Badge variant="destructive">expired</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
