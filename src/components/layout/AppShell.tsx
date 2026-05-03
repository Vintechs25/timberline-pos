import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  TreePine,
  Users,
  BarChart3,
  Menu,
  Shield,
  Building2,
  LogOut,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  MapPin,
  History,
  ClipboardList,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { LicenseGate } from "@/components/auth/LicenseGate";
import { useBranches, useBranchSelection } from "@/lib/cloud-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  highlight?: boolean;
  roles?: ("system_owner" | "business_admin" | "supervisor" | "cashier" | "staff")[];
};

const allNav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pos", label: "Point of Sale", icon: ShoppingCart, highlight: true },
  { to: "/sales-history", label: "Sales History", icon: History },
  { to: "/customer-requests", label: "Customer Requests", icon: ClipboardList },
  { to: "/timber", label: "Timber Yard", icon: TreePine },
  { to: "/inventory", label: "Hardware", icon: Package },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/suppliers", label: "Suppliers", icon: Truck, roles: ["system_owner", "business_admin", "supervisor"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["system_owner", "business_admin", "supervisor"] },
  { to: "/business", label: "Business", icon: Building2, roles: ["system_owner", "business_admin"] },
  { to: "/admin", label: "Admin", icon: Shield, roles: ["system_owner"] },
];

const SIDEBAR_OPEN_KEY = "ty_sidebar_open";

