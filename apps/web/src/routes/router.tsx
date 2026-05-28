import type { PublicUser } from "@arrtemplar/shared";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Navigate,
  Outlet,
} from "@tanstack/react-router";
import { createContext, useContext } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { LoginForm } from "@/components/auth/LoginForm";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { getLandingPathForUser } from "@/features/auth/auth-navigation";
import { useCurrentUserQuery } from "@/features/auth/auth-state";
import { ThemeSwitcher } from "@/features/theme/ThemeSwitcher";
import { useTheme } from "@/features/theme/theme-state";
import {
  AccountSettings,
  type AccountSettingsPage,
  canAccessAccountSettingsPage,
} from "../features/account/AccountSettings";
import { AdminSettings, type AdminSettingsPage } from "../features/admin/AdminSettings";
import { DashboardPage } from "../features/dashboard/DashboardPage";

const loginMediaAssets = {
  backdrop: "https://picsum.photos/seed/arrtemplar-login-backdrop/1800/1200",
  artwork: "https://picsum.photos/seed/arrtemplar-login-panel/1400/1600",
} as const;

function RootLayout() {
  const { selectedTheme } = useTheme();

  return (
    <>
      <Outlet />
      <Toaster position="top-right" richColors theme={selectedTheme.dark ? "dark" : "light"} />
    </>
  );
}

const AuthenticatedUserContext = createContext<PublicUser | null>(null);

function useAuthenticatedRouteUser(): PublicUser {
  const user = useContext(AuthenticatedUserContext);

  if (!user) {
    throw new Error("Authenticated route user is only available inside authenticated layouts.");
  }

  return user;
}

function IndexRoute() {
  return <Navigate replace to="/app/dashboard" />;
}

function LoginRoute() {
  const userQuery = useCurrentUserQuery();

  if (userQuery.data) {
    return <Navigate replace to={getLandingPathForUser(userQuery.data)} />;
  }

  return (
    <main className="relative isolate min-h-dvh w-full max-w-full overflow-x-hidden bg-background text-foreground">
      <div className="fixed inset-0 -z-10 h-dvh w-full overflow-hidden">
        <img
          alt=""
          aria-hidden="true"
          className="h-full w-full scale-105 object-cover opacity-28 blur-[1.5px] saturate-[0.9]"
          src={loginMediaAssets.backdrop}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,color-mix(in_srgb,var(--primary)_24%,transparent),transparent_28rem),radial-gradient(circle_at_78%_76%,color-mix(in_srgb,var(--ctp-peach)_16%,transparent),transparent_34rem),linear-gradient(180deg,color-mix(in_srgb,var(--background)_58%,transparent),var(--background)_88%)]" />
        <div className="absolute inset-0 bg-background/54" />
      </div>

      <section className="relative grid min-h-dvh place-items-center px-3 py-3 sm:px-5 sm:py-4 lg:px-8">
        <div className="w-full max-w-6xl overflow-hidden rounded-[1.65rem] border border-border bg-card/90 p-0 text-card-foreground shadow-(--shadow-panel) backdrop-blur-xl">
          <div className="grid min-h-0 gap-3 p-3 md:h-[min(36rem,calc(100dvh-3.5rem))] md:grid-cols-[minmax(19rem,0.82fr)_minmax(23rem,1.18fr)]">
            <div className="relative flex min-h-[min(34rem,calc(100dvh-2rem))] items-start justify-center overflow-x-hidden overflow-y-auto overscroll-contain rounded-[1.35rem] border border-border bg-[linear-gradient(135deg,color-mix(in_srgb,var(--card)_94%,transparent),color-mix(in_srgb,var(--background)_94%,transparent),color-mix(in_srgb,var(--secondary)_92%,transparent))] px-5 py-7 shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08)] sm:px-8 md:h-full md:min-h-0 md:px-6 md:py-5 lg:px-8">
              <div className="absolute right-4 top-4">
                <ThemeSwitcher compact />
              </div>
              <LoginForm />
            </div>

            <div className="relative hidden h-full min-h-0 overflow-hidden rounded-[1.35rem] border border-border bg-background md:block">
              <img
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover opacity-90 saturate-[1.04]"
                src={loginMediaAssets.artwork}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_6%,transparent),color-mix(in_srgb,var(--background)_28%,transparent)),radial-gradient(circle_at_70%_22%,color-mix(in_srgb,var(--primary)_22%,transparent),transparent_22rem)]" />
              <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-background/78 to-transparent" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function AppRoute() {
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

function AccountNotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-5xl font-black tracking-tight text-muted-foreground">404</p>
      <h2 className="mt-4 text-xl font-semibold text-foreground">Account section not found</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The requested account route is not available for the signed-in account.
      </p>
    </div>
  );
}

function AccountRoute() {
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

function DashboardRoute() {
  const user = useAuthenticatedRouteUser();

  return <DashboardPage user={user} />;
}

function AccountProfileRoute() {
  const user = useAuthenticatedRouteUser();

  return <AccountSettings activePage="profile" user={user} />;
}

function AccountThemeRoute() {
  const user = useAuthenticatedRouteUser();

  return <AccountSettings activePage="theme" user={user} />;
}

function AccountNotificationsRoute() {
  const user = useAuthenticatedRouteUser();

  return <AccountSettings activePage="notifications" user={user} />;
}

function createAccountDelegatedSection(page: AccountSettingsPage) {
  const component = function AccountDelegatedSection() {
    const user = useAuthenticatedRouteUser();

    if (!canAccessAccountSettingsPage(user, page)) {
      return <AccountNotFound />;
    }

    return <AccountSettings activePage={page} user={user} />;
  };
  component.displayName = `Account${page.charAt(0).toUpperCase() + page.slice(1)}Section`;
  return component;
}

function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-5xl font-black tracking-tight text-muted-foreground">404</p>
      <h2 className="mt-4 text-xl font-semibold text-foreground">Admin section not found</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The admin section you're looking for doesn't exist.
      </p>
      <Link
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-(--shadow-button) transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-px"
        to="/admin/general"
      >
        Back to General settings
      </Link>
    </div>
  );
}

function AdminLayout() {
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

function AdminIndexRedirect() {
  return <Navigate to="/admin/general" replace />;
}

function createAdminSection(page: AdminSettingsPage) {
  const component = function AdminSection() {
    return <AdminSettings activePage={page} />;
  };
  component.displayName = `Admin${page.charAt(0).toUpperCase() + page.slice(1)}Section`;
  return component;
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

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "app",
  component: AppRoute,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "dashboard",
  component: DashboardRoute,
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "account",
  component: AccountRoute,
  notFoundComponent: AccountNotFound,
});

const accountProfileRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "/",
  component: AccountProfileRoute,
});

const accountThemeRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "theme",
  component: AccountThemeRoute,
});

const accountNotificationsRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "notifications",
  component: AccountNotificationsRoute,
});

const accountGeneralRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "general",
  component: createAccountDelegatedSection("general"),
});

const accountLibraryRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "library",
  component: createAccountDelegatedSection("library"),
});

const accountUsersRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "users",
  component: createAccountDelegatedSection("users"),
});

const accountImportRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "import",
  component: createAccountDelegatedSection("import"),
});

const accountServicesRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "services",
  component: createAccountDelegatedSection("services"),
});

const accountLogsRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "logs",
  component: createAccountDelegatedSection("logs"),
});

const accountAboutRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "about",
  component: createAccountDelegatedSection("about"),
});

const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminLayout,
  notFoundComponent: AdminNotFound,
});

const adminIndexRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/",
  component: AdminIndexRedirect,
});

const adminGeneralRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "general",
  component: createAdminSection("general"),
});

const adminLibraryRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "library",
  component: createAdminSection("library"),
});

const adminUsersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "users",
  component: createAdminSection("users"),
});

const adminImportRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "import",
  component: createAdminSection("import"),
});

const adminNotificationsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "notifications",
  component: createAdminSection("notifications"),
});

const adminServicesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "services",
  component: createAdminSection("services"),
});

const adminLogsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "logs",
  component: createAdminSection("logs"),
});

const adminAboutRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "about",
  component: createAdminSection("about"),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  appRoute.addChildren([dashboardRoute]),
  accountRoute.addChildren([
    accountProfileRoute,
    accountThemeRoute,
    accountNotificationsRoute,
    accountGeneralRoute,
    accountLibraryRoute,
    accountUsersRoute,
    accountImportRoute,
    accountServicesRoute,
    accountLogsRoute,
    accountAboutRoute,
  ]),
  adminLayoutRoute.addChildren([
    adminIndexRoute,
    adminGeneralRoute,
    adminLibraryRoute,
    adminUsersRoute,
    adminImportRoute,
    adminNotificationsRoute,
    adminServicesRoute,
    adminLogsRoute,
    adminAboutRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
