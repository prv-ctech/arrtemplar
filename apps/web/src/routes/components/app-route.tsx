import { Outlet } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { AuthenticatedUserContext } from "../authenticated-route-user";

export function AppRoute() {
  return (
    <AuthGate>
      {(user) => (
        <AppShell user={user}>
          <AuthenticatedUserContext.Provider value={user}>
            <Outlet />
          </AuthenticatedUserContext.Provider>
        </AppShell>
      )}
    </AuthGate>
  );
}
