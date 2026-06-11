import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { PersonalProfileRoute, UserProfilePage } from "../features/user/UserProfilePage";
import { UserSettings } from "../features/user/UserSettings";
import { AccountNotificationsRoute } from "./components/account-notifications-route";
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
import { ManagedProfileSettingsIndexRedirect } from "./components/managed-profile-settings-index-redirect";
import { ProfileSettingsIndexRedirect } from "./components/profile-settings-index-redirect";
import { ProfileSettingsMainRoute } from "./components/profile-settings-main-route";
import { ProfileSettingsPasswordRoute } from "./components/profile-settings-password-route";
import { RootLayout } from "./components/root-layout";
import { RootNotFoundRoute } from "./components/root-not-found-route";
import { SettingsIndexRedirect } from "./components/settings-index-redirect";

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: RootNotFoundRoute });

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
  component: PersonalProfileRoute,
});

const profileSettingsIndexRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "settings",
  component: ProfileSettingsIndexRedirect,
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

const userProfileRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "$publicUserId",
  component: UserProfilePage,
});

const userSettingsIndexRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "$publicUserId/settings",
  component: ManagedProfileSettingsIndexRedirect,
});

const userSettingsMainRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "$publicUserId/settings/main",
  component: () => <UserSettings activePage="main" />,
});

const userSettingsPasswordRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "$publicUserId/settings/password",
  component: () => <UserSettings activePage="password" />,
});

const userSettingsPermissionsRoute = createRoute({
  getParentRoute: () => profileRoute,
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

const settingsUsersRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: "users",
  component: AdminUsersRoute,
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
    profileSettingsIndexRoute,
    profileSettingsMainRoute,
    profileSettingsPasswordRoute,
    profileSettingsNotificationsRoute,
    userProfileRoute,
    userSettingsIndexRoute,
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
    settingsUsersRoute,
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
