import {
  type ApiErrorResponse,
  type ClearNotificationHistoryResponse,
  type CreateNotificationHistoryRequest,
  type CreateNotificationHistoryResponse,
  isToastNotificationId,
  type MarkNotificationReadResponse,
  type NotificationHistoryItem,
  type NotificationHistoryListResponse,
  type NotificationPreferences,
  TOAST_NOTIFICATION_EVENTS,
  type ToastNotificationId,
  type UpdateNotificationPreferencesRequest,
} from "@arrtemplar/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { writeAuditLog } from "../audit/audit-log";
import type { DatabaseClient } from "../db/client";
import {
  type NewNotificationHistory,
  type NotificationHistory,
  notificationHistory,
  type sessions,
  type User,
} from "../db/schema";
import { toNotificationHistoryItem, toNotificationPreferences } from "./user-mappers";

type AuthRequestContext = {
  ipAddress: string | null;
  path: string;
  userAgent: string | null;
};

type DatabaseTransaction = Parameters<Parameters<DatabaseClient["db"]["transaction"]>[0]>[0];
type DatabaseReader = DatabaseClient["db"] | DatabaseTransaction;
type CurrentSession = { session: typeof sessions.$inferSelect; user: User };
type CurrentUserUpdateValues = Partial<
  Pick<
    User,
    | "avatarId"
    | "bannerId"
    | "email"
    | "toastNotificationFrequency"
    | "toastNotificationsEnabled"
    | "updatedAt"
    | "username"
  >
>;

type NotificationPreferencesSuccess = {
  ok: true;
  notificationPreferences: NotificationPreferences;
};

type NotificationPreferencesFailure = {
  ok: false;
  status: 401;
  body: ApiErrorResponse;
};

export type NotificationPreferencesResult =
  | NotificationPreferencesSuccess
  | NotificationPreferencesFailure;

type NotificationHistoryAuthFailure = {
  ok: false;
  status: 401;
  body: ApiErrorResponse;
};

type NotificationHistoryCreateFailure =
  | NotificationHistoryAuthFailure
  | {
      ok: false;
      status: 422;
      body: ApiErrorResponse;
    };

type NotificationHistoryReadFailure =
  | NotificationHistoryAuthFailure
  | {
      ok: false;
      status: 404;
      body: ApiErrorResponse;
    };

type NotificationHistoryListSuccess = {
  ok: true;
  body: NotificationHistoryListResponse;
};

type CreateNotificationHistorySuccess = {
  ok: true;
  body: CreateNotificationHistoryResponse;
};

type MarkNotificationReadSuccess = {
  ok: true;
  body: MarkNotificationReadResponse;
};

type ClearNotificationHistorySuccess = {
  ok: true;
  body: ClearNotificationHistoryResponse;
};

export type NotificationHistoryListResult =
  | NotificationHistoryListSuccess
  | NotificationHistoryAuthFailure;
export type CreateNotificationHistoryResult =
  | CreateNotificationHistorySuccess
  | NotificationHistoryCreateFailure;
export type MarkNotificationReadResult =
  | MarkNotificationReadSuccess
  | NotificationHistoryReadFailure;
export type ClearNotificationHistoryResult =
  | ClearNotificationHistorySuccess
  | NotificationHistoryAuthFailure;

const unauthenticatedError: ApiErrorResponse = {
  error: {
    code: "UNAUTHENTICATED",
    message: "Authentication is required.",
  },
};

const invalidNotificationHistoryInputError: ApiErrorResponse = {
  error: {
    code: "INVALID_NOTIFICATION_HISTORY_INPUT",
    message: "Notification history input is invalid.",
  },
};

const notificationHistoryNotFoundError: ApiErrorResponse = {
  error: {
    code: "NOTIFICATION_NOT_FOUND",
    message: "Notification history item was not found.",
  },
};

const notificationHistoryTitleMaxLength = 160;
const notificationHistoryDescriptionMaxLength = 500;