function NavList({
  path,
  onNavigate,
  items,
}: {
  path: string;
  onNavigate?: () => void;
  items: NavItem[];
}) {
  return (
    <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
      {items.map((item) => {
        const active = path === item.to || (item.to !== "/" && path.startsWith(item.to));
        return (
          <Link
            key={item.to}
            to={item.to as "/"}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              item.highlight && !active && "text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
            {item.highlight && !active && (
              <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase text-accent-foreground">
                F2
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-timber)] text-timber-foreground">
        <TreePine className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-bold tracking-tight text-foreground leading-none">
          TimberYard
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
          Hardware POS
        </div>
      </div>
    </div>
  );
}

function BusinessSwitcher() {
  const { businesses, activeBusinessId, setActiveBusinessId } = useAuth();
  if (businesses.length === 0) return null;
  return (
    <Select value={activeBusinessId ?? ""} onValueChange={(v) => setActiveBusinessId(v)}>
      <SelectTrigger className="h-9 text-xs">
        <Building2 className="h-3.5 w-3.5 mr-1" />
        <SelectValue placeholder="Select business" />
      </SelectTrigger>
      <SelectContent>
        {businesses.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BranchSwitcher() {
  const { branches } = useBranches();
  const { activeBranchId, setActiveBranchId } = useBranchSelection();
  const { roles } = useAuth();
  // Cashiers/supervisors with a fixed branch_id are locked to that branch
  const lockedBranch = roles.find((r) => r.branch_id);

  // Auto-select first branch if none selected, or locked branch
  useEffect(() => {
    if (lockedBranch?.branch_id) {
      if (activeBranchId !== lockedBranch.branch_id) setActiveBranchId(lockedBranch.branch_id);
      return;
    }
    if (!activeBranchId && branches.length > 0) {
      setActiveBranchId(branches[0].id);
    } else if (activeBranchId && !branches.find((b) => b.id === activeBranchId) && branches.length > 0) {
      setActiveBranchId(branches[0].id);
    }
  }, [branches, activeBranchId, setActiveBranchId, lockedBranch]);

  if (branches.length === 0) return null;
  if (lockedBranch?.branch_id) {
    const b = branches.find((br) => br.id === lockedBranch.branch_id);
    return (
      <div className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-muted/40 text-xs">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium truncate">{b?.name ?? "Branch"}</span>
      </div>
    );
  }
  return (
    <Select value={activeBranchId ?? ""} onValueChange={(v) => setActiveBranchId(v)}>
      <SelectTrigger className="h-9 text-xs">
        <MapPin className="h-3.5 w-3.5 mr-1" />
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name} <span className="text-muted-foreground">· {b.code}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UserMenu() {
  const { user, signOut, isSystemOwner, isBusinessAdmin, isSupervisor, isCashier } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const initial = (user.email ?? "?")[0]?.toUpperCase();
  const roleLabel = isSystemOwner
    ? "System Owner"
    : isBusinessAdmin
      ? "Business Owner"
      : isSupervisor
        ? "Supervisor"
        : isCashier
          ? "Cashier"
          : "Staff";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/50 p-2 text-left hover:bg-secondary transition-colors">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{user.email}</div>
            <div className="text-[10px] text-muted-foreground">{roleLabel}</div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarPanel({
  path,
  items,
  onNavigate,
  user,
}: {
  path: string;
  items: NavItem[];
  onNavigate?: () => void;
  user: ReturnType<typeof useAuth>["user"];
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-5 py-5 border-b border-border">
        <Brand />
      </div>
      <div className="px-3 py-3 border-b border-border space-y-2">
        <BusinessSwitcher />
        <BranchSwitcher />
      </div>
      <NavList path={path} items={items} onNavigate={onNavigate} />
      <div className="border-t border-border p-3">
        {user ? (
          <UserMenu />
        ) : (
          <Button asChild size="sm" className="w-full">
            <Link to="/auth" onClick={onNavigate}>
              Sign in
            </Link>
          </Button>
        )}
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const path = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const v = localStorage.getItem(SIDEBAR_OPEN_KEY);
    return v === "1";
  });
  const { roles, user } = useAuth();
  const userRoles = new Set(roles.map((r) => r.role));

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SIDEBAR_OPEN_KEY, desktopOpen ? "1" : "0");
    }
  }, [desktopOpen]);

  const items = allNav.filter(
    (i) => !i.roles || i.roles.some((r) => userRoles.has(r)),
  );

  const currentLabel = items.find((n) =>
    n.to === "/" ? path === "/" : path.startsWith(n.to),
  )?.label;

  // Mobile bottom bar: 5 items max, prefer high-frequency ones
  const bottomItems = items
    .filter((i) => ["/", "/pos", "/timber", "/inventory", "/reports", "/business", "/admin"].includes(i.to))
    .slice(0, 5);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar — collapsible */}
      <aside
        className={cn(
          "hidden md:flex flex-shrink-0 flex-col border-r border-border bg-card transition-all duration-200 ease-in-out overflow-hidden",
          desktopOpen ? "w-60" : "w-0 border-r-0",
        )}
      >
        <div className="w-60 flex flex-col h-full">
          <SidebarPanel path={path} items={items} user={user} />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (desktop + mobile) */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5">
          {/* Desktop sidebar toggle */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={desktopOpen ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setDesktopOpen((v) => !v)}
            className="hidden md:inline-flex"
          >
            {desktopOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" />
            )}
          </Button>

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[85vw] max-w-sm flex flex-col">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarPanel
                path={path}
                items={items}
                user={user}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 min-w-0">
            <span className="hidden md:inline text-sm font-bold text-foreground truncate">
              {currentLabel ?? "TimberYard"}
            </span>
          </div>

          <div className="flex-1 text-center md:hidden min-w-0">
            <div className="text-sm font-bold text-foreground truncate">
              {currentLabel ?? "TimberYard"}
            </div>
          </div>

          <Button asChild variant="ghost" size="icon" aria-label="Quick sale">
            <Link to="/pos">
              <ShoppingCart className="h-5 w-5 text-accent" />
            </Link>
          </Button>
        </header>

        <main className="flex-1 overflow-x-hidden pb-16 md:pb-0">
          <LicenseGate>{children}</LicenseGate>
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 grid border-t border-border bg-card"
          style={{ gridTemplateColumns: `repeat(${bottomItems.length}, minmax(0, 1fr))` }}
        >
          {bottomItems.map((item) => {
            const active = path === item.to || (item.to !== "/" && path.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to as "/"}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors",
                  active ? "text-accent" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="truncate max-w-full px-1">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
