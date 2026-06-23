import { type PublicUser, SYSTEM_ADMIN_PERMISSION } from "@arrtemplar/shared";
import {
  BellIcon,
  BookOpenIcon,
  FingerprintIcon,
  GearIcon,
  InfoIcon,
  PaletteIcon,
  PlugsConnectedIcon,
  ScrollIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeSettings } from "@/features/account/AccountSettings";
import { canManageUsers, hasRequiredPermission } from "@/features/auth/auth-state";
import { AuthSettings } from "@/features/auth-settings/AuthSettings";
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import { type SettingsEntry, SettingsNav } from "../settings/SettingsNav";
import { SettingsPanel } from "../settings/SettingsPrimitives";
import { AdminUsersSettings } from "./AdminUsersSettings";

export type AdminSettingsPage =
  | "about"
  | "theme"
  | "general"
  | "library"
  | "notifications"
  | "auth"
  | "services"
  | "logs"
  | "users";

type SettingsRouteTarget =
  | "/settings/users"
  | "/settings/about"
  | "/settings/theme"
  | "/settings/general"
  | "/settings/library"
  | "/settings/notifications"
  | "/settings/auth"
  | "/settings/services"
  | "/settings/logs";

type AdminSettingsEntry = SettingsEntry<AdminSettingsPage> & {
  path: SettingsRouteTarget;
};

function createSettingsEntries(user: PublicUser) {
  const entries: AdminSettingsEntry[] = [
    {
      id: "about",
      label: "About",
      icon: <InfoIcon aria-hidden="true" className="size-5" />,
      path: "/settings/about",
    },
    {
      id: "theme",
      label: "Theme",
      icon: <PaletteIcon aria-hidden="true" className="size-5" />,
      path: "/settings/theme",
    },
  ];

  if (hasRequiredPermission(user, "settings:general")) {
    entries.push({
      id: "general",
      label: "General",
      icon: <GearIcon aria-hidden="true" className="size-5" />,
      path: "/settings/general",
    });
  }

  if (hasRequiredPermission(user, "settings:library")) {
    entries.push({
      id: "library",
      label: "Library",
      icon: <BookOpenIcon aria-hidden="true" className="size-5" />,
      path: "/settings/library",
    });
  }

  if (canManageUsers(user)) {
    entries.push({
      id: "users",
      label: "Users",
      icon: <UserIcon aria-hidden="true" className="size-5" />,
      path: "/settings/users",
    });
  }

  if (hasRequiredPermission(user, "settings:notifications")) {
    entries.push({
      id: "notifications",
      label: "Notifications",
      icon: <BellIcon aria-hidden="true" className="size-5" />,
      path: "/settings/notifications",
    });
  }

  if (hasRequiredPermission(user, SYSTEM_ADMIN_PERMISSION)) {
    entries.push({
      id: "auth",
      label: "Auth",
      icon: <FingerprintIcon aria-hidden="true" className="size-5" />,
      path: "/settings/auth",
    });
  }

  if (hasRequiredPermission(user, "settings:services")) {
    entries.push({
      id: "services",
      label: "Services",
      icon: <PlugsConnectedIcon aria-hidden="true" className="size-5" />,
      path: "/settings/services",
    });
  }

  if (hasRequiredPermission(user, "settings:logs")) {
    entries.push({
      id: "logs",
      label: "Logs",
      icon: <ScrollIcon aria-hidden="true" className="size-5" />,
      path: "/settings/logs",
    });
  }

  return entries as [AdminSettingsEntry, ...AdminSettingsEntry[]];
}

function SettingsPlaceholder({
  description,
  title,
}: {
  title: string;
  description: string;
}): ReactElement {
  return (
    <Card className="shadow-(--shadow-panel)">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">
          This settings section is scaffolded for permission-gated application controls.
        </p>
      </CardContent>
    </Card>
  );
}

function ActiveSettingsPage({ activePage }: { activePage: AdminSettingsPage }) {
  switch (activePage) {
    case "about":
      return (
        <SettingsPlaceholder
          description="Version details, support context, and application information."
          title="About"
        />
      );
    case "theme":
      return <ThemeSettings />;
    case "general":
      return (
        <SettingsPlaceholder
          description="Application settings and display preferences."
          title="General"
        />
      );
    case "library":
      return (
        <SettingsPlaceholder description="Metadata import and library curation." title="Library" />
      );
    case "users":
      return <AdminUsersSettings />;
    case "notifications":
      return (
        <SettingsPlaceholder
          description="App-wide notification channels and delivery settings."
          title="Notifications"
        />
      );
    case "auth":
      return <AuthSettings />;
    case "services":
      return (
        <SettingsPlaceholder
          description="External service integrations and connectivity."
          title="Services"
        />
      );
    case "logs":
      return (
        <SettingsPlaceholder
          description="Audit, retention, and operational log settings."
          title="Logs"
        />
      );
  }
}

export function AdminSettings({ activePage }: { activePage: AdminSettingsPage }) {
  const navigate = useNavigate();
  const user = useAuthenticatedRouteUser();
  const settingsEntries = createSettingsEntries(user);
  const activeEntry = settingsEntries.find((entry) => entry.id === activePage);

  if (!activeEntry) {
    return (
      <Card className="border-dashed bg-card/54 shadow-(--shadow-soft)">
        <CardHeader>
          <CardTitle>Settings section not found</CardTitle>
          <CardDescription>
            This settings section is not available for the signed-in account.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  function handlePageChange(page: AdminSettingsPage) {
    const entry = settingsEntries.find((currentEntry) => currentEntry.id === page);

    if (entry) {
      navigate({ to: entry.path, replace: true });
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">Settings</h1>
      <SettingsNav
        active={activePage}
        entries={settingsEntries}
        label="Settings"
        onSelect={handlePageChange}
      />

      <SettingsPanel activeId={activePage}>
        <ActiveSettingsPage activePage={activePage} />
      </SettingsPanel>
    </div>
  );
}
