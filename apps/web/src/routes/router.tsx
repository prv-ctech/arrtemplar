import { createRootRoute, createRoute, createRouter, Navigate } from "@tanstack/react-router";
import { AccountSettings } from "../features/account/AccountSettings";
import { UserProfilePage } from "../features/user/UserProfilePage";
import { UserSettings } from "../features/user/UserSettings";
import { useAuthenticatedRouteUser } from "./authenticated-route-user";
import { AccountNotificationsRoute } from "./components/account-notifications-route";
import { AccountProfileRoute } from "./components/account-profile-route";
import { AccountRoute } from "./components/account-route";
import { AdminAboutRoute } from "./components/admin-about-route";
import { AdminGeneralRoute } from "./components/admin-general-route";
import { AdminImportRoute } from "./components/admin-import-route";
import { AdminLibraryRoute } from "./components/admin-library-route";
import { AdminLogsRoute } from "./components/admin-logs-route";
import { AdminNotificationsRoute } from "./components/admin-notifications-route";
import { AdminServicesRoute } from "./components/admin-services-route";
import { AdminThemeRoute } from "./components/admin-theme-route";
import { AdminUsersRoute } from "./components/admin-users-route";
import { DashboardRoute } from "./components/dashboard-route";
import { IndexRoute } from "./components/index-route";
import { LoginRoute } from "./components/login-route";
import { RootLayout } from "./components/root-layout";

function SettingsIndexRedirect() {
  return <Navigate replace to="/settings/about" />;
}

function ProfileSettingsMainRoute() {
  const user = useAuthenticatedRouteUser();

  return <AccountSettings activePage="main" user={user} />;
}

function ProfileSettingsPasswordRoute() {
  const user = useAuthenticatedRouteUser();

  return <AccountSettings activePage="password" user={user} />;
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

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  component: AccountRoute,
});

const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "dashboard",
  component: DashboardRoute,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "profile",
  component: AccountRoute,
});

const profileIndexRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "/",
  component: AccountProfileRoute,
});

const profileSettingsMainRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "settings/main",
  component: ProfileSettingsMainRoute,
});

const profileSettingsPasswordRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "settings/password",
  component: ProfileSettingsPasswordRoute,
});

const profileSettingsNotificationsRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "settings/notifications",
  component: AccountNotificationsRoute,
});

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "users",
  component: AccountRoute,
});

const usersIndexRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: "/",
  component: AdminUsersRoute,
});

const userProfileRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: "$publicUserId",
  component: UserProfilePage,
});

const userSettingsMainRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: "$publicUserId/settings/main",
  component: () => <UserSettings activePage="main" />,
});

const userSettingsPasswordRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: "$publicUserId/settings/password",
  component: () => <UserSettings activePage="password" />,
});

const userSettingsPermissionsRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: "$publicUserId/settings/permissions",
  component: () => <UserSettings activePage="permissions" />,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings",
  component: AccountRoute,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "/",
  component: SettingsIndexRedirect,
});

const settingsThemeRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "theme",
  component: AdminThemeRoute,
});

const settingsAboutRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "about",
  component: AdminAboutRoute,
});

const settingsGeneralRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "general",
  component: AdminGeneralRoute,
});

const settingsLibraryRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "library",
  component: AdminLibraryRoute,
});

const settingsImportRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "import",
  component: AdminImportRoute,
});

const settingsNotificationsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "notifications",
  component: AdminNotificationsRoute,
});

const settingsServicesRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "services",
  component: AdminServicesRoute,
});

const settingsLogsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "logs",
  component: AdminLogsRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  authenticatedRoute.addChildren([dashboardRoute]),
  profileRoute.addChildren([
    profileIndexRoute,
    profileSettingsMainRoute,
    profileSettingsPasswordRoute,
    profileSettingsNotificationsRoute,
  ]),
  usersRoute.addChildren([
    usersIndexRoute,
    userProfileRoute,
    userSettingsMainRoute,
    userSettingsPasswordRoute,
    userSettingsPermissionsRoute,
  ]),
  settingsRoute.addChildren([
    settingsIndexRoute,
    settingsThemeRoute,
    settingsAboutRoute,
    settingsGeneralRoute,
    settingsLibraryRoute,
    settingsImportRoute,
    settingsNotificationsRoute,
    settingsServicesRoute,
    settingsLogsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
