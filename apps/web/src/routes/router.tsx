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
import { getLandingPathForUser } from "@/features/auth/auth-navigation";
import { useCurrentUserQuery } from "@/features/auth/auth-state";
import { ThemeSwitcher } from "@/features/theme/ThemeSwitcher";
import { useTheme } from "@/features/theme/theme-state";
import { AdminDashboard } from "../features/admin/AdminDashboard";
import { DashboardPage } from "../features/dashboard/DashboardPage";

function RootLayout() {
  const { selectedTheme } = useTheme();

  return (
    <>
      <Outlet />
      <Toaster position="top-right" richColors theme={selectedTheme.dark ? "dark" : "light"} />
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
    <main className="min-h-dvh w-full max-w-full overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] max-w-370 flex-col gap-6">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-background/54 px-1 pb-4 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-(--shadow-button)">
              <span className="text-sm font-black tracking-[-0.08em]">AW</span>
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">Arrweeb-anime</p>
              <p className="text-xs text-muted-foreground">private release desk</p>
            </div>
          </div>
          <ThemeSwitcher compact />
        </header>
        <section className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(24rem,0.72fr)] lg:items-stretch">
          <div className="relative overflow-hidden rounded-[2.1rem] border border-border bg-card/60 shadow-(--shadow-panel) lg:min-h-[calc(100dvh-9rem)]">
            <div className="absolute inset-0">
              <img
                alt="Film still style landscape with night lights and distant mountains"
                className="h-full w-full object-cover opacity-72"
                src="https://picsum.photos/seed/arrweeb-cinema-access/1800/1200"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--ctp-crust)_0%,color-mix(in_srgb,var(--ctp-base)_88%,transparent)_42%,transparent_78%),radial-gradient(circle_at_78%_22%,color-mix(in_srgb,var(--ctp-peach)_32%,transparent),transparent_24rem),radial-gradient(circle_at_24%_74%,color-mix(in_srgb,var(--ctp-mauve)_28%,transparent),transparent_30rem)]" />
            </div>
            <div className="relative flex min-h-104 flex-col justify-center gap-7 p-5 sm:p-7 lg:min-h-full lg:p-8">
              <div className="flex max-w-xl items-center gap-3 rounded-[1.2rem] border border-border bg-background/54 p-3 backdrop-blur-xl">
                <span className="h-10 w-1 rounded-full bg-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Catppuccin secured access</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Four native flavors, one protected session.
                  </p>
                </div>
              </div>
              <div className="max-w-3xl space-y-6">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-(--ctp-peach)">
                  request intake / playback curation
                </p>
                <h1 className="text-balance text-3xl font-semibold leading-none tracking-tighter text-foreground sm:text-4xl">
                  Curate the queue before playback.
                </h1>
                <p className="max-w-[64ch] text-base leading-7 text-muted-foreground sm:text-lg">
                  Sign in to review requests, watch backend health, and prepare the metadata import
                  surface without losing the cinematic media-first layout.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Protected shell", "role-aware routing"],
                    ["Health stream", "30s API cadence"],
                    ["Theme flavors", "Latte to Mocha"],
                  ].map(([title, detail]) => (
                    <div
                      className="rounded-2xl border border-border bg-background/62 p-4 backdrop-blur-xl"
                      key={title}
                    >
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center lg:py-8">
            <LoginForm />
          </div>
        </section>
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
