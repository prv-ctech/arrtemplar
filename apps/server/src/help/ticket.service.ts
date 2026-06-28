import {
  APP_LOG_CATEGORY,
  type ApiErrorResponse,
  type CreateHelpTicketResponse,
  type DeleteHelpTicketResponse,
  HELP_TICKET_ID_PREFIX,
  HELP_TICKET_LIMITS,
  type HelpTicketDetail,
  type HelpTicketDetailResponse,
  type HelpTicketListParams,
  type HelpTicketListResponse,
  type HelpTicketReporter,
  type HelpTicketStatus,
  type HelpTicketSummary,
  hasPermissionGrant,
  type PublicUser,
  type UpdateHelpTicketStatusRequest,
} from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { AuthRequestContext } from "../auth/auth.service";
import type { DatabaseClient } from "../db/client";
import { helpTicketAttachments, helpTickets, type User, users } from "../db/schema";
import type {
  HelpTicketAttachmentService,
  PreparedHelpTicketAttachment,
} from "./attachment.service";

const logger = getLogger([APP_LOG_CATEGORY, "help", "tickets"]);
const maxTicketIdGenerationAttempts = 25;

type HelpTicketServiceResult<T> =
  | { ok: true; body: T }
  | { ok: false; status: 403 | 404 | 409 | 422 | 500 | 503; body: ApiErrorResponse };

type TicketRow = typeof helpTickets.$inferSelect;
type TicketAttachmentRow = typeof helpTicketAttachments.$inferSelect;

export type HelpTicketIdGenerator = () => string;

export type CreateHelpTicketInput = {
  actor: PublicUser;
  attachments: File[];
  context: AuthRequestContext;
  description: string;
  title: string;
};

