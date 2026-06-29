import {
  type CreateHelpTicketInput,
  type DeleteHelpTicketResponse,
  type HelpTicketDetail,
  type HelpTicketListParams,
  type HelpTicketListResponse,
  isHelpTicketId,
  type UpdateHelpTicketStatusRequest,
} from "@arrtemplar/shared";
import {
  createApiClientErrorFromResponse,
  createApiRequestHeaders,
  readJsonResponse,
  requestApiJson,
  resolveApiRequestUrl,
} from "./client";
import {
  type NormalizedHelpTicketListParams,
  normalizeHelpTicketDetailResponse,
  normalizeHelpTicketListParams,
  normalizeHelpTicketListResponse,
} from "./normalizers";

export async function listHelpTickets(
  params: HelpTicketListParams = {},
): Promise<HelpTicketListResponse> {
  const normalizedParams = normalizeHelpTicketListParams(params);
  const searchParams = createHelpTicketSearchParams(normalizedParams);

  const response = await requestApiJson({
    fallback: "Help ticket list request failed.",
    method: "GET",
    path: `/api/help/tickets?${searchParams.toString()}`,
  });

  return normalizeHelpTicketListResponse(response);
}

export async function createHelpTicket(
  input: CreateHelpTicketInput & { attachments: File[] },
): Promise<HelpTicketDetail> {
  const form = new FormData();
  const requestHeaders = createApiRequestHeaders("POST") ?? {};

  form.set("title", input.title);
  form.set("description", input.description);

  for (const attachment of input.attachments) {
    form.append("attachments", attachment);
  }

  const response = await fetch(resolveApiRequestUrl("/api/help/tickets"), {
    method: "POST",
    credentials: "include",
    headers: requestHeaders,
    body: form,
  });

  if (!response.ok) {
    throw await createApiClientErrorFromResponse(response, "Help ticket create failed.");
  }

  return normalizeHelpTicketDetailResponse(await readJsonResponse(response)).ticket;
}

export async function getHelpTicket(ticketId: string): Promise<HelpTicketDetail> {
  const response = await requestApiJson({
    fallback: "Help ticket request failed.",
    method: "GET",
    path: `/api/help/tickets/${encodeURIComponent(ticketId)}`,
  });

  return normalizeHelpTicketDetailResponse(response).ticket;
}

export async function updateHelpTicketStatus(
  ticketId: string,
  input: UpdateHelpTicketStatusRequest,
): Promise<HelpTicketDetail> {
  const response = await requestApiJson({
    body: input,
    fallback: "Help ticket status update failed.",
    method: "PATCH",
    path: `/api/help/tickets/${encodeURIComponent(ticketId)}/status`,
  });

  return normalizeHelpTicketDetailResponse(response).ticket;
}

export async function deleteHelpTicket(ticketId: string): Promise<DeleteHelpTicketResponse> {
  const response = await requestApiJson({
    fallback: "Help ticket delete failed.",
    method: "DELETE",
    path: `/api/help/tickets/${encodeURIComponent(ticketId)}`,
  });

  return normalizeDeleteHelpTicketResponse(response);
}

export function getHelpTicketAttachmentUrl(ticketId: string, attachmentId: string): string {
  return resolveApiRequestUrl(
    `/api/help/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
}

function normalizeDeleteHelpTicketResponse(value: unknown): DeleteHelpTicketResponse {
  if (!value || typeof value !== "object") {
    throw new Error("Help ticket delete response was invalid.");
  }

  const deletedId = (value as { deletedId?: unknown }).deletedId;

  if (!isHelpTicketId(deletedId)) {
    throw new Error("Help ticket delete response was invalid.");
  }

  return { deletedId };
}

function createHelpTicketSearchParams(params: NormalizedHelpTicketListParams): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set("page", String(params.page));
  searchParams.set("pageSize", String(params.pageSize));
  searchParams.set("scope", params.scope);
  searchParams.set("sortBy", params.sortBy);
  searchParams.set("sortOrder", params.sortOrder);

  if (params.status) {
    searchParams.set("status", params.status);
  }

  return searchParams;
}
