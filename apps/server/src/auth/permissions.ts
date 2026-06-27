import {
  type AuthMethod,
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  isUserPermission,
  normalizePermissionList,
  SYSTEM_ADMIN_PERMISSION,
  USER_PERMISSION_VALUES,
  type UserPermission,
} from "@arrtemplar/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseClient } from "../db/client";
import { type User, userPermissionGrants, users } from "../db/schema";

type DatabaseTransaction = Parameters<Parameters<DatabaseClient["db"]["transaction"]>[0]>[0];
type DatabaseReader = DatabaseClient["db"] | DatabaseTransaction;

function readExplicitPermissionGrantsByUserId(tx: DatabaseReader): Map<string, UserPermission[]> {
  const permissionsByUserId = new Map<string, UserPermission[]>();

  for (const grant of tx
    .select({ permission: userPermissionGrants.permission, userId: userPermissionGrants.userId })
    .from(userPermissionGrants)
    .all()) {
    if (!isUserPermission(grant.permission)) {
      continue;
    }

    permissionsByUserId.set(grant.userId, [
      ...(permissionsByUserId.get(grant.userId) ?? []),
      grant.permission,
    ]);
  }

  for (const [userId, permissions] of permissionsByUserId) {
    permissionsByUserId.set(userId, normalizePermissionList(permissions));
  }

  return permissionsByUserId;
}

export function readEffectivePermissionsByUserId(
  tx: DatabaseReader,
  userRows: readonly User[],
): Map<string, UserPermission[]> {
  const explicitPermissionsByUserId = readExplicitPermissionGrantsByUserId(tx);
  const effectivePermissionsByUserId = new Map<string, UserPermission[]>();

  for (const user of userRows) {
    effectivePermissionsByUserId.set(
      user.id,
      computeEffectivePermissions(explicitPermissionsByUserId.get(user.id) ?? []),
    );
  }

  return effectivePermissionsByUserId;
}

function readExplicitPermissionGrants(tx: DatabaseReader, userId: string): UserPermission[] {
  return normalizePermissionList(
    tx
      .select({ permission: userPermissionGrants.permission })
      .from(userPermissionGrants)
      .where(eq(userPermissionGrants.userId, userId))
      .all()
      .map((grant) => grant.permission)
      .filter(isUserPermission),
  );
}

export function readEffectivePermissions(tx: DatabaseReader, user: User): UserPermission[] {
  return computeEffectivePermissions(readExplicitPermissionGrants(tx, user.id));
}

function computeEffectivePermissions(
  explicitPermissions: readonly UserPermission[],
): UserPermission[] {
  if (explicitPermissions.includes(SYSTEM_ADMIN_PERMISSION)) {
    return [...USER_PERMISSION_VALUES];
  }

  return normalizePermissionList([...DEFAULT_SIGNED_IN_USER_PERMISSIONS, ...explicitPermissions]);
}

export function hasExplicitPermissionGrant(
  tx: DatabaseReader,
  userId: string,
  permission: UserPermission,
): boolean {
  const grant = tx
    .select({ id: userPermissionGrants.id })
    .from(userPermissionGrants)
    .where(
      and(eq(userPermissionGrants.userId, userId), eq(userPermissionGrants.permission, permission)),
    )
    .get();

  return Boolean(grant);
}

export function countActiveSystemAdmins(tx: DatabaseReader): number {
  return countActiveSystemAdminGrants(tx);
}

export function countActiveLocalSystemAdmins(tx: DatabaseReader): number {
  return countActiveSystemAdminGrants(tx, { authMethod: "local" });
}

function countActiveSystemAdminGrants(
  tx: DatabaseReader,
  input: { authMethod?: AuthMethod } = {},
): number {
  const userFilters = [
    eq(userPermissionGrants.permission, SYSTEM_ADMIN_PERMISSION),
    isNull(users.disabledAt),
  ];

  if (input.authMethod) {
    userFilters.push(eq(users.authMethod, input.authMethod));
  }

  return readCountResult(
    tx
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(userPermissionGrants)
      .innerJoin(users, eq(users.id, userPermissionGrants.userId))
      .where(and(...userFilters))
      .get(),
  );
}

export function readCountResult(result: { count: number } | undefined): number {
  return result?.count ?? 0;
}