export class HelpTicketService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly attachmentService: HelpTicketAttachmentService,
    private readonly idGenerator: HelpTicketIdGenerator = createHelpTicketId,
  ) {}

  async createTicket(
    input: CreateHelpTicketInput,
  ): Promise<HelpTicketServiceResult<CreateHelpTicketResponse>> {
    const createInputResult = this.validateCreateTicketInput(input);

    if (!createInputResult.ok) {
      return createInputResult;
    }

    const preparedAttachments = await this.attachmentService.prepareAttachments({
      attachments: input.attachments,
      userId: input.actor.id,
    });

    if (!preparedAttachments.ok) {
      return preparedAttachments;
    }

    return await this.persistCreatedTicket({
      actorPublicUserId: input.actor.id,
      actorUser: createInputResult.actorUser,
      attachments: preparedAttachments.value,
      description: createInputResult.description,
      title: createInputResult.title,
    });
  }

  listTickets(input: {
    actor: PublicUser | null;
    principalKind: "apiKey" | "session";
    query: HelpTicketListParams;
  }): HelpTicketServiceResult<HelpTicketListResponse> {
    const scope = input.principalKind === "apiKey" ? "all" : (input.query.scope ?? "mine");
    const page = Math.max(1, input.query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, input.query.pageSize ?? 20));
    const status = input.query.status ?? null;
    const actorUser = input.actor ? this.readActorUser(input.actor) : null;

    if (input.principalKind === "session" && !actorUser) {
      return { ok: false, status: 403, body: forbiddenError("help:read") };
    }

    if (input.principalKind === "session" && scope === "all" && !canManageAllTickets(input.actor)) {
      return { ok: false, status: 403, body: forbiddenError("help:manage") };
    }

    const whereClause = buildTicketWhereClause({
      actorUserId: scope === "mine" ? (actorUser?.id ?? null) : null,
      status,
    });
    const orderBy =
      input.query.sortOrder === "asc" ? asc(helpTickets.createdAt) : desc(helpTickets.createdAt);
    const rows = this.database.db
      .select()
      .from(helpTickets)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .all();
    const total =
      this.database.db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(helpTickets)
        .where(whereClause)
        .get()?.count ?? 0;
    const summaries = this.toTicketSummaries(rows);

    logger.debug("Listed help tickets for {principalKind} with scope {scope}", {
      principalKind: input.principalKind,
      scope,
      status,
      page,
      pageSize,
      resultCount: summaries.length,
    });

    return {
      ok: true,
      body: {
        items: summaries,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
        },
      },
    };
  }

  getTicket(input: {
    actor: PublicUser | null;
    principalKind: "apiKey" | "session";
    ticketId: string;
  }): HelpTicketServiceResult<HelpTicketDetailResponse> {
    const detailResult = this.readTicketDetailForPermission({
      ...input,
      requiredPermission: "help:read",
    });

    if (!detailResult.ok) {
      return detailResult;
    }

    return { ok: true, body: { ticket: detailResult.detail } };
  }

  updateTicketStatus(input: {
    actor: PublicUser | null;
    principalKind: "apiKey" | "session";
    request: UpdateHelpTicketStatusRequest;
    ticketId: string;
  }): HelpTicketServiceResult<HelpTicketDetailResponse> {
    const detailResult = this.readTicketDetailForPermission({
      ...input,
      requiredPermission: "help:manage",
    });

    if (!detailResult.ok) {
      return detailResult;
    }

    const actorUser = input.actor ? this.readActorUser(input.actor) : null;
    const previousStatus = detailResult.detail.status;
    const nextStatus = input.request.status;
    const now = new Date().toISOString();

    this.database.db
      .update(helpTickets)
      .set({
        status: nextStatus,
        statusUpdatedAt: now,
        statusUpdatedByUserId: actorUser?.id ?? null,
        updatedAt: now,
      })
      .where(eq(helpTickets.id, input.ticketId))
      .run();

    logger.info(
      "Updated help ticket {ticketId} status from {previousStatus} to {nextStatus} by {actorId}",
      {
        ticketId: input.ticketId,
        previousStatus,
        nextStatus,
        actorId: input.actor?.id ?? "api-key",
        principalKind: input.principalKind,
      },
    );

    const updatedDetail = this.readTicketDetail(input.ticketId);

    return updatedDetail
      ? { ok: true, body: { ticket: updatedDetail } }
      : { ok: false, status: 500, body: internalHelpTicketError() };
  }

  async deleteTicket(input: {
    actor: PublicUser | null;
    principalKind: "apiKey" | "session";
    ticketId: string;
  }): Promise<HelpTicketServiceResult<DeleteHelpTicketResponse>> {
    const detailResult = this.readTicketDetailForPermission({
      ...input,
      requiredPermission: "help:manage",
    });

    if (!detailResult.ok) {
      return detailResult;
    }

    this.database.db.delete(helpTickets).where(eq(helpTickets.id, input.ticketId)).run();
    await this.attachmentService.deleteTicketStorage(input.ticketId);

    logger.info("Deleted help ticket {ticketId} by {actorId}", {
      ticketId: input.ticketId,
      actorId: input.actor?.id ?? "api-key",
      principalKind: input.principalKind,
    });

    return { ok: true, body: { deletedId: input.ticketId } };
  }

  async getAttachmentDownload(input: {
    actor: PublicUser | null;
    attachmentId: string;
    principalKind: "apiKey" | "session";
    ticketId: string;
  }): Promise<
    HelpTicketServiceResult<{
      attachment: TicketAttachmentRow;
      file: Bun.BunFile;
    }>
  > {
    const detailResult = this.readTicketDetailForPermission({
      ...input,
      requiredPermission: "help:read",
    });

    if (!detailResult.ok) {
      return detailResult;
    }

    const attachment = this.database.db
      .select()
      .from(helpTicketAttachments)
      .where(
        and(
          eq(helpTicketAttachments.id, input.attachmentId),
          eq(helpTicketAttachments.ticketId, input.ticketId),
        ),
      )
      .get();

    if (!attachment) {
      return { ok: false, status: 404, body: attachmentNotFoundError() };
    }

    const file = await this.attachmentService.readStoredAttachment({
      storedFileName: attachment.storedFileName,
      ticketId: input.ticketId,
    });

    if (!file) {
      return { ok: false, status: 404, body: attachmentNotFoundError() };
    }

    return { ok: true, body: { attachment, file } };
  }

  private readActorUser(actor: PublicUser): User | null {
    return this.database.db.select().from(users).where(eq(users.publicId, actor.id)).get() ?? null;
  }

  private readTicketDetail(ticketId: string): HelpTicketDetail | null {
    const ticket = this.database.db
      .select()
      .from(helpTickets)
      .where(eq(helpTickets.id, ticketId))
      .get();

    if (!ticket) {
      return null;
    }

    const reporterIds = [ticket.createdByUserId, ticket.statusUpdatedByUserId].filter(
      (value): value is string => typeof value === "string",
    );
    const reporterMap = this.readReporterMap(reporterIds);
    const reporter = reporterMap.get(ticket.createdByUserId);
    const statusUpdatedByUserId = ticket.statusUpdatedByUserId
      ? (reporterMap.get(ticket.statusUpdatedByUserId)?.id ?? null)
      : null;

    if (!reporter) {
      return null;
    }

    const attachments = this.database.db
      .select()
      .from(helpTicketAttachments)
      .where(eq(helpTicketAttachments.ticketId, ticket.id))
      .all();

    return {
      ...toTicketSummary(ticket, reporter, attachments.length),
      description: ticket.description,
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        originalFileName: attachment.originalFileName,
        mediaKind: attachment.mediaKind,
        mimeType: attachment.mimeType as PreparedHelpTicketAttachment["mimeType"],
        sizeBytes: attachment.sizeBytes,
        storedSizeBytes: attachment.storedSizeBytes,
        width: attachment.width,
        height: attachment.height,
        createdAt: attachment.createdAt,
      })),
      statusUpdatedAt: ticket.statusUpdatedAt,
      statusUpdatedByUserId,
    };
  }

  private ticketExists(ticketId: string): boolean {
    return Boolean(
      this.database.db
        .select({ id: helpTickets.id })
        .from(helpTickets)
        .where(eq(helpTickets.id, ticketId))
        .get(),
    );
  }

  private toTicketSummaries(rows: TicketRow[]): HelpTicketSummary[] {
    const reporterMap = this.readReporterMap(rows.map((row) => row.createdByUserId));
    const ticketIds = rows.map((row) => row.id);
    const attachments = ticketIds.length
      ? this.database.db
          .select({ id: helpTicketAttachments.id, ticketId: helpTicketAttachments.ticketId })
          .from(helpTicketAttachments)
          .where(inArray(helpTicketAttachments.ticketId, ticketIds))
          .all()
      : [];
    const attachmentCountByTicketId = new Map<string, number>();

    for (const attachment of attachments) {
      attachmentCountByTicketId.set(
        attachment.ticketId,
        (attachmentCountByTicketId.get(attachment.ticketId) ?? 0) + 1,
      );
    }

    return rows
      .map((row) => {
        const reporter = reporterMap.get(row.createdByUserId);

        return reporter
          ? toTicketSummary(row, reporter, attachmentCountByTicketId.get(row.id) ?? 0)
          : null;
      })
      .filter((row): row is HelpTicketSummary => row !== null);
  }

  private readReporterMap(userIds: string[]): Map<string, HelpTicketReporter> {
    if (userIds.length === 0) {
      return new Map();
    }

    return new Map(
      this.database.db
        .select({ id: users.id, publicId: users.publicId, username: users.username })
        .from(users)
        .where(inArray(users.id, [...new Set(userIds)]))
        .all()
        .map((row) => [row.id, { id: row.publicId, username: row.username }]),
    );
  }

  private readTicketDetailForPermission(input: {
    actor: PublicUser | null;
    principalKind: "apiKey" | "session";
    requiredPermission: "help:manage" | "help:read";
    ticketId: string;
  }):
    | { ok: true; detail: HelpTicketDetail }
    | { ok: false; status: 403 | 404; body: ApiErrorResponse } {
    const detail = this.readTicketDetail(input.ticketId);

    if (!detail) {
      return { ok: false, status: 404, body: ticketNotFoundError() };
    }

    if (
      input.principalKind === "session" &&
      !canAccessTicketForPermission(input.actor, detail, input.requiredPermission)
    ) {
      return { ok: false, status: 403, body: forbiddenError(input.requiredPermission) };
    }

    return { ok: true, detail };
  }

  private async persistCreatedTicket(input: {
    actorPublicUserId: string;
    actorUser: User;
    attachments: PreparedHelpTicketAttachment[];
    description: string;
    title: string;
  }): Promise<HelpTicketServiceResult<CreateHelpTicketResponse>> {
    for (let attempt = 1; attempt <= maxTicketIdGenerationAttempts; attempt += 1) {
      const ticketId = this.idGenerator();

      logger.debug("Generated help ticket ID {ticketId} on attempt {attempt}", {
        ticketId,
        attempt,
      });

      if (this.ticketExists(ticketId)) {
        logger.warn("Detected help ticket ID collision on attempt {attempt}; retrying", {
          attempt,
        });
        continue;
      }

      const storeResult = await this.attachmentService.storePreparedAttachments({
        attachments: input.attachments,
        ticketId,
      });

      if (!storeResult.ok) {
        return storeResult;
      }

      const saveResult = await this.saveCreatedTicket({
        actorPublicUserId: input.actorPublicUserId,
        actorUser: input.actorUser,
        attachments: input.attachments,
        attempt,
        description: input.description,
        ticketId,
        title: input.title,
      });

      if (saveResult.ok || saveResult.status !== 409) {
        return saveResult;
      }
    }

    return {
      ok: false,
      status: 409,
      body: ticketIdGenerationFailedError(),
    };
  }

  private async saveCreatedTicket(input: {
    actorPublicUserId: string;
    actorUser: User;
    attachments: PreparedHelpTicketAttachment[];
    attempt: number;
    description: string;
    ticketId: string;
    title: string;
  }): Promise<HelpTicketServiceResult<CreateHelpTicketResponse>> {
    const now = new Date().toISOString();

    try {
      this.database.db.transaction((tx) => {
        tx.insert(helpTickets)
          .values({
            id: input.ticketId,
            createdByUserId: input.actorUser.id,
            title: input.title,
            description: input.description,
            status: "new",
            statusUpdatedAt: now,
            statusUpdatedByUserId: input.actorUser.id,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        if (input.attachments.length > 0) {
          tx.insert(helpTicketAttachments)
            .values(
              input.attachments.map((attachment) =>
                toAttachmentInsertRow(attachment, input.actorUser.id, input.ticketId, now),
              ),
            )
            .run();
        }
      });
    } catch (error) {
      await this.attachmentService.deleteTicketStorage(input.ticketId);

      if (isTicketIdConflict(error)) {
        logger.warn("Detected help ticket ID collision on attempt {attempt}; retrying", {
          attempt: input.attempt,
        });

        return { ok: false, status: 409, body: ticketIdGenerationFailedError() };
      }

      return {
        ok: false,
        status: 500,
        body: internalHelpTicketError(),
      };
    }

    logger.info(
      "Created help ticket {ticketId} for user {userId} with {attachmentCount} attachment(s)",
      {
        ticketId: input.ticketId,
        userId: input.actorPublicUserId,
        attachmentCount: input.attachments.length,
      },
    );

    const detail = this.readTicketDetail(input.ticketId);

    return detail
      ? { ok: true, body: { ticket: detail } }
      : { ok: false, status: 500, body: internalHelpTicketError() };
  }

  private validateCreateTicketInput(
    input: CreateHelpTicketInput,
  ):
    | { ok: true; actorUser: User; description: string; title: string }
    | { ok: false; status: 403 | 422; body: ApiErrorResponse } {
    const actorUser = this.readActorUser(input.actor);

    if (!actorUser) {
      return { ok: false, status: 403, body: forbiddenError("help:create") };
    }

    const title = input.title.trim();
    const description = input.description.trim();

    if (!title || title.length > HELP_TICKET_LIMITS.titleMaxLength) {
      return { ok: false, status: 422, body: invalidTextFieldError("title") };
    }

    if (!description || description.length > HELP_TICKET_LIMITS.descriptionMaxLength) {
      return { ok: false, status: 422, body: invalidTextFieldError("description") };
    }

    return { ok: true, actorUser, description, title };
  }
}

function toAttachmentInsertRow(
  attachment: PreparedHelpTicketAttachment,
  uploadedByUserId: string,
  ticketId: string,
  createdAt: string,
): typeof helpTicketAttachments.$inferInsert {
  return {
    id: attachment.id,
    ticketId,
    uploadedByUserId,
    originalFileName: attachment.originalFileName,
    storedFileName: attachment.storedFileName,
    mediaKind: attachment.mediaKind,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    storedSizeBytes: attachment.storedSizeBytes,
    width: attachment.width,
    height: attachment.height,
    sha256: attachment.sha256,
    scanStatus: attachment.scanStatus,
    scanEngine: attachment.scanEngine,
    scanResult: attachment.scanResult,
    createdAt,
  };
}

function toTicketSummary(
  ticket: TicketRow,
  reporter: HelpTicketReporter,
  attachmentCount: number,
): HelpTicketSummary {
  return {
    id: ticket.id,
    title: ticket.title,
    status: ticket.status as HelpTicketStatus,
    attachmentCount,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    createdBy: reporter,
  };
}

function buildTicketWhereClause(input: {
  actorUserId: string | null;
  status: HelpTicketStatus | null;
}) {
  const filters = [];

  if (input.actorUserId) {
    filters.push(eq(helpTickets.createdByUserId, input.actorUserId));
  }

  if (input.status) {
    filters.push(eq(helpTickets.status, input.status));
  }

  return filters.length === 0 ? undefined : and(...filters);
}

function canManageAllTickets(actor: PublicUser | null): boolean {
  return Boolean(actor && hasPermissionGrant(actor.permissions, "help:manage"));
}

function canReadTicket(actor: PublicUser | null, ticketOwnerPublicUserId: string): boolean {
  return Boolean(
    actor &&
      (ticketOwnerPublicUserId === actor.id ||
        hasPermissionGrant(actor.permissions, "help:manage")),
  );
}

function canAccessTicketForPermission(
  actor: PublicUser | null,
  detail: HelpTicketDetail,
  permission: "help:manage" | "help:read",
): boolean {
  return permission === "help:manage"
    ? canManageAllTickets(actor)
    : canReadTicket(actor, detail.createdBy.id);
}

function createHelpTicketId(): string {
  return `${HELP_TICKET_ID_PREFIX}${generateRandomDigits(7)}`;
}

function generateRandomDigits(length: number): string {
  let digits = "";
  const buffer = new Uint8Array(length * 2);

  while (digits.length < length) {
    crypto.getRandomValues(buffer);

    for (const byte of buffer) {
      if (byte >= 250) {
        continue;
      }

      digits += String(byte % 10);

      if (digits.length === length) {
        break;
      }
    }
  }

  return digits;
}

function isTicketIdConflict(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("UNIQUE constraint failed: help_tickets.id")
  );
}

