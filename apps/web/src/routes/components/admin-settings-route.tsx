import { AdminSettings, type AdminSettingsPage } from "@/features/admin/AdminSettings";

export function AdminSettingsRoute({ page }: { page: AdminSettingsPage }) {
  return <AdminSettings activePage={page} />;
}
