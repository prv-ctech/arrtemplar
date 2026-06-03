import { ADMIN_PERMISSION_CATALOG, type PublicUser } from "@arrtemplar/shared";
import { hasDelegatedAccountPermission } from "@/features/auth/auth-state";
import type { AccountSettingsPage } from "./account-settings-types";

export function canAccessAccountSettingsPage(user: PublicUser, page: AccountSettingsPage): boolean {
  if (page === "profile" || page === "theme" || page === "notifications") {
    return true;
  }

  const catalogEntry = ADMIN_PERMISSION_CATALOG.find((entry) => entry.routeSlug === page);

  return catalogEntry ? hasDelegatedAccountPermission(user, catalogEntry.permission) : false;
}
