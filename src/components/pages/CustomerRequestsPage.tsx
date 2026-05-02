import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBranchSelection } from "@/lib/cloud-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, ClipboardList, CheckCircle2, XCircle, ShoppingBag, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface CustomerRequest {
  id: string;
  business_id: string;
  branch_id: string;
  item_name: string;
  description: string | null;
  quantity: number;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  notes: string | null;
  fulfilled_at: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "ordered", label: "Ordered" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "cancelled", label: "Cancelled" },
];

export function CustomerRequestsPage() {
  const { activeBusinessId, isBusinessAdmin, isSystemOwner } = useAuth();
  const { activeBranchId } = useBranchSelection();
  const canManage = isBusinessAdmin || isSystemOwner;

  const [items, setItems] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Form state
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_requests")
      .select("*")
      .eq("business_id", activeBusinessId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    else setItems((data as CustomerRequest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // realtime
    if (!activeBusinessId) return;
    const ch = supabase
      .channel(`cust-req-${activeBusinessId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_requests", filter: `business_id=eq.${activeBusinessId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  const recommendations = useMemo(() => {
    // group pending requests by item name (case-insensitive) -> demand score
    const map = new Map<string, { name: string; total: number; count: number; lastAt: string }>();
    for (const r of items) {
      if (r.status === "fulfilled" || r.status === "cancelled") continue;
      const key = r.item_name.trim().toLowerCase();
      const cur = map.get(key);
      if (cur) {
        cur.total += Number(r.quantity) || 1;
        cur.count += 1;
        if (r.created_at > cur.lastAt) cur.lastAt = r.created_at;
      } else {
        map.set(key, {
          name: r.item_name,
          total: Number(r.quantity) || 1,
          count: 1,
          lastAt: r.created_at,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || b.total - a.total)
      .slice(0, 6);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !r.item_name.toLowerCase().includes(s) &&
          !(r.customer_name ?? "").toLowerCase().includes(s) &&
          !(r.customer_phone ?? "").toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [items, filter, search]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusinessId || !activeBranchId) {
      toast.error("Select a business and branch first.");
      return;
    }
    if (!itemName.trim()) return;
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("customer_requests").insert({
      business_id: activeBusinessId,
      branch_id: activeBranchId,
      item_name: itemName.trim(),
      description: description.trim() || null,
      quantity: Number(quantity) || 1,
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
      notes: notes.trim() || null,
      recorded_by: userData.user?.id ?? null,
      status: "pending",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Request recorded");
      setItemName("");
      setDescription("");
      setQuantity("1");
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
      setOpen(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "fulfilled") patch.fulfilled_at = new Date().toISOString();
    else patch.fulfilled_at = null;
    const { error } = await supabase.from("customer_requests").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Updated");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this request?")) return;
    const { error } = await supabase.from("customer_requests").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Deleted");
  };

  const statusBadge = (s: string) => {
    if (s === "fulfilled") return "default";
    if (s === "ordered") return "secondary";
    if (s === "cancelled") return "outline";
    return "secondary";
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> Customer Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Record items customers ask for that aren&apos;t in stock — use them to plan restocking.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Record customer request</DialogTitle>
              <DialogDescription>
                Capture what the customer wanted so the team knows what to stock next.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="item">Item *</Label>
                <Input
                  id="item"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. 4x2 Cypress 14ft"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qty">Quantity</Label>
                  <Input
                    id="qty"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cname">Customer name</Label>
                  <Input
                    id="cname"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cphone">Customer phone</Label>
                <Input
                  id="cphone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Optional — to call back when available"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description / specs</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brand, size, colour, etc."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Internal notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Restocking recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Top restocking recommendations
            </CardTitle>
            <CardDescription>
              Most-requested items not yet fulfilled — consider adding them to your next order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center justify-between rounded-md border bg-muted/30 p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {r.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.count} request{r.count === 1 ? "" : "s"} · qty {r.total}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {r.count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>All requests</CardTitle>
              <CardDescription>{filtered.length} shown</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search item or customer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48"
              />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No requests yet. Click <strong>New request</strong> when a customer asks for an item
              you don&apos;t carry.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="hidden md:table-cell">Customer</TableHead>
                    <TableHead className="hidden lg:table-cell">When</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.item_name}</div>
                        {r.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {r.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{r.quantity}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm">{r.customer_name ?? "—"}</div>
                        {r.customer_phone && (
                          <div className="text-xs text-muted-foreground">{r.customer_phone}</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadge(r.status) as never}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Select
                            value={r.status}
                            onValueChange={(v) => updateStatus(r.id, v)}
                          >
                            <SelectTrigger className="h-8 w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label === "Fulfilled" ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> {o.label}
                                    </span>
                                  ) : o.label === "Cancelled" ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <XCircle className="h-3.5 w-3.5" /> {o.label}
                                    </span>
                                  ) : (
                                    o.label
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(r.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              Delete
                            </Button>
                          )}
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
