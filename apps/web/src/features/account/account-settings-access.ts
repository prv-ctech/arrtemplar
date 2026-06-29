import { hasPermissionGrant, type PublicUser, type UserPermission } from "@arrtemplar/shared";
import type { AccountSettingsPage } from "./account-settings-types";

const accountSettingsPagePermissions = {
  main: "profile:update",
  password: "profile:password",
  notifications: "profile:notifications",
} satisfies Record<AccountSettingsPage, UserPermission>;

export function canAccessAccountSettingsPage(user: PublicUser, page: AccountSettingsPage): boolean {
  return hasPermissionGrant(user.permissions, accountSettingsPagePermissions[page]);
}
