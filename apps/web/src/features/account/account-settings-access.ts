import type { PublicUser } from "@arrtemplar/shared";
import type { AccountSettingsPage } from "./account-settings-types";

const allowedAccountSettingsPages = new Set<AccountSettingsPage>([
  "main",
  "password",
  "notifications",
]);

export function canAccessAccountSettingsPage(
  _user: PublicUser,
  page: AccountSettingsPage,
): boolean {
  return allowedAccountSettingsPages.has(page);
}
