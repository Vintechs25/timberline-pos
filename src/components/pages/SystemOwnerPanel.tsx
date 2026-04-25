import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, KeyRound, ShieldOff, ShieldCheck, Ban, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

interface Business {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "revoked";
  license_key: string;
  license_expires_at: string | null;
  features: Record<string, boolean>;
  owner_user_id: string | null;
  created_at: string;
}

export function SystemOwnerPanel() {
  const { refresh } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [expiresDays, setExpiresDays] = useState("365");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setBusinesses((data as Business[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const expiresAt = expiresDays
      ? new Date(Date.now() + Number(expiresDays) * 86400 * 1000).toISOString()
      : null;

    let ownerId: string | null = null;
    if (ownerEmail.trim()) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("full_name", ownerEmail.trim())
        .maybeSingle();
      if (profile) ownerId = (profile as { id: string }).id;
    }

    const { data: biz, error } = await supabase
      .from("businesses")
      .insert({
        name: name.trim(),
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        license_expires_at: expiresAt,
        owner_user_id: ownerId,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }

    if (ownerId && biz) {
      await supabase.from("user_roles").insert({
        user_id: ownerId,
        role: "business_admin",
        business_id: biz.id,
      });
      await supabase.from("business_users").insert({
        user_id: ownerId,
        business_id: biz.id,
      });
    }

    toast.success("Business created");
    setName("");
    setSlug("");
    setOwnerEmail("");
    setExpiresDays("365");
    setOpen(false);
    setBusy(false);
    await load();
    await refresh();
  };

  const setStatus = async (id: string, status: Business["status"]) => {
    const { error } = await supabase.from("businesses").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Business ${status}`);
      await load();
    }
  };

  const regenerateLicense = async (id: string) => {
    const newKey = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("businesses").update({ license_key: newKey }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("License regenerated");
      await load();
    }
  };

  const statusColor = (s: Business["status"]) =>
    s === "active" ? "default" : s === "suspended" ? "secondary" : "destructive";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Owner</h1>
          <p className="text-sm text-muted-foreground">Manage businesses, licenses and platform features.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New business
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Provision new business</DialogTitle>
              <DialogDescription>
                A unique license key is auto-generated. You can assign an admin later.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Business name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="acme-yard"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner">Admin full name (existing user, optional)</Label>
                <Input
                  id="owner"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="Full name as in profile"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp">License valid for (days)</Label>
                <Input
                  id="exp"
                  type="number"
                  min={1}
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Businesses</CardTitle>
          <CardDescription>
            {businesses.length} business{businesses.length === 1 ? "" : "es"} provisioned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : businesses.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No businesses yet. Click <strong>New business</strong> to provision one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">License</TableHead>
                    <TableHead className="hidden md:table-cell">Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businesses.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-medium">{b.name}</div>
                        <div className="text-xs text-muted-foreground">{b.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor(b.status) as any}>{b.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <button
                          className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            navigator.clipboard.writeText(b.license_key);
                            toast.success("License copied");
                          }}
                        >
                          {b.license_key.slice(0, 12)}…
                          <Copy className="h-3 w-3" />
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {b.license_expires_at
                          ? new Date(b.license_expires_at).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Select
                            value={b.status}
                            onValueChange={(v) => setStatus(b.id, v as Business["status"])}
                          >
                            <SelectTrigger className="h-8 w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">
                                <span className="inline-flex items-center gap-2">
                                  <ShieldCheck className="h-3.5 w-3.5" /> Activate
                                </span>
                              </SelectItem>
                              <SelectItem value="suspended">
                                <span className="inline-flex items-center gap-2">
                                  <ShieldOff className="h-3.5 w-3.5" /> Suspend
                                </span>
                              </SelectItem>
                              <SelectItem value="revoked">
                                <span className="inline-flex items-center gap-2">
                                  <Ban className="h-3.5 w-3.5" /> Revoke
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => regenerateLicense(b.id)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
