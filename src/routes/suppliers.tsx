import { createFileRoute } from "@tanstack/react-router";
import { SuppliersPage } from "@/components/pages/SuppliersPage";
import { RequireAuth } from "@/components/auth/RequireAuth";

export const Route = createFileRoute("/suppliers")({
  component: () => (
    <RequireAuth>
      <SuppliersPage />
    </RequireAuth>
  ),
});
