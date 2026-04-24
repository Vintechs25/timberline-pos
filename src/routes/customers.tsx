import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { CustomersPage } from "@/components/pages/CustomersPage";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customers & Credit — TimberYard POS" },
      { name: "description", content: "Contractor accounts, credit and balances." },
    ],
  }),
  component: () => (
    <AppShell>
      <CustomersPage />
    </AppShell>
  ),
});
