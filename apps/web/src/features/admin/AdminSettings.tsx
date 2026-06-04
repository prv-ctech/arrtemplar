import type { PublicUser } from "@arrtemplar/shared";
import {
  BellIcon,
  BookOpenIcon,
  DownloadSimpleIcon,
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
import { useAuthenticatedRouteUser } from "@/routes/authenticated-route-user";
import { type SettingsEntry, SettingsNav } from "../settings/SettingsNav";
import { SettingsPanel } from "../settings/SettingsPrimitives";
import { AdminUsersSettings } from "./AdminUsersSettings";

export type AdminSettingsPage =
  | "about"
  | "theme"
  | "general"
  | "library"
  | "import"
  | "notifications"
  | "services"
  | "logs"
  | "users";

type SettingsRouteTarget =
  | "/users"
  | "/settings/about"
  | "/settings/theme"
  | "/settings/general"
  | "/settings/library"
  | "/settings/import"
  | "/settings/notifications"
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
      description: "Safe application information and version details.",
      path: "/settings/about",
    },
    {
      id: "theme",
      label: "Theme",
      icon: <PaletteIcon aria-hidden="true" className="size-5" />,
      description: "Theme preference for the signed-in user.",
      path: "/settings/theme",
    },
  ];

  if (hasRequiredPermission(user, "settings:general")) {
    entries.push({
      id: "general",
      label: "General",
      icon: <GearIcon aria-hidden="true" className="size-5" />,
      description: "Application settings and display preferences.",
      path: "/settings/general",
    });
  }

  if (hasRequiredPermission(user, "settings:library")) {
    entries.push({
      id: "library",
      label: "Library",
      icon: <BookOpenIcon aria-hidden="true" className="size-5" />,
      description: "Metadata import and library curation.",
      path: "/settings/library",
    });
  }

  if (canManageUsers(user)) {
    entries.push({
      id: "users",
      label: "Users",
      icon: <UserIcon aria-hidden="true" className="size-5" />,
      description: "User directory and per-user management surfaces.",
      path: "/users",
    });
  }

  if (hasRequiredPermission(user, "settings:import")) {
    entries.push({
      id: "import",
      label: "Import",
      icon: <DownloadSimpleIcon aria-hidden="true" className="size-5" />,
      description: "Import queue, files, and parser settings.",
      path: "/settings/import",
    });
  }

  if (hasRequiredPermission(user, "settings:notifications")) {
    entries.push({
      id: "notifications",
      label: "Notifications",
      icon: <BellIcon aria-hidden="true" className="size-5" />,
      description: "App-wide notification channels and delivery settings.",
      path: "/settings/notifications",
    });
  }

  if (hasRequiredPermission(user, "settings:services")) {
    entries.push({
      id: "services",
      label: "Services",
      icon: <PlugsConnectedIcon aria-hidden="true" className="size-5" />,
      description: "External service integrations and connectivity.",
      path: "/settings/services",
    });
  }

  if (hasRequiredPermission(user, "settings:logs")) {
    entries.push({
      id: "logs",
      label: "Logs",
      icon: <ScrollIcon aria-hidden="true" className="size-5" />,
      description: "Audit, retention, and operational log settings.",
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
      return SettingsPlaceholder({
        title: "About",
        description: "Version details, support context, and application information.",
      });
    case "theme":
      return <ThemeSettings />;
    case "general":
      return SettingsPlaceholder({
        title: "General",
        description: "Application settings and display preferences.",
      });
    case "library":
      return SettingsPlaceholder({
        title: "Library",
        description: "Metadata import and library curation.",
      });
    case "users":
      return <AdminUsersSettings />;
    case "import":
      return SettingsPlaceholder({
        title: "Import",
        description: "Import queue, files, and parser settings.",
      });
    case "notifications":
      return SettingsPlaceholder({
        title: "Notifications",
        description: "App-wide notification channels and delivery settings.",
      });
    case "services":
      return SettingsPlaceholder({
        title: "Services",
        description: "External service integrations and connectivity.",
      });
    case "logs":
      return SettingsPlaceholder({
        title: "Logs",
        description: "Audit, retention, and operational log settings.",
      });
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

      <SettingsPanel
        activeId={activePage}
        description={activeEntry.description}
        title={activeEntry.label}
      >
        <ActiveSettingsPage activePage={activePage} />
      </SettingsPanel>
    </div>
  );
}
