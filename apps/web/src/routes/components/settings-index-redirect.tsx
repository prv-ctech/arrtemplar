import { Navigate } from "@tanstack/react-router";

export function SettingsIndexRedirect() {
  return <Navigate replace to="/settings/about" />;
}
