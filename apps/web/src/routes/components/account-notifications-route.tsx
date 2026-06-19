import { AccountSettings } from "@/features/account/AccountSettings";
import { useAuthenticatedRouteUser } from "../authenticated-route-user";

export function AccountNotificationsRoute() {
  const user = useAuthenticatedRouteUser();

  return <AccountSettings activePage="notifications" user={user} />;
}
