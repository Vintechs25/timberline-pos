import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { POSScreen } from "@/components/pages/POSScreen";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "Point of Sale — TimberYard POS" },
      { name: "description", content: "Fast hardware and timber sales screen." },
    ],
  }),
  component: () => (
    <AppShell>
      <POSScreen />
    </AppShell>
  ),
});
