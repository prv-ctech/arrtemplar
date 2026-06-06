import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Navigate,
  useParams,
} from "@tanstack/react-router";
import { AccountSettings } from "../features/account/AccountSettings";
import { PersonalProfileRoute, UserProfilePage } from "../features/user/UserProfilePage";
import { UserSettings } from "../features/user/UserSettings";
import { useAuthenticatedRouteUser } from "./authenticated-route-user";
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
import { RootLayout } from "./components/root-layout";

function SettingsIndexRedirect() {
  return <Navigate replace to="/settings/about" />;
}

function ProfileSettingsIndexRedirect() {
  return <Navigate replace to="/profile/settings/main" />;
}

function ManagedProfileSettingsIndexRedirect() {
  const actor = useAuthenticatedRouteUser();
  const { publicUserId } = useParams({ from: "/profile/$publicUserId/settings" });

  if (publicUserId === actor.id) {
    return <Navigate replace to="/profile/settings/main" />;
  }

  return <Navigate replace params={{ publicUserId }} to="/profile/$publicUserId/settings/main" />;
}

function RootNotFoundRoute() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <section className="w-full max-w-md rounded-4xl border border-border bg-card/78 p-6 text-center shadow-(--shadow-soft)">
        <p className="text-sm font-medium text-primary">Route not found</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
          This page is no longer available.
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          User management now lives in Settings, and profile dashboards live under Profile.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-(--shadow-button) transition-[background,transform] duration-300 hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to="/settings/users"
          >
            Open Users
          </Link>
          <Link
            className="rounded-2xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-[background,color,transform] duration-300 hover:-translate-y-0.5 hover:bg-card hover:text-foreground active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to="/profile"
          >
            Open Profile
          </Link>
        </div>
      </section>
    </main>
  );
}

function ProfileSettingsMainRoute() {
  const user = useAuthenticatedRouteUser();

  return <AccountSettings activePage="main" user={user} />;
}

function ProfileSettingsPasswordRoute() {
  const user = useAuthenticatedRouteUser();

  return <AccountSettings activePage="password" user={user} />;
}

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
