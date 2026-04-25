import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SystemOwnerPanel } from "@/components/pages/SystemOwnerPanel";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "System Owner — TimberYard POS" },
      { name: "description", content: "Manage businesses, licenses and platform-wide settings." },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <RequireAuth roles={["system_owner"]}>
      <AppShell>
        <SystemOwnerPanel />
      </AppShell>
    </RequireAuth>
  );
}
