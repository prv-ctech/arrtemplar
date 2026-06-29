import { Navigate, useParams } from "@tanstack/react-router";
import { useAuthenticatedRouteUser } from "../authenticated-route-user";

export function ManagedProfileSettingsIndexRedirect() {
  const actor = useAuthenticatedRouteUser();
  const { publicUserId } = useParams({ from: "/profile/$publicUserId/settings" });

  if (publicUserId === actor.id) {
    return <Navigate replace to="/profile/settings/main" />;
  }

  return <Navigate replace params={{ publicUserId }} to="/profile/$publicUserId/settings/main" />;
}
