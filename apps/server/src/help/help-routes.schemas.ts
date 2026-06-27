import {
  HELP_TICKET_ACCEPTED_UPLOAD_MIME_TYPES,
  HELP_TICKET_ID_PATTERN_SOURCE,
  HELP_TICKET_LIMITS,
  HELP_TICKET_MEDIA_KIND_VALUES,
  HELP_TICKET_SCOPE_VALUES,
  HELP_TICKET_SORT_BY_VALUES,
  HELP_TICKET_SORT_ORDER_VALUES,
  HELP_TICKET_STATUS_VALUES,
} from "@arrtemplar/shared";
import { t } from "elysia";
import { apiErrorResponseSchema } from "../auth/auth-routes.schemas";
import { SESSION_COOKIE_NAME } from "../auth/session-token";

const helpTicketStatusSchema = t.Union(
  HELP_TICKET_STATUS_VALUES.map((status) => t.Literal(status)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const helpTicketScopeSchema = t.Union(
  HELP_TICKET_SCOPE_VALUES.map((scope) => t.Literal(scope)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const helpTicketSortBySchema = t.Union(
  HELP_TICKET_SORT_BY_VALUES.map((sortBy) => t.Literal(sortBy)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const helpTicketSortOrderSchema = t.Union(
  HELP_TICKET_SORT_ORDER_VALUES.map((sortOrder) => t.Literal(sortOrder)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);
const helpTicketMediaKindSchema = t.Union(
  HELP_TICKET_MEDIA_KIND_VALUES.map((mediaKind) => t.Literal(mediaKind)) as [
    ReturnType<typeof t.Literal>,
    ...ReturnType<typeof t.Literal>[],
  ],
);

const helpTicketIdSchema = t.String({
  maxLength: 32,
  minLength: 4,
  pattern: HELP_TICKET_ID_PATTERN_SOURCE,
});
const attachmentIdSchema = t.String({ minLength: 1, maxLength: 64 });
const reporterSchema = t.Object({
  id: t.String({ minLength: 1, maxLength: 64 }),
  username: t.String({ minLength: 1, maxLength: 80 }),
});
const helpTicketAttachmentSchema = t.Object({
  id: attachmentIdSchema,
  originalFileName: t.String({ minLength: 1, maxLength: 120 }),
  mediaKind: helpTicketMediaKindSchema,
  mimeType: t.String({ minLength: 1, maxLength: 64 }),
  sizeBytes: t.Number({ minimum: 0 }),
  storedSizeBytes: t.Number({ minimum: 0 }),
  width: t.Union([t.Number({ minimum: 1 }), t.Null()]),
  height: t.Union([t.Number({ minimum: 1 }), t.Null()]),
  createdAt: t.String({ format: "date-time" }),
});
const helpTicketSummarySchema = t.Object({
  id: helpTicketIdSchema,
  title: t.String({ minLength: 1, maxLength: HELP_TICKET_LIMITS.titleMaxLength }),
  status: helpTicketStatusSchema,
  attachmentCount: t.Number({ minimum: 0 }),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
  createdBy: reporterSchema,
});
const helpTicketDetailSchema = t.Object({
  ...helpTicketSummarySchema.properties,
  description: t.String({ minLength: 1, maxLength: HELP_TICKET_LIMITS.descriptionMaxLength }),
  attachments: t.Array(helpTicketAttachmentSchema),
  statusUpdatedAt: t.String({ format: "date-time" }),
  statusUpdatedByUserId: t.Union([t.String({ minLength: 1, maxLength: 64 }), t.Null()]),
});
const helpTicketPaginationSchema = t.Object({
  page: t.Number({ minimum: 1 }),
  pageSize: t.Number({ minimum: 1, maximum: 50 }),
  total: t.Number({ minimum: 0 }),
  totalPages: t.Number({ minimum: 0 }),
});

export const helpTicketCookieSchema = t.Cookie({
  [SESSION_COOKIE_NAME]: t.Optional(t.String()),
});
export const helpTicketListQuerySchema = t.Object({
  scope: t.Optional(helpTicketScopeSchema),
  status: t.Optional(helpTicketStatusSchema),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
  sortBy: t.Optional(helpTicketSortBySchema),
  sortOrder: t.Optional(helpTicketSortOrderSchema),
});
export const createHelpTicketBodySchema = t.Object({
  title: t.String({
    minLength: 1,
    maxLength: HELP_TICKET_LIMITS.titleMaxLength,
    pattern: ".*\\S.*",
  }),
  description: t.String({
    minLength: 1,
    maxLength: HELP_TICKET_LIMITS.descriptionMaxLength,
    pattern: ".*\\S.*",
  }),
  attachments: t.Optional(
    t.Files({
      type: [...HELP_TICKET_ACCEPTED_UPLOAD_MIME_TYPES],
      maxItems: HELP_TICKET_LIMITS.maxAttachmentCount,
      maxSize: HELP_TICKET_LIMITS.maxAttachmentBytes,
    }),
  ),
});
export const helpTicketParamsSchema = t.Object({
  ticketId: helpTicketIdSchema,
});
export const helpTicketAttachmentParamsSchema = t.Object({
  ticketId: helpTicketIdSchema,
  attachmentId: attachmentIdSchema,
});
export const updateHelpTicketStatusRequestSchema = t.Object({
  status: helpTicketStatusSchema,
});

export const helpTicketListResponseSchema = t.Object({
  items: t.Array(helpTicketSummarySchema),
  pagination: helpTicketPaginationSchema,
});
export const helpTicketDetailResponseSchema = t.Object({
  ticket: helpTicketDetailSchema,
});
export const helpTicketStatusResponseSchema = helpTicketDetailResponseSchema;
export const helpTicketRouteErrorResponses = {
  401: apiErrorResponseSchema,
  403: apiErrorResponseSchema,
  404: apiErrorResponseSchema,
  422: apiErrorResponseSchema,
  429: apiErrorResponseSchema,
  500: apiErrorResponseSchema,
  503: apiErrorResponseSchema,
} as const;
