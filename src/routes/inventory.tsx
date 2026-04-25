import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { HardwareInventory } from "@/components/pages/HardwareInventory";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Hardware Inventory — TimberYard POS" },
      { name: "description", content: "Manage hardware stock, prices and suppliers." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <HardwareInventory />
      </AppShell>
    </RequireAuth>
  ),
});
