import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SalesHistoryPage } from "@/components/pages/SalesHistoryPage";

export const Route = createFileRoute("/sales-history")({
  head: () => ({
    meta: [
      { title: "Sales History — TimberYard POS" },
      { name: "description", content: "Browse, search and reprint past sales receipts." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <SalesHistoryPage />
      </AppShell>
    </RequireAuth>
  ),
});
