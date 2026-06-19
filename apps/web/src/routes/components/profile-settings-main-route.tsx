import { AccountSettings } from "@/features/account/AccountSettings";
import { useAuthenticatedRouteUser } from "../authenticated-route-user";

export function ProfileSettingsMainRoute() {
  const user = useAuthenticatedRouteUser();

  return <AccountSettings activePage="main" user={user} />;
}
