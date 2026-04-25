import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Loader2, MapPin, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
}

interface StaffRow {
  user_id: string;
  role: "business_admin" | "staff";
  branch_id: string | null;
  full_name: string | null;
  id: string;
}

export function BusinessAdminPanel() {
  const { activeBusinessId, businesses } = useAuth();
  const business = businesses.find((b) => b.id === activeBusinessId);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [branchOpen, setBranchOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [bname, setBname] = useState("");
  const [bcode, setBcode] = useState("");
  const [baddr, setBaddr] = useState("");
  const [bphone, setBphone] = useState("");

  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<"business_admin" | "staff">("staff");
  const [staffBranch, setStaffBranch] = useState<string>("");

  const load = async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    const [{ data: br }, { data: ur }] = await Promise.all([
      supabase
        .from("branches")
        .select("*")
        .eq("business_id", activeBusinessId)
        .order("name"),
      supabase
        .from("user_roles")
        .select("id,user_id,role,branch_id,profiles:profiles!user_roles_user_id_fkey(full_name)")
        .eq("business_id", activeBusinessId),
    ]);
    setBranches((br as Branch[]) ?? []);
    setStaff(
      ((ur as any[]) ?? []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        branch_id: r.branch_id,
        full_name: r.profiles?.full_name ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  const createBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusinessId) return;
    setBusy(true);
    const { error } = await supabase.from("branches").insert({
      business_id: activeBusinessId,
      name: bname.trim(),
      code: bcode.trim().toUpperCase(),
      address: baddr.trim() || null,
      phone: bphone.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Branch added");
    setBname("");
    setBcode("");
    setBaddr("");
    setBphone("");
    setBranchOpen(false);
    load();
  };

  const inviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusinessId) return;
    setBusy(true);
    // Find profile by full name (simple lookup for demo). In prod use email lookup via edge function.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("full_name", staffName.trim())
      .maybeSingle();
    if (!profile) {
      toast.error("No user found with that full name. Ask them to sign up first.");
      setBusy(false);
      return;
    }
    const userId = (profile as { id: string }).id;
    const { error } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: staffRole,
      business_id: activeBusinessId,
      branch_id: staffBranch || null,
    });
    if (!error) {
      await supabase
        .from("business_users")
        .upsert(
          {
            user_id: userId,
            business_id: activeBusinessId,
            default_branch_id: staffBranch || null,
          },
          { onConflict: "business_id,user_id" },
        );
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Staff added");
    setStaffName("");
    setStaffBranch("");
    setStaffRole("staff");
    setStaffOpen(false);
    load();
  };

  const removeStaff = async (id: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed");
      load();
    }
  };

  if (!business) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>No business selected</CardTitle>
            <CardDescription>
              You are not a member of any business yet. Ask your System Owner to add you.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Business Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage branches and staff for{" "}
          <span className="font-medium text-foreground">{business.name}</span>.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Branches</CardTitle>
            <CardDescription>Each branch tracks its own inventory and sales.</CardDescription>
          </div>
          <Dialog open={branchOpen} onOpenChange={setBranchOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> Branch
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add branch</DialogTitle>
              </DialogHeader>
              <form onSubmit={createBranch} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={bname} onChange={(e) => setBname(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input
                    value={bcode}
                    onChange={(e) => setBcode(e.target.value)}
                    placeholder="HQ"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={baddr} onChange={(e) => setBaddr(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={bphone} onChange={(e) => setBphone(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add branch
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
            </div>
          ) : branches.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No branches yet.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {branches.map((b) => (
                <div key={b.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div className="font-medium">{b.name}</div>
                    <Badge variant="secondary" className="ml-auto">
                      {b.code}
                    </Badge>
                  </div>
                  {b.address && (
                    <div className="mt-1 text-xs text-muted-foreground">{b.address}</div>
                  )}
                  {b.phone && (
                    <div className="text-xs text-muted-foreground">{b.phone}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Staff</CardTitle>
            <CardDescription>Assign roles and branches to your team.</CardDescription>
          </div>
          <Dialog open={staffOpen} onOpenChange={setStaffOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-1 h-4 w-4" /> Staff
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add staff member</DialogTitle>
                <DialogDescription>
                  The user must already have an account. Enter their full name as on their profile.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={inviteStaff} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select
                    value={staffRole}
                    onValueChange={(v) => setStaffRole(v as "business_admin" | "staff")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="business_admin">Business Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Branch (optional)</Label>
                  <Select value={staffBranch || "none"} onValueChange={(v) => setStaffBranch(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any branch</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No staff assigned yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => {
                    const branch = branches.find((b) => b.id === s.branch_id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>{s.full_name || s.user_id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <Badge variant={s.role === "business_admin" ? "default" : "secondary"}>
                            {s.role.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {branch?.name ?? "Any"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeStaff(s.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
