import { DEFAULT_SIGNED_IN_USER_PERMISSIONS, type UserPermission } from "@arrtemplar/shared";

export function togglePermissionSelection(
  current: ReadonlySet<UserPermission>,
  permission: UserPermission,
): Set<UserPermission> {
  const next = new Set(current);

  if (next.has(permission)) {
    next.delete(permission);
  } else {
    next.add(permission);
  }

  return next;
}

export function getExplicitPermissionSet(
  permissions: readonly UserPermission[],
): Set<UserPermission> {
  return new Set(
    permissions.filter((permission) => !DEFAULT_SIGNED_IN_USER_PERMISSIONS.includes(permission)),
  );
}