export class NotificationHistoryService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly findSession: (sessionToken: string | null) => CurrentSession | null,
    private readonly updateCurrentUser: (
      userId: string,
      values: CurrentUserUpdateValues,
    ) => User | undefined,
  ) {}

  getNotificationPreferences(sessionToken: string | null): NotificationPreferencesResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    return {
      ok: true,
      notificationPreferences: toNotificationPreferences(currentSession.user),
    };
  }

  updateNotificationPreferences(
    sessionToken: string | null,
    input: UpdateNotificationPreferencesRequest,
    context: AuthRequestContext,
  ): NotificationPreferencesResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const now = new Date().toISOString();

    const updatedUser = this.updateCurrentUser(currentSession.user.id, {
      toastNotificationsEnabled: input.toastsEnabled,
      toastNotificationFrequency: input.frequency,
      updatedAt: now,
    });

    if (!updatedUser) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const notificationPreferences = toNotificationPreferences(updatedUser);

    writeAuditLog(this.database.db, {
      action: "profile.notifications.updated",
      actorUserId: currentSession.user.id,
      targetType: "user",
      targetId: currentSession.user.id,
      metadata: notificationPreferences,
      ipAddress: context.ipAddress,
    });

    return { ok: true, notificationPreferences };
  }

  listNotificationHistory(
    sessionToken: string | null,
    input: { page?: number; pageSize?: number } = {},
  ): NotificationHistoryListResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const page = normalizeNotificationHistoryPage(input.page);
    const pageSize = normalizeNotificationHistoryPageSize(input.pageSize);
    const totalItems = countNotificationHistoryRows(this.database.db, currentSession.user.id);
    const unreadCount = countNotificationHistoryRows(this.database.db, currentSession.user.id, {
      unreadOnly: true,
    });
    const rows = this.database.db
      .select()
      .from(notificationHistory)
      .where(eq(notificationHistory.userId, currentSession.user.id))
      .orderBy(desc(notificationHistory.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();

    return {
      ok: true,
      body: {
        notifications: rows.map(toNotificationHistoryItem),
        unreadCount,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.ceil(totalItems / pageSize),
        },
      },
    };
  }

  createNotificationHistory(
    sessionToken: string | null,
    input: CreateNotificationHistoryRequest,
  ): CreateNotificationHistoryResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    if (!isToastNotificationId(input.eventId)) {
      return { ok: false, status: 422, body: invalidNotificationHistoryInputError };
    }

    const title = normalizeNotificationHistoryText(input.title, notificationHistoryTitleMaxLength);

    if (!title) {
      return { ok: false, status: 422, body: invalidNotificationHistoryInputError };
    }

    const description = normalizeOptionalNotificationHistoryText(
      input.description,
      notificationHistoryDescriptionMaxLength,
    );

    return {
      ok: true,
      body: {
        notification: this.insertNotificationHistoryItem({
          userId: currentSession.user.id,
          eventId: input.eventId,
          title,
          description,
        }),
      },
    };
  }

  markNotificationHistoryRead(
    sessionToken: string | null,
    notificationId: string,
  ): MarkNotificationReadResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    const existingNotification = readNotificationHistoryItem(
      this.database.db,
      currentSession.user.id,
      notificationId,
    );

    if (!existingNotification) {
      return { ok: false, status: 404, body: notificationHistoryNotFoundError };
    }

    if (!existingNotification.readAt) {
      this.database.db
        .update(notificationHistory)
        .set({ readAt: new Date().toISOString() })
        .where(
          and(
            eq(notificationHistory.id, notificationId),
            eq(notificationHistory.userId, currentSession.user.id),
          ),
        )
        .run();
    }

    const notification = readNotificationHistoryItem(
      this.database.db,
      currentSession.user.id,
      notificationId,
    );

    if (!notification) {
      return { ok: false, status: 404, body: notificationHistoryNotFoundError };
    }

    return { ok: true, body: { notification: toNotificationHistoryItem(notification) } };
  }

  clearNotificationHistory(sessionToken: string | null): ClearNotificationHistoryResult {
    const currentSession = this.findSession(sessionToken);

    if (!currentSession) {
      return { ok: false, status: 401, body: unauthenticatedError };
    }

    return this.database.db.transaction((tx) => {
      const deletedCount = countNotificationHistoryRows(tx, currentSession.user.id);

      tx.delete(notificationHistory)
        .where(eq(notificationHistory.userId, currentSession.user.id))
        .run();

      return { ok: true, body: { status: "ok", deletedCount } };
    });
  }

  insertNotificationHistoryItem(input: {
    description: string | null;
    eventId: ToastNotificationId;
    title: string;
    userId: string;
  }): NotificationHistoryItem {
    const classification = TOAST_NOTIFICATION_EVENTS[input.eventId];
    const now = new Date().toISOString();
    const notificationId = Bun.randomUUIDv7();
    const notification = {
      id: notificationId,
      userId: input.userId,
      eventId: input.eventId,
      title: input.title,
      description: input.description,
      severity: classification.severity,
      importance: classification.importance,
      readAt: null,
      createdAt: now,
    } satisfies NewNotificationHistory;

    this.database.db.insert(notificationHistory).values(notification).run();

    return toNotificationHistoryItem(notification);
  }

  tryInsertNotificationHistoryItem(input: {
    description: string | null;
    eventId: ToastNotificationId;
    title: string;
    userId: string;
  }): boolean {
    try {
      this.insertNotificationHistoryItem(input);
      return true;
    } catch {
      return false;
    }
  }
}

function readNotificationHistoryItem(
  tx: DatabaseReader,
  userId: string,
  notificationId: string,
): NotificationHistory | undefined {
  return tx
    .select()
    .from(notificationHistory)
    .where(and(eq(notificationHistory.id, notificationId), eq(notificationHistory.userId, userId)))
    .get();
}

function countNotificationHistoryRows(
  tx: DatabaseReader,
  userId: string,
  options: { unreadOnly?: boolean } = {},
): number {
  const result = tx
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(notificationHistory)
    .where(
      options.unreadOnly
        ? and(eq(notificationHistory.userId, userId), isNull(notificationHistory.readAt))
        : eq(notificationHistory.userId, userId),
    )
    .get();

  return result?.count ?? 0;
}

function normalizeNotificationHistoryPage(page: number | undefined): number {
  if (!page || !Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

function normalizeNotificationHistoryPageSize(pageSize: number | undefined): number {
  if (!pageSize || !Number.isInteger(pageSize) || pageSize < 1) {
    return 25;
  }

  return Math.min(pageSize, 50);
}

function normalizeNotificationHistoryText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function normalizeOptionalNotificationHistoryText(
  value: string | undefined,
  maxLength: number,
): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeNotificationHistoryText(value, maxLength);

  return normalized || null;
}
