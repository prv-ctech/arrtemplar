import { Outlet } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { AppShell } from "@/components/layout/AppShell";

export function AdminLayout() {
  return (
    <AuthGate requiredRole="admin">
      {(user) => (
        <AppShell user={user}>
          <Outlet />
        </AppShell>
      )}
    </AuthGate>
  );
}
