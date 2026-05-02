import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { provisionBusiness } from "@/server/business-provisioning.functions";
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
import {
  Plus,
  KeyRound,
  ShieldOff,
  ShieldCheck,
  Ban,
  Copy,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { MpesaConfigDialog } from "./MpesaConfigDialog";

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
  const provisionFn = useServerFn(provisionBusiness);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mpesaTarget, setMpesaTarget] = useState<{ id: string; name: string } | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [branchName, setBranchName] = useState("Main Branch");
  const [branchCode, setBranchCode] = useState("HQ");
  const [expiresDays, setExpiresDays] = useState("365");

  // Result state (credentials shown after creation)
  const [result, setResult] = useState<{
    email: string;
    password: string;
    businessName: string;
    licenseKey: string;
  } | null>(null);

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

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setOwnerPassword(p);
    setShowPwd(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerPassword.length < 8) {
      toast.error("Owner password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await provisionFn({
        data: {
          businessName: name.trim(),
          slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          ownerEmail: ownerEmail.trim(),
          ownerPassword,
          ownerFullName: ownerName.trim(),
          defaultBranchName: branchName.trim() || "Main Branch",
          defaultBranchCode: (branchCode.trim() || "HQ").toUpperCase(),
          licenseDays: Number(expiresDays) || 365,
        },
      });
      toast.success("Business provisioned");
      setResult({
        email: res.owner.email,
        password: ownerPassword,
        businessName: res.business.name,
        licenseKey: res.business.license_key,
      });
      // reset form
      setName("");
      setSlug("");
      setOwnerEmail("");
      setOwnerName("");
      setOwnerPassword("");
      setBranchName("Main Branch");
      setBranchCode("HQ");
      setExpiresDays("365");
      setOpen(false);
      await load();
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to provision";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
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

  const extendLicense = async (id: string, days: number) => {
    const newExpiry = new Date(Date.now() + days * 86400 * 1000).toISOString();
    const { error } = await supabase
      .from("businesses")
      .update({ license_expires_at: newExpiry })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Extended by ${days} days`);
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
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Provision new business</DialogTitle>
              <DialogDescription>
                Creates the business, default branch, license, and the owner&apos;s login account in
                one step.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              </div>

              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Business owner login
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ownerName">Owner full name</Label>
                  <Input
                    id="ownerName"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ownerEmail">Owner email</Label>
                  <Input
                    id="ownerEmail"
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ownerPwd">Temporary password</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="ownerPwd"
                        type={showPwd ? "text" : "password"}
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        minLength={8}
                        required
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={generatePassword}>
                      Generate
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Default branch
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input value={branchName} onChange={(e) => setBranchName(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Code</Label>
                    <Input value={branchCode} onChange={(e) => setBranchCode(e.target.value)} required />
                  </div>
                </div>
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
                  Create business
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Credentials display dialog */}
      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <DialogTitle>Business created</DialogTitle>
            </div>
            <DialogDescription>
              Share these credentials with the owner. The password is shown only once.
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Business</div>
                <div className="font-semibold">{result.businessName}</div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Email</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.email);
                      toast.success("Email copied");
                    }}
                    className="font-semibold hover:text-primary inline-flex items-center gap-1"
                  >
                    {result.email}
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Password</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.password);
                      toast.success("Password copied");
                    }}
                    className="font-semibold hover:text-primary inline-flex items-center gap-1"
                  >
                    {result.password}
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">License</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.licenseKey);
                      toast.success("License copied");
                    }}
                    className="font-semibold hover:text-primary inline-flex items-center gap-1"
                  >
                    {result.licenseKey.slice(0, 16)}…
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  {businesses.map((b) => {
                    const expired =
                      b.license_expires_at &&
                      new Date(b.license_expires_at).getTime() < Date.now();
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-medium">{b.name}</div>
                          <div className="text-xs text-muted-foreground">{b.slug}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusColor(b.status) as never}>{b.status}</Badge>
                          {expired && (
                            <Badge variant="destructive" className="ml-1">
                              expired
                            </Badge>
                          )}
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
                              <SelectTrigger className="h-8 w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">
                                  <span className="inline-flex items-center gap-2">
                                    <ShieldCheck className="h-3.5 w-3.5" /> Active
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
                              title="Extend license by 365 days"
                              onClick={() => extendLicense(b.id, 365)}
                            >
                              +1y
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              title="Regenerate license key"
                              onClick={() => regenerateLicense(b.id)}
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              title="M-Pesa Daraja settings"
                              onClick={() => setMpesaTarget({ id: b.id, name: b.name })}
                            >
                              <Smartphone className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {mpesaTarget && (
        <MpesaConfigDialog
          businessId={mpesaTarget.id}
          businessName={mpesaTarget.name}
          open={!!mpesaTarget}
          onOpenChange={(o) => !o && setMpesaTarget(null)}
        />
      )}
    </div>
  );
}
