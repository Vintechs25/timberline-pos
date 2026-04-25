import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "system_owner" | "business_admin" | "supervisor" | "cashier" | "staff";

export interface UserRole {
  role: AppRole;
  business_id: string | null;
  branch_id: string | null;
}

export interface BusinessSummary {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "revoked";
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roles: UserRole[];
  businesses: BusinessSummary[];
  activeBusinessId: string | null;
  setActiveBusinessId: (id: string | null) => void;
  loading: boolean;
  isSystemOwner: boolean;
  isBusinessAdmin: boolean;
  isSupervisor: boolean;
  isCashier: boolean;
  isStaff: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACTIVE_BIZ_KEY = "ty_active_business";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveBusinessId = (id: string | null) => {
    setActiveBusinessIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(ACTIVE_BIZ_KEY, id);
      else localStorage.removeItem(ACTIVE_BIZ_KEY);
    }
  };

  const loadUserData = async (uid: string) => {
    const [{ data: rolesData }, { data: bizData }] = await Promise.all([
      supabase.from("user_roles").select("role,business_id,branch_id").eq("user_id", uid),
      supabase.from("businesses").select("id,name,slug,status").order("name"),
    ]);
    setRoles((rolesData as UserRole[]) ?? []);
    setBusinesses((bizData as BusinessSummary[]) ?? []);

    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_BIZ_KEY) : null;
    const accessibleIds = new Set((bizData ?? []).map((b: any) => b.id));
    if (stored && accessibleIds.has(stored)) {
      setActiveBusinessIdState(stored);
    } else if (bizData && bizData.length > 0) {
      setActiveBusinessIdState(bizData[0].id);
      if (typeof window !== "undefined") localStorage.setItem(ACTIVE_BIZ_KEY, bizData[0].id);
    } else {
      setActiveBusinessIdState(null);
    }
  };

  const refresh = async () => {
    if (user) await loadUserData(user.id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // defer to avoid deadlocks
        setTimeout(() => {
          loadUserData(newSession.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setRoles([]);
        setBusinesses([]);
        setActiveBusinessIdState(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadUserData(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSystemOwner = roles.some((r) => r.role === "system_owner");
  const isBusinessAdmin = roles.some((r) => r.role === "business_admin");
  const isSupervisor = roles.some((r) => r.role === "supervisor");
  const isCashier = roles.some((r) => r.role === "cashier");
  const isStaff = roles.some((r) => r.role === "staff" || r.role === "cashier" || r.role === "supervisor");

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        roles,
        businesses,
        activeBusinessId,
        setActiveBusinessId,
        loading,
        isSystemOwner,
        isBusinessAdmin,
        isSupervisor,
        isCashier,
        isStaff,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
