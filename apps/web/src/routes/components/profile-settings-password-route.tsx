import { AccountSettings } from "@/features/account/AccountSettings";
import { useAuthenticatedRouteUser } from "../authenticated-route-user";

export function ProfileSettingsPasswordRoute() {
  const user = useAuthenticatedRouteUser();

  return <AccountSettings activePage="password" user={user} />;
}
