import { Navigate } from "@tanstack/react-router";

export function AdminIndexRedirect() {
  return <Navigate to="/admin/general" replace />;
}
