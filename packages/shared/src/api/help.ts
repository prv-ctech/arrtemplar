export const HELP_TICKET_STATUS_VALUES = ["new", "in_progress", "completed"] as const;

export type HelpTicketStatus = (typeof HELP_TICKET_STATUS_VALUES)[number];

export const HELP_TICKET_SCOPE_VALUES = ["mine", "all"] as const;

export type HelpTicketScope = (typeof HELP_TICKET_SCOPE_VALUES)[number];

export const HELP_TICKET_SORT_BY_VALUES = ["createdAt"] as const;

export type HelpTicketSortBy = (typeof HELP_TICKET_SORT_BY_VALUES)[number];

export const HELP_TICKET_SORT_ORDER_VALUES = ["asc", "desc"] as const;

export type HelpTicketSortOrder = (typeof HELP_TICKET_SORT_ORDER_VALUES)[number];

export const HELP_TICKET_MEDIA_KIND_VALUES = ["image", "video"] as const;

export type HelpTicketMediaKind = (typeof HELP_TICKET_MEDIA_KIND_VALUES)[number];

export const HELP_TICKET_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const HELP_TICKET_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

export const HELP_TICKET_ACCEPTED_UPLOAD_MIME_TYPES = [
  ...HELP_TICKET_IMAGE_MIME_TYPES,
  ...HELP_TICKET_VIDEO_MIME_TYPES,
] as const;

export type HelpTicketAcceptedUploadMimeType =
  (typeof HELP_TICKET_ACCEPTED_UPLOAD_MIME_TYPES)[number];

export const HELP_TICKET_ACCEPTED_UPLOAD_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
] as const;

export const HELP_TICKET_ID_PREFIX = "arr" as const;
export const HELP_TICKET_ID_PATTERN_SOURCE = "^arr[0-9]+$";
export const HELP_TICKET_ID_PATTERN = new RegExp(HELP_TICKET_ID_PATTERN_SOURCE);

export const HELP_TICKET_LIMITS = {
  titleMaxLength: 120,
  descriptionMaxLength: 5_000,
  maxAttachmentCount: 5,
  maxAttachmentBytes: 25 * 1024 * 1024,
  maxImagePixels: 40_000_000,
} as const;

export const HELP_TICKET_API_ROUTES = {
  collection: "/api/help/tickets",
  detail: "/api/help/tickets/:ticketId",
  status: "/api/help/tickets/:ticketId/status",
  attachment: "/api/help/tickets/:ticketId/attachments/:attachmentId",
} as const;

export type HelpTicketReporter = {
  id: string;
  username: string;
};

export type HelpTicketAttachment = {
  id: string;
  originalFileName: string;
  mediaKind: HelpTicketMediaKind;
  mimeType: HelpTicketAcceptedUploadMimeType;
  sizeBytes: number;
  storedSizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export type HelpTicketSummary = {
  id: string;
  title: string;
  status: HelpTicketStatus;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: HelpTicketReporter;
};

export type HelpTicketDetail = HelpTicketSummary & {
  description: string;
  attachments: HelpTicketAttachment[];
  statusUpdatedAt: string;
  statusUpdatedByUserId: string | null;
};

export type HelpTicketListPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type HelpTicketListParams = {
  page?: number;
  pageSize?: number;
  scope?: HelpTicketScope;
  sortBy?: HelpTicketSortBy;
  sortOrder?: HelpTicketSortOrder;
  status?: HelpTicketStatus;
};

export type CreateHelpTicketInput = {
  title: string;
  description: string;
};

export type HelpTicketListResponse = {
  items: HelpTicketSummary[];
  pagination: HelpTicketListPagination;
};

export type HelpTicketDetailResponse = {
  ticket: HelpTicketDetail;
};

export type CreateHelpTicketResponse = {
  ticket: HelpTicketDetail;
};

export type UpdateHelpTicketStatusRequest = {
  status: HelpTicketStatus;
};

export function isHelpTicketId(value: unknown): value is string {
  return typeof value === "string" && HELP_TICKET_ID_PATTERN.test(value);
}
