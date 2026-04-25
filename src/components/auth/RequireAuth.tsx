import { type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  roles?: AppRole[];
}

export function RequireAuth({ children, roles }: Props) {
  const { user, loading, roles: userRoles } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" />;

  if (roles && roles.length > 0) {
    const has = userRoles.some((r) => roles.includes(r.role));
    if (!has) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6 text-center">
          <div>
            <h1 className="text-2xl font-bold">Access denied</h1>
            <p className="mt-2 text-muted-foreground">
              You do not have permission to view this page.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
