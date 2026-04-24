import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { TimberInventory } from "@/components/pages/TimberInventory";

export const Route = createFileRoute("/timber")({
  head: () => ({
    meta: [
      { title: "Timber Yard — TimberYard POS" },
      { name: "description", content: "Manage wood types, sizes and pricing rules." },
    ],
  }),
  component: () => (
    <AppShell>
      <TimberInventory />
    </AppShell>
  ),
});
