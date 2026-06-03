import { AccountSettings } from "@/features/account/AccountSettings";
import { useAuthenticatedRouteUser } from "../authenticated-route-user";

export function AccountProfileRoute() {
  const user = useAuthenticatedRouteUser();

  return <AccountSettings activePage="profile" user={user} />;
}
