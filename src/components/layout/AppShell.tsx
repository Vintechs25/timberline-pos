import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, ShoppingCart, Package, TreePine, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; highlight?: boolean };
const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pos", label: "Point of Sale", icon: ShoppingCart, highlight: true },
  { to: "/timber", label: "Timber Yard", icon: TreePine },
  { to: "/inventory", label: "Hardware", icon: Package },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const path = location.pathname;
  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[image:var(--gradient-timber)] text-timber-foreground">
            <TreePine className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-foreground">TimberYard</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Hardware POS
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active = path === item.to || (item.to !== "/" && path.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to as "/"}
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
        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-secondary p-3 text-xs">
            <div className="font-semibold text-foreground">Yard Open</div>
            <div className="text-muted-foreground">Mon–Sat · 7am–6pm</div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
