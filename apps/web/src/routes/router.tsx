import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { LoginForm } from "@/components/auth/LoginForm";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { getLandingPathForUser } from "@/features/auth/auth-navigation";
import { useCurrentUserQuery } from "@/features/auth/auth-state";
import { DashboardPage } from "@/features/dashboard/DashboardPage";

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster position="top-right" richColors />
    </>
  );
}

function IndexRoute() {
  return <Navigate replace to="/dashboard" />;
}

function LoginRoute() {
  const userQuery = useCurrentUserQuery();

  if (userQuery.data) {
    return <Navigate replace to={getLandingPathForUser(userQuery.data)} />;
  }

  return (
    <main className="grid min-h-[100dvh] px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,0.7fr)] lg:gap-10 lg:px-10">
      <section className="flex items-center py-10 lg:py-0">
        <div className="max-w-3xl space-y-6">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary">
            Arrweeb-anime
          </p>
          <h1 className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Anime-native operations, secured at the door.
          </h1>
          <p className="max-w-[64ch] text-base leading-7 text-muted-foreground sm:text-lg">
            Phase 3 turns the project from a health-check landing page into an authenticated app
            shell with role-aware navigation for users and admins.
          </p>
        </div>
      </section>
      <div className="flex items-center">
        <LoginForm />
      </div>
    </main>
  );
}

function DashboardRoute() {
  return (
    <AuthGate>
      {(user) => (
        <AppShell section="Dashboard" user={user}>
          <DashboardPage user={user} />
        </AppShell>
      )}
    </AuthGate>
  );
}

function AdminRoute() {
  return (
    <AuthGate requiredRole="admin">
      {(user) => (
        <AppShell section="Admin" user={user}>
          <AdminDashboard />
        </AppShell>
      )}
    </AuthGate>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexRoute,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginRoute,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardRoute,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminRoute,
});

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, dashboardRoute, adminRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
