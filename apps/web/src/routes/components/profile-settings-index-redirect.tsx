import { Navigate } from "@tanstack/react-router";

export function ProfileSettingsIndexRedirect() {
  return <Navigate replace to="/profile/settings/main" />;
}
