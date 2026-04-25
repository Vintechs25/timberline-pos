import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ReportsPage } from "@/components/pages/ReportsPage";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — TimberYard POS" },
      { name: "description", content: "Sales, profit and inventory reports." },
    ],
  }),
  component: () => (
    <RequireAuth roles={["system_owner", "business_admin"]}>
      <AppShell>
        <ReportsPage />
      </AppShell>
    </RequireAuth>
  ),
});