function forbiddenError(permission: string): ApiErrorResponse {
  return {
    error: {
      code: "FORBIDDEN",
      message: `${permission} permission is required.`,
    },
  };
}

function invalidTextFieldError(field: "description" | "title"): ApiErrorResponse {
  const message = `${field === "title" ? "Title" : "Description"} is invalid.`;

  return {
    error: {
      code: "HELP_TICKET_INVALID_INPUT",
      message,
      fieldErrors: [
        {
          field,
          code: "HELP_TICKET_INVALID_INPUT",
          message,
        },
      ],
    },
  };
}

function ticketNotFoundError(): ApiErrorResponse {
  return {
    error: {
      code: "HELP_TICKET_NOT_FOUND",
      message: "Help ticket was not found.",
    },
  };
}

function attachmentNotFoundError(): ApiErrorResponse {
  return {
    error: {
      code: "HELP_ATTACHMENT_NOT_FOUND",
      message: "Help attachment was not found.",
    },
  };
}

function ticketIdGenerationFailedError(): ApiErrorResponse {
  return {
    error: {
      code: "HELP_TICKET_ID_GENERATION_FAILED",
      message: "Help ticket ID generation failed.",
    },
  };
}

function internalHelpTicketError(): ApiErrorResponse {
  return {
    error: {
      code: "HELP_TICKET_INTERNAL_ERROR",
      message: "Help ticket operation failed.",
    },
  };
}
