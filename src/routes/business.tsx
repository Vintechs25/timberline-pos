import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { BusinessAdminPanel } from "@/components/pages/BusinessAdminPanel";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Business Settings — TimberYard POS" },
      { name: "description", content: "Manage your branches and staff." },
    ],
  }),
  component: BusinessRoute,
});

function BusinessRoute() {
  return (
    <RequireAuth roles={["system_owner", "business_admin"]}>
      <AppShell>
        <BusinessAdminPanel />
      </AppShell>
    </RequireAuth>
  );
}
