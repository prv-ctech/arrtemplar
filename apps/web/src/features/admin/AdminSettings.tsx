import {
  BellIcon,
  BookOpenIcon,
  DownloadSimpleIcon,
  GearIcon,
  InfoIcon,
  PlugsConnectedIcon,
  ScrollIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { type ReactElement, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { type SettingsEntry, SettingsNav } from "../settings/SettingsNav";
import {
  SettingsPanel,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
} from "../settings/SettingsPrimitives";

type AdminSettingsPage =
  | "general"
  | "library"
  | "users"
  | "import"
  | "notifications"
  | "services"
  | "logs"
  | "about";

const settingsEntries = [
  {
    id: "general",
    label: "General",
    icon: <GearIcon aria-hidden="true" className="size-5" />,
    description: "Application settings and display preferences",
  },
  {
    id: "library",
    label: "Library",
    icon: <BookOpenIcon aria-hidden="true" className="size-5" />,
    description: "Metadata import and library curation",
  },
  {
    id: "users",
    label: "Users",
    icon: <UserIcon aria-hidden="true" className="size-5" />,
    description: "User management and permissions",
  },
  {
    id: "import",
    label: "Import",
    icon: <DownloadSimpleIcon aria-hidden="true" className="size-5" />,
    description: "Import queue, files, and parser",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: <BellIcon aria-hidden="true" className="size-5" />,
    description: "Notification channels and webhooks",
  },
  {
    id: "services",
    label: "Services",
    icon: <PlugsConnectedIcon aria-hidden="true" className="size-5" />,
    description: "External service integrations",
  },
  {
    id: "logs",
    label: "Logs",
    icon: <ScrollIcon aria-hidden="true" className="size-5" />,
    description: "Logging level, retention, audit",
  },
  {
    id: "about",
    label: "About",
    icon: <InfoIcon aria-hidden="true" className="size-5" />,
    description: "Version info and credits",
  },
] satisfies [SettingsEntry<AdminSettingsPage>, ...SettingsEntry<AdminSettingsPage>[]];

function GeneralSettings() {
  return (
    <div className="space-y-10">
      <SettingsSection description="Configure global application settings." title="Application">
        <SettingsRow controlId="settings-application-title" label="Application Title">
          <Input
            className="sm:max-w-72"
            defaultValue="Arrtemplar"
            id="settings-application-title"
            placeholder="Arrtemplar"
          />
        </SettingsRow>
        <SettingsRow controlId="settings-application-url" label="Application URL">
          <Input
            className="sm:max-w-72"
            id="settings-application-url"
            placeholder="https://arrtemplar.example.com"
          />
        </SettingsRow>
        <SettingsRow
          controlId="settings-display-language"
          description="Display region for search and discovery content."
          label="Display Language"
        >
          <SettingsSelect id="settings-display-language">
            <option>English</option>
            <option>Español</option>
            <option>Français</option>
            <option>Deutsch</option>
            <option>日本語</option>
          </SettingsSelect>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        description="Control how content is discovered and displayed."
        title="Search & Discovery"
      >
        <SettingsRow
          controlId="settings-discover-region"
          description="Filter content by regional availability."
          label="Discover Region"
        >
          <SettingsSelect id="settings-discover-region">
            <option>All Regions</option>
            <option>United States</option>
            <option>Europe</option>
            <option>Asia</option>
          </SettingsSelect>
        </SettingsRow>
        <SettingsRow
          controlId="settings-discover-language"
          description="Filter content by original language."
          label="Discover Language"
        >
          <SettingsSelect id="settings-discover-language">
            <option>All Languages</option>
            <option>English</option>
            <option>Japanese</option>
            <option>Korean</option>
          </SettingsSelect>
        </SettingsRow>
        <SettingsRow
          controlId="settings-image-caching"
          description="Cache externally sourced images (requires a significant amount of disk space)."
          label="Enable Image Caching"
        >
          <Switch defaultChecked id="settings-image-caching" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-hide-available-media"
          description="Hide available media from discover pages but not search results."
          label="Hide Available Media"
        >
          <Switch id="settings-hide-available-media" />
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end">
        <Button type="button">Save Changes</Button>
      </div>
    </div>
  );
}

function LibrarySettings() {
  return (
    <div className="space-y-10">
      <SettingsSection
        description="Configure how metadata is sourced and imported."
        title="Metadata"
      >
        <SettingsRow
          controlId="settings-metadata-provider"
          description="Primary provider for anime metadata lookups."
          label="Metadata Provider"
        >
          <SettingsSelect id="settings-metadata-provider">
            <option>Jikan (MyAnimeList)</option>
            <option>AniList</option>
            <option>AniDB</option>
            <option>Kitsu</option>
          </SettingsSelect>
        </SettingsRow>
        <SettingsRow
          controlId="settings-auto-import-metadata"
          description="Automatically fetch metadata when new content is detected."
          label="Auto-Import Metadata"
        >
          <Switch defaultChecked id="settings-auto-import-metadata" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-refresh-interval"
          description="How often to check for metadata updates, in hours."
          label="Refresh Interval"
        >
          <Input
            className="sm:max-w-28"
            defaultValue="24"
            id="settings-refresh-interval"
            placeholder="24"
            type="number"
          />
        </SettingsRow>
        <SettingsRow
          controlId="settings-metadata-cache"
          description="Cache metadata locally to reduce API calls."
          label="Metadata Cache"
        >
          <Switch defaultChecked id="settings-metadata-cache" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        description="Control how library entries are curated and reviewed."
        title="Curation"
      >
        <SettingsRow
          controlId="settings-manual-review-required"
          description="Require manual approval for album and entry curation."
          label="Manual Review Required"
        >
          <Switch defaultChecked id="settings-manual-review-required" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-auto-approve-aliases"
          description="Auto-attach folder aliases when parser confidence is high."
          label="Auto-Approve Aliases"
        >
          <Switch defaultChecked id="settings-auto-approve-aliases" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-metadata-confidence-threshold"
          description="Minimum parser confidence score to auto-attach metadata."
          label="Confidence Threshold"
        >
          <Input
            className="sm:max-w-28"
            defaultValue="0.75"
            id="settings-metadata-confidence-threshold"
            placeholder="0.75"
            type="number"
          />
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end">
        <Button type="button">Save Changes</Button>
      </div>
    </div>
  );
}

function UsersSettings() {
  return (
    <div className="space-y-10">
      <SettingsSection
        description="Configure user registration and default settings."
        title="User Management"
      >
        <SettingsRow
          controlId="settings-allow-registration"
          description="Allow new users to register without an invite."
          label="Allow Registration"
        >
          <Switch id="settings-allow-registration" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-default-role"
          description="Default role assigned to newly registered users."
          label="Default Role"
        >
          <SettingsSelect id="settings-default-role">
            <option>Viewer</option>
            <option>Requester</option>
            <option>Contributor</option>
          </SettingsSelect>
        </SettingsRow>
        <SettingsRow
          controlId="settings-max-requests-per-user"
          description="Maximum number of active requests a user can have."
          label="Max Requests Per User"
        >
          <Input
            className="sm:max-w-28"
            defaultValue="10"
            id="settings-max-requests-per-user"
            placeholder="10"
            type="number"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection description="Granular permissions for each role." title="Permissions">
        <SettingsRow
          controlId="settings-submit-requests"
          description="Allow users to submit new content requests."
          label="Submit Requests"
        >
          <Switch defaultChecked id="settings-submit-requests" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-manage-own-requests"
          description="Allow users to manage their own requests."
          label="Manage Own Requests"
        >
          <Switch defaultChecked id="settings-manage-own-requests" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-admin-access"
          description="Allow users to view the admin panel."
          label="Admin Access"
        >
          <Switch id="settings-admin-access" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-user-management"
          description="Allow users to manage other users."
          label="User Management"
        >
          <Switch id="settings-user-management" />
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end">
        <Button type="button">Save Changes</Button>
      </div>
    </div>
  );
}

function ImportSettings() {
  return (
    <div className="space-y-10">
      <SettingsSection
        description="Configure the import queue and file processing."
        title="Import Queue"
      >
        <SettingsRow
          controlId="settings-queue-processing"
          description="Automatically process new items added to the import queue."
          label="Queue Processing"
        >
          <Switch defaultChecked id="settings-queue-processing" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-concurrent-imports"
          description="Number of items to process concurrently."
          label="Concurrent Imports"
        >
          <Input
            className="sm:max-w-28"
            defaultValue="3"
            id="settings-concurrent-imports"
            placeholder="3"
            type="number"
          />
        </SettingsRow>
        <SettingsRow
          controlId="settings-retry-failed-imports"
          description="Automatically retry failed imports up to 3 times."
          label="Retry Failed Imports"
        >
          <Switch defaultChecked id="settings-retry-failed-imports" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-clean-up-after-import"
          description="Delete source files after successful import."
          label="Clean Up After Import"
        >
          <Switch id="settings-clean-up-after-import" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        description="Configure how release names and paths are parsed."
        title="Parser"
      >
        <SettingsRow
          controlId="settings-parser-mode"
          description="Parser mode determines how releases are matched to library entries."
          label="Parser Mode"
        >
          <SettingsSelect id="settings-parser-mode">
            <option>Strict</option>
            <option>Balanced</option>
            <option>Lenient</option>
          </SettingsSelect>
        </SettingsRow>
        <SettingsRow
          controlId="settings-parser-confidence-threshold"
          description="Minimum confidence score for automatic parse matching."
          label="Confidence Threshold"
        >
          <Input
            className="sm:max-w-28"
            defaultValue="0.6"
            id="settings-parser-confidence-threshold"
            placeholder="0.6"
            type="number"
          />
        </SettingsRow>
        <SettingsRow
          controlId="settings-verbose-parser-logging"
          description="Enable detailed parser logging for troubleshooting."
          label="Verbose Parser Logging"
        >
          <Switch id="settings-verbose-parser-logging" />
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end">
        <Button type="button">Save Changes</Button>
      </div>
    </div>
  );
}

function NotificationsSettings() {
  return (
    <div className="space-y-10">
      <SettingsSection
        description="Configure webhook endpoints for external notifications."
        title="Webhook"
      >
        <SettingsRow
          controlId="settings-enable-webhooks"
          description="Enable outbound webhook notifications for events."
          label="Enable Webhooks"
        >
          <Switch id="settings-enable-webhooks" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-webhook-url"
          description="URL endpoint for receiving webhook payloads."
          label="Webhook URL"
        >
          <Input
            className="sm:max-w-72"
            id="settings-webhook-url"
            placeholder="https://hooks.example.com/webhook"
          />
        </SettingsRow>
        <SettingsRow
          controlId="settings-webhook-secret"
          description="Secret token for webhook payload verification."
          label="Webhook Secret"
        >
          <Input
            className="sm:max-w-72"
            id="settings-webhook-secret"
            placeholder="whsec_..."
            type="password"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        description="Fine-tune which events trigger notifications."
        title="Notification Events"
      >
        <SettingsRow
          controlId="settings-new-request-notifications"
          description="Notify when a new request is submitted."
          label="New Requests"
        >
          <Switch defaultChecked id="settings-new-request-notifications" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-import-complete-notifications"
          description="Notify when an import completes successfully."
          label="Import Complete"
        >
          <Switch defaultChecked id="settings-import-complete-notifications" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-import-failed-notifications"
          description="Notify when an import fails."
          label="Import Failed"
        >
          <Switch defaultChecked id="settings-import-failed-notifications" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-user-registration-notifications"
          description="Notify on user registration."
          label="User Registration"
        >
          <Switch id="settings-user-registration-notifications" />
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end">
        <Button type="button">Save Changes</Button>
      </div>
    </div>
  );
}

function ServicesSettings() {
  return (
    <div className="space-y-10">
      <SettingsSection
        description="Connect external media services and providers."
        title="Media Services"
      >
        <SettingsRow description="Plex Media Server connection for library sync." label="Plex">
          <Button aria-label="Configure Plex" variant="outline" type="button">
            Configure
          </Button>
        </SettingsRow>
        <SettingsRow description="Jellyfin server connection for library sync." label="Jellyfin">
          <Button aria-label="Configure Jellyfin" variant="outline" type="button">
            Configure
          </Button>
        </SettingsRow>
        <SettingsRow description="Emby server connection for library sync." label="Emby">
          <Button aria-label="Configure Emby" variant="outline" type="button">
            Configure
          </Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        description="Configure download clients for media acquisition."
        title="Download Clients"
      >
        <SettingsRow description="Torrent-based download client integration." label="qBittorrent">
          <Button aria-label="Configure qBittorrent" variant="outline" type="button">
            Configure
          </Button>
        </SettingsRow>
        <SettingsRow description="Usenet-based download client integration." label="SABnzbd">
          <Button aria-label="Configure SABnzbd" variant="outline" type="button">
            Configure
          </Button>
        </SettingsRow>
        <SettingsRow description="Direct download client integration." label="Transmission">
          <Button aria-label="Configure Transmission" variant="outline" type="button">
            Configure
          </Button>
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end">
        <Button type="button">Save Changes</Button>
      </div>
    </div>
  );
}

function LogsSettings() {
  return (
    <div className="space-y-10">
      <SettingsSection description="Configure logging behavior and output." title="Logging">
        <SettingsRow
          controlId="settings-log-level"
          description="Verbosity level for application logs."
          label="Log Level"
        >
          <SettingsSelect defaultValue="Info" id="settings-log-level">
            <option>Debug</option>
            <option>Info</option>
            <option>Warning</option>
            <option>Error</option>
          </SettingsSelect>
        </SettingsRow>
        <SettingsRow
          controlId="settings-log-retention"
          description="How long to retain log files before rotation."
          label="Log Retention"
        >
          <SettingsSelect defaultValue="30 days" id="settings-log-retention">
            <option>7 days</option>
            <option>30 days</option>
            <option>90 days</option>
            <option>Never</option>
          </SettingsSelect>
        </SettingsRow>
        <SettingsRow
          controlId="settings-file-logging"
          description="Write logs to disk in addition to terminal output."
          label="File Logging"
        >
          <Switch defaultChecked id="settings-file-logging" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        description="Audit trail configuration for tracking administrative actions."
        title="Audit"
      >
        <SettingsRow
          controlId="settings-enable-audit-trail"
          description="Record all administrative actions for auditing."
          label="Enable Audit Trail"
        >
          <Switch defaultChecked id="settings-enable-audit-trail" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-log-request-payloads"
          description="Include request payload data in audit logs."
          label="Log Request Payloads"
        >
          <Switch id="settings-log-request-payloads" />
        </SettingsRow>
        <SettingsRow
          controlId="settings-auto-prune-audit-logs"
          description="Automatically prune audit logs older than the retention period."
          label="Auto-Prune Audit Logs"
        >
          <Switch defaultChecked id="settings-auto-prune-audit-logs" />
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end">
        <Button type="button">Save Changes</Button>
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="space-y-10">
      <Card className="overflow-hidden border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="flex items-center gap-3 text-xl">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-sm font-black tracking-[-0.08em] text-primary-foreground">
              AW
            </span>
            Arrtemplar
          </CardTitle>
          <CardDescription>
            Self-hosted media management tooling for anime watchlists, metadata, and library
            curation.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline">v0.1.0</Badge>
            <Badge variant="outline">Elysia + React</Badge>
            <Badge variant="outline">Catppuccin</Badge>
          </div>
        </CardContent>
      </Card>

      <SettingsSection title="Tech Stack">
        <SettingsRow label="Runtime">
          <span className="text-sm text-foreground">Bun</span>
        </SettingsRow>
        <SettingsRow label="Backend">
          <span className="text-sm text-foreground">Elysia</span>
        </SettingsRow>
        <SettingsRow label="Database">
          <span className="text-sm text-foreground">SQLite + Drizzle ORM</span>
        </SettingsRow>
        <SettingsRow label="Frontend">
          <span className="text-sm text-foreground">React + TanStack Router + Tailwind CSS</span>
        </SettingsRow>
        <SettingsRow label="UI">
          <span className="text-sm text-foreground">shadcn/ui + Radix + Phosphor Icons</span>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="License">
        <SettingsRow label="License">
          <span className="text-sm text-foreground">MIT</span>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

type SettingsComponent = () => ReactElement;

const pageComponents: Record<AdminSettingsPage, SettingsComponent> = {
  general: GeneralSettings,
  library: LibrarySettings,
  users: UsersSettings,
  import: ImportSettings,
  notifications: NotificationsSettings,
  services: ServicesSettings,
  logs: LogsSettings,
  about: AboutPage,
};

export function AdminSettings() {
  const [activePage, setActivePage] = useState<AdminSettingsPage>("general");
  const activeEntry =
    settingsEntries.find((entry) => entry.id === activePage) ?? settingsEntries[0];
  const ActiveComponent = pageComponents[activePage];

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">Admin settings</h1>
      <SettingsNav
        active={activePage}
        entries={settingsEntries}
        label="Admin settings"
        onSelect={setActivePage}
      />

      <SettingsPanel
        activeId={activePage}
        description={activeEntry.description}
        title={activeEntry.label}
      >
        <ActiveComponent />
      </SettingsPanel>
    </div>
  );
}
