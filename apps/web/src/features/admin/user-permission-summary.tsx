import {
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  PERMISSION_CATALOG_BY_PERMISSION,
  SYSTEM_ADMIN_PERMISSION,
  type UserPermission,
} from "@arrtemplar/shared";
import { Badge } from "@/components/ui/badge";

export function UserPermissionSummary({ permissions }: { permissions: readonly UserPermission[] }) {
  if (permissions.includes(SYSTEM_ADMIN_PERMISSION)) {
    return <Badge>Default: admin</Badge>;
  }

  const explicitPermissions = permissions.filter(
    (permission) => !DEFAULT_SIGNED_IN_USER_PERMISSIONS.includes(permission),
  );

  if (explicitPermissions.length === 0) {
    return <Badge variant="secondary">Default user</Badge>;
  }

  const visiblePermissions = explicitPermissions.slice(0, 2);
  const hiddenCount = explicitPermissions.length - visiblePermissions.length;

  return (
    <div className="flex max-w-full flex-wrap gap-1.5">
      <Badge variant="secondary">Default user</Badge>
      {visiblePermissions.map((permission) => (
        <Badge key={permission} title={permission} variant="outline">
          {getPermissionLabel(permission)}
        </Badge>
      ))}
      {hiddenCount > 0 ? <Badge variant="outline">+{hiddenCount} more</Badge> : null}
    </div>
  );
}

function getPermissionLabel(permission: UserPermission): string {
  return PERMISSION_CATALOG_BY_PERMISSION.get(permission)?.label ?? permission;
}
