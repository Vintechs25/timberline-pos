import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SuppliersPage } from "@/components/pages/SuppliersPage";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — TimberYard POS" },
      { name: "description", content: "Manage suppliers, balances and payments." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <SuppliersPage />
      </AppShell>
    </RequireAuth>
  ),
});
