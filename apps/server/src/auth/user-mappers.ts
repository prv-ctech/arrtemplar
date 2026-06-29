import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  isProfileAvatarId,
  isProfileBannerId,
  type ManagedUserProfile,
  type ManagedUserSummary,
  NOTIFICATION_FREQUENCY_VALUES,
  type NotificationFrequency,
  type NotificationHistoryItem,
  type NotificationPreferences,
  type PublicUser,
  type AuthIdentity as SharedAuthIdentity,
  type UserPermission,
} from "@arrtemplar/shared";
import { eq } from "drizzle-orm";
import type { DatabaseClient } from "../db/client";
import {
  authProviders,
  type NotificationHistory,
  type AuthIdentity as StoredAuthIdentity,
  type User,
} from "../db/schema";

type DatabaseTransaction = Parameters<Parameters<DatabaseClient["db"]["transaction"]>[0]>[0];
type DatabaseReader = DatabaseClient["db"] | DatabaseTransaction;

export function toPublicUser(user: User, permissions: UserPermission[]): PublicUser {
  return {
    id: user.publicId,
    username: user.username,
    email: user.email,
    avatarId: isProfileAvatarId(user.avatarId) ? user.avatarId : DEFAULT_PROFILE_AVATAR_ID,
    bannerId: isProfileBannerId(user.bannerId) ? user.bannerId : DEFAULT_PROFILE_BANNER_ID,
    notificationPreferences: toNotificationPreferences(user),
    permissions,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export function toManagedUserSummary(
  user: User,
  permissions: UserPermission[],
  options: { includeAuthMethod?: boolean } = {},
): ManagedUserSummary {
  return {
    id: user.publicId,
    username: user.username,
    ...(options.includeAuthMethod ? { authMethod: user.authMethod } : {}),
    disabledAt: user.disabledAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    permissions,
  };
}

export function toManagedUserProfile(
  user: User,
  permissions: UserPermission[],
): ManagedUserProfile {
  return {
    ...toManagedUserSummary(user, permissions),
    email: user.email,
    avatarId: isProfileAvatarId(user.avatarId) ? user.avatarId : DEFAULT_PROFILE_AVATAR_ID,
    bannerId: isProfileBannerId(user.bannerId) ? user.bannerId : DEFAULT_PROFILE_BANNER_ID,
    lastLoginAt: user.lastLoginAt,
  };
}

export function toNotificationPreferences(user: User): NotificationPreferences {
  return {
    toastsEnabled: user.toastNotificationsEnabled,
    frequency: isNotificationFrequency(user.toastNotificationFrequency)
      ? user.toastNotificationFrequency
      : DEFAULT_NOTIFICATION_PREFERENCES.frequency,
  };
}

export function toNotificationHistoryItem(row: NotificationHistory): NotificationHistoryItem {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title,
    description: row.description,
    severity: row.severity,
    importance: row.importance,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export function toSharedAuthIdentity(
  identity: StoredAuthIdentity,
  providerKind: SharedAuthIdentity["providerKind"] = "custom",
): SharedAuthIdentity {
  return {
    id: identity.id,
    provider: identity.provider,
    providerKind,
    issuer: identity.issuer,
    subjectPreview: createShortSubject(identity.subject),
    displayName: createIdentityDisplayName(identity),
    preferredUsername: identity.preferredUsername,
    name: identity.name,
    email: identity.email,
    createdAt: identity.createdAt,
  };
}

export function readProviderKind(
  tx: DatabaseReader,
  provider: StoredAuthIdentity["provider"],
): SharedAuthIdentity["providerKind"] {
  return (
    tx
      .select({ providerKind: authProviders.providerKind })
      .from(authProviders)
      .where(eq(authProviders.slug, provider))
      .get()?.providerKind ?? "custom"
  );
}

function createIdentityDisplayName(identity: StoredAuthIdentity): string {
  return (
    identity.preferredUsername ??
    identity.name ??
    identity.email ??
    createShortSubject(identity.subject)
  );
}

function createShortSubject(subject: string): string {
  return subject.length > 12 ? `${subject.slice(0, 6)}…${subject.slice(-4)}` : subject;
}

function isNotificationFrequency(value: string): value is NotificationFrequency {
  return NOTIFICATION_FREQUENCY_VALUES.some((frequency) => frequency === value);
}
