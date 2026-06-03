import type { ADMIN_PERMISSION_CATALOG } from "@arrtemplar/shared";

export type DelegatedSettingsPage = (typeof ADMIN_PERMISSION_CATALOG)[number]["routeSlug"];

export type AccountSettingsPage = "profile" | "theme" | "notifications" | DelegatedSettingsPage;
