import { AccountSettings } from "@/features/account/AccountSettings";
import { canAccessAccountSettingsPage } from "@/features/account/account-settings-access";
import type { DelegatedSettingsPage } from "@/features/account/account-settings-types";
import { useAuthenticatedRouteUser } from "../authenticated-route-user";
import { AccountNotFound } from "./account-not-found";

export function AccountDelegatedSettingsRoute({ page }: { page: DelegatedSettingsPage }) {
  const user = useAuthenticatedRouteUser();

  if (!canAccessAccountSettingsPage(user, page)) {
    return <AccountNotFound />;
  }

  return <AccountSettings activePage={page} user={user} />;
}
