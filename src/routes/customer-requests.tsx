import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { CustomerRequestsPage } from "@/components/pages/CustomerRequestsPage";

export const Route = createFileRoute("/customer-requests")({
  head: () => ({
    meta: [
      { title: "Customer Requests — TimberYard POS" },
      { name: "description", content: "Track items customers asked for that weren't in stock to plan restocking." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <CustomerRequestsPage />
      </AppShell>
    </RequireAuth>
  ),
});
