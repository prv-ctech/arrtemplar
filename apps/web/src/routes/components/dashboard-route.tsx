import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { useAuthenticatedRouteUser } from "../authenticated-route-user";

export function DashboardRoute() {
  const user = useAuthenticatedRouteUser();

  return <DashboardPage user={user} />;
}
