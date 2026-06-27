import type { App } from "@arrtemplar/server";
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  ClearNotificationHistoryResponse,
  CreateNotificationHistoryRequest,
  CreateNotificationHistoryResponse,
  MarkNotificationReadRequest,
  MarkNotificationReadResponse,
  NotificationHistoryListResponse,
  NotificationPreferences,
  PublicUser,
  UpdateNotificationPreferencesRequest,
  UpdateUserProfileRequest,
} from "@arrtemplar/shared";
import type { Treaty } from "@elysia/eden/treaty2";
import { getApiClient, type NotificationHistoryListParams, unwrapData } from "./client";
import {
  normalizeNotificationHistoryItem,
  normalizeNotificationHistoryListResponse,
  normalizeNotificationHistoryQuery,
  normalizeNotificationPreferences,
  normalizePublicUser,
} from "./normalizers";

const api = getApiClient<Treaty.Create<App>>();

export async function getUserProfile(): Promise<PublicUser> {
  const response = unwrapData(await api.api.profile.get(), "Profile request failed.");

  return normalizePublicUser(response.user);
}

export async function updateUserProfile(input: UpdateUserProfileRequest): Promise<PublicUser> {
  const response = unwrapData(await api.api.profile.put(input), "Profile update failed.");

  return normalizePublicUser(response.user);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = unwrapData(
    await api.api.profile.notifications.get(),
    "Notification preferences request failed.",
  );

  return normalizeNotificationPreferences(response.notificationPreferences);
}

export async function updateNotificationPreferences(
  input: UpdateNotificationPreferencesRequest,
): Promise<NotificationPreferences> {
  const response = unwrapData(
    await api.api.profile.notifications.put(input),
    "Notification preferences update failed.",
  );

  return normalizeNotificationPreferences(response.notificationPreferences);
}

export async function listNotificationHistory(
  input: NotificationHistoryListParams = {},
): Promise<NotificationHistoryListResponse> {
  const response = unwrapData(
    await api.api.profile.notifications.history.get({
      query: normalizeNotificationHistoryQuery(input),
    }),
    "Notification history request failed.",
  );

  return normalizeNotificationHistoryListResponse(response);
}

export async function createNotificationHistory(
  input: CreateNotificationHistoryRequest,
): Promise<CreateNotificationHistoryResponse> {
  const response = unwrapData(
    await api.api.profile.notifications.history.post(input),
    "Notification history creation failed.",
  );

  return { notification: normalizeNotificationHistoryItem(response.notification) };
}

export async function markNotificationRead(
  notificationId: string,
): Promise<MarkNotificationReadResponse> {
  const request: MarkNotificationReadRequest = { read: true };
  const response = unwrapData(
    await api.api.profile.notifications.history({ notificationId }).patch(request),
    "Notification history read update failed.",
  );

  return { notification: normalizeNotificationHistoryItem(response.notification) };
}

export async function clearNotificationHistory(): Promise<ClearNotificationHistoryResponse> {
  return unwrapData(
    await api.api.profile.notifications.history.delete(),
    "Notification history clear failed.",
  );
}

export async function changePassword(
  input: ChangePasswordRequest,
): Promise<ChangePasswordResponse> {
  return unwrapData(await api.api.profile.password.put(input), "Password update failed.");
}
