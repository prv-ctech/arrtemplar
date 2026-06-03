import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AccountAboutRoute } from "./components/account-about-route";
import { AccountGeneralRoute } from "./components/account-general-route";
import { AccountImportRoute } from "./components/account-import-route";
import { AccountLibraryRoute } from "./components/account-library-route";
import { AccountLogsRoute } from "./components/account-logs-route";
import { AccountNotFound } from "./components/account-not-found";
import { AccountNotificationsRoute } from "./components/account-notifications-route";
import { AccountProfileRoute } from "./components/account-profile-route";
import { AccountRoute } from "./components/account-route";
import { AccountServicesRoute } from "./components/account-services-route";
import { AccountThemeRoute } from "./components/account-theme-route";
import { AccountUsersRoute } from "./components/account-users-route";
import { AdminAboutRoute } from "./components/admin-about-route";
import { AdminGeneralRoute } from "./components/admin-general-route";
import { AdminImportRoute } from "./components/admin-import-route";
import { AdminIndexRedirect } from "./components/admin-index-redirect";
import { AdminLayout } from "./components/admin-layout";
import { AdminLibraryRoute } from "./components/admin-library-route";
import { AdminLogsRoute } from "./components/admin-logs-route";
import { AdminNotFound } from "./components/admin-not-found";
import { AdminNotificationsRoute } from "./components/admin-notifications-route";
import { AdminServicesRoute } from "./components/admin-services-route";
import { AdminUsersRoute } from "./components/admin-users-route";
import { AppRoute } from "./components/app-route";
import { DashboardRoute } from "./components/dashboard-route";
import { IndexRoute } from "./components/index-route";
import { LoginRoute } from "./components/login-route";
import { RootLayout } from "./components/root-layout";

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
  component: AccountGeneralRoute,
});

const accountLibraryRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "library",
  component: AccountLibraryRoute,
});

const accountUsersRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "users",
  component: AccountUsersRoute,
});

const accountImportRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "import",
  component: AccountImportRoute,
});

const accountServicesRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "services",
  component: AccountServicesRoute,
});

const accountLogsRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "logs",
  component: AccountLogsRoute,
});

const accountAboutRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: "about",
  component: AccountAboutRoute,
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
  component: AdminGeneralRoute,
});

const adminLibraryRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "library",
  component: AdminLibraryRoute,
});

const adminUsersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "users",
  component: AdminUsersRoute,
});

const adminImportRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "import",
  component: AdminImportRoute,
});

const adminNotificationsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "notifications",
  component: AdminNotificationsRoute,
});

const adminServicesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "services",
  component: AdminServicesRoute,
});

const adminLogsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "logs",
  component: AdminLogsRoute,
});

const adminAboutRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "about",
  component: AdminAboutRoute,
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
