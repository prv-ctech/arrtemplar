import type { HelpTicketListParams, PublicUser, UpdateHelpTicketStatusRequest } from "@arrtemplar/shared";
import { Elysia } from "elysia";
import { ApiKeyService } from "../auth/api-key.service";
import { AuthService } from "../auth/auth.service";
import { resolveRoutePrincipal } from "../auth/route-principal";
import { createRequestContext } from "../auth/routes";
import { SESSION_COOKIE_NAME } from "../auth/session-token";
import type { HelpTicketScanMode } from "../config/env";
import type { DatabaseClient } from "../db/client";
import { HelpTicketAttachmentService } from "./attachment.service";
import {
  createHelpTicketBodySchema,
  helpTicketAttachmentParamsSchema,
  helpTicketCookieSchema,
  helpTicketDetailResponseSchema,
  helpTicketListQuerySchema,
  helpTicketListResponseSchema,
  helpTicketParamsSchema,
  helpTicketRouteErrorResponses,
  helpTicketStatusResponseSchema,
  updateHelpTicketStatusRequestSchema,
} from "./help-routes.schemas";
import { HelpTicketScannerService, type HelpTicketScannerServiceOptions } from "./scanner.service";
import { type HelpTicketIdGenerator, HelpTicketService } from "./ticket.service";

export type CreateHelpRoutesOptions = {
  database: DatabaseClient;
  idGenerator?: HelpTicketIdGenerator;
  scannerOptions?: Partial<HelpTicketScannerServiceOptions>;
  scannerService?: HelpTicketScannerService;
  scanMode: HelpTicketScanMode;
  storageRoot: string;
};

type StatusHandler = (...args: unknown[]) => unknown;

export function createHelpRoutes(options: CreateHelpRoutesOptions) {
  const authService = new AuthService(options.database);
  const apiKeyService = new ApiKeyService(options.database);
  const scannerService =
    options.scannerService ??
    new HelpTicketScannerService({
      mode: options.scanMode,
      ...(options.scannerOptions?.runCommand
        ? { runCommand: options.scannerOptions.runCommand }
        : {}),
    });
  const attachmentService = new HelpTicketAttachmentService(options.storageRoot, scannerService);
  const ticketService = new HelpTicketService(
    options.database,
    attachmentService,
    options.idGenerator,
  );

  return new Elysia({ prefix: "/api/help" })
    .get(
      "/tickets",
      ({ cookie, query, request, server, status }) => {
        return handleHelpRoute(
          {
            apiKeyService,
            authService,
            cookieValue: cookie[SESSION_COOKIE_NAME]?.value,
            request,
            requiredPermission: "help:read",
            server,
          },
          status as StatusHandler,
          (access) =>
            responseOrStatus(
              ticketService.listTickets({
                actor: access.actor,
                principalKind: access.principalKind,
                query: query as HelpTicketListParams,
              }),
              status as StatusHandler,
            ),
        ) as never;
      },
      {
        cookie: helpTicketCookieSchema,
        query: helpTicketListQuerySchema,
        response: {
          200: helpTicketListResponseSchema,
          ...helpTicketRouteErrorResponses,
        },
        detail: {
          summary: "List help tickets",
          description: "Lists help tickets for the signed-in user or for full-authority API clients.",
          tags: ["Help"],
        },
      },
    )
    .post(
      "/tickets",
      async ({ body, cookie, request, server, status }) => {
        const permissionResult = authService.requirePermission(
          readSessionToken(cookie[SESSION_COOKIE_NAME]?.value),
          "help:create",
        );

        if (!permissionResult.ok) {
          return (status as StatusHandler)(permissionResult.status, permissionResult.body) as never;
        }

        const attachments = Array.isArray(body.attachments)
          ? body.attachments
          : body.attachments
            ? [body.attachments]
            : [];

        return responseOrStatus(
          await ticketService.createTicket({
            actor: permissionResult.user,
            attachments,
            context: createRequestContext(request, server),
            description: body.description,
            title: body.title,
          }),
          status as StatusHandler,
        ) as never;
      },
      {
        body: createHelpTicketBodySchema,
        cookie: helpTicketCookieSchema,
        response: {
          200: helpTicketDetailResponseSchema,
          ...helpTicketRouteErrorResponses,
        },
        detail: {
          summary: "Create help ticket",
          description: "Creates a help ticket for the signed-in user with optional attachments.",
          tags: ["Help"],
        },
      },
    )
    .get(
      "/tickets/:ticketId",
      ({ cookie, params, request, server, status }) => {
        return handleHelpRoute(
          {
            apiKeyService,
            authService,
            cookieValue: cookie[SESSION_COOKIE_NAME]?.value,
            request,
            requiredPermission: "help:read",
            server,
          },
          status as StatusHandler,
          (access) =>
            responseOrStatus(
              ticketService.getTicket({
                actor: access.actor,
                principalKind: access.principalKind,
                ticketId: params.ticketId,
              }),
              status as StatusHandler,
            ),
        ) as never;
      },
      {
        params: helpTicketParamsSchema,
        cookie: helpTicketCookieSchema,
        response: {
          200: helpTicketDetailResponseSchema,
          ...helpTicketRouteErrorResponses,
        },
        detail: {
          summary: "Get help ticket detail",
          description: "Returns one help ticket with attachment metadata.",
          tags: ["Help"],
        },
      },
    )
    .patch(
      "/tickets/:ticketId/status",
      ({ body, cookie, params, request, server, status }) => {
        return handleHelpRoute(
          {
            apiKeyService,
            authService,
            cookieValue: cookie[SESSION_COOKIE_NAME]?.value,
            request,
            requiredPermission: "help:manage",
            server,
          },
          status as StatusHandler,
          (access) =>
            responseOrStatus(
              ticketService.updateTicketStatus({
                actor: access.actor,
                principalKind: access.principalKind,
                request: body as UpdateHelpTicketStatusRequest,
                ticketId: params.ticketId,
              }),
              status as StatusHandler,
            ),
        ) as never;
      },
      {
        body: updateHelpTicketStatusRequestSchema,
        params: helpTicketParamsSchema,
        cookie: helpTicketCookieSchema,
        response: {
          200: helpTicketStatusResponseSchema,
          ...helpTicketRouteErrorResponses,
        },
        detail: {
          summary: "Update help ticket status",
          description: "Updates help ticket status for admins or full-authority API clients.",
          tags: ["Help"],
        },
      },
    )
    .get(
      "/tickets/:ticketId/attachments/:attachmentId",
      async ({ cookie, params, request, server, status }) => {
        return (await handleHelpRouteAsync(
          {
            apiKeyService,
            authService,
            cookieValue: cookie[SESSION_COOKIE_NAME]?.value,
            request,
            requiredPermission: "help:read",
            server,
          },
          status as StatusHandler,
          async (access) => {
            const result = await ticketService.getAttachmentDownload({
              actor: access.actor,
              attachmentId: params.attachmentId,
              principalKind: access.principalKind,
              ticketId: params.ticketId,
            });

            if (!result.ok) {
              return (status as StatusHandler)(result.status, result.body) as never;
            }

            return new Response(result.body.file, {
              headers: {
                "cache-control": "private, max-age=60",
                "content-disposition": `inline; filename="${sanitizeDownloadFileName(result.body.attachment.originalFileName)}"`,
                "content-type": result.body.attachment.mimeType,
              },
            });
          },
        )) as never;
      },
      {
        params: helpTicketAttachmentParamsSchema,
        cookie: helpTicketCookieSchema,
        response: {
          ...helpTicketRouteErrorResponses,
        },
        detail: {
          summary: "Download help attachment",
          description: "Streams one authorized help ticket attachment.",
          tags: ["Help"],
        },
      },
    );
}

function readSessionToken(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readHelpRoutePrincipal(input: {
  apiKeyService: ApiKeyService;
  authService: AuthService;
  cookieValue: unknown;
  request: Request;
  requiredPermission: "help:create" | "help:manage" | "help:read";
  server: Parameters<typeof createRequestContext>[1];
}) {
  return resolveRoutePrincipal({
    apiKeyService: input.apiKeyService,
    authService: input.authService,
    context: createRequestContext(input.request, input.server),
    request: input.request,
    requiredPermission: input.requiredPermission,
    sessionToken: readSessionToken(input.cookieValue),
  });
}

function resolveHelpAccess(
  input: Parameters<typeof readHelpRoutePrincipal>[0],
  status: StatusHandler,
):
  | { ok: true; actor: PublicUser | null; principalKind: "apiKey" | "session" }
  | { ok: false; response: unknown } {
  const principalResult = readHelpRoutePrincipal(input);

  if (!principalResult.ok) {
    return {
      ok: false,
      response: status(principalResult.status, principalResult.body),
    };
  }

  return {
    ok: true,
    actor: principalResult.principal.kind === "session" ? principalResult.principal.user : null,
    principalKind: principalResult.principal.kind,
  };
}

function handleHelpRoute<T>(
  input: Parameters<typeof readHelpRoutePrincipal>[0],
  status: StatusHandler,
  onAllowed: (access: { actor: PublicUser | null; principalKind: "apiKey" | "session" }) => T,
): T | unknown {
  const access = resolveHelpAccess(input, status);

  return access.ok ? onAllowed(access) : access.response;
}

async function handleHelpRouteAsync<T>(
  input: Parameters<typeof readHelpRoutePrincipal>[0],
  status: StatusHandler,
  onAllowed: (access: { actor: PublicUser | null; principalKind: "apiKey" | "session" }) => Promise<T>,
): Promise<T | unknown> {
  const access = resolveHelpAccess(input, status);

  return access.ok ? await onAllowed(access) : access.response;
}

function responseOrStatus<T>(
  result:
    | { ok: true; body: T }
    | { ok: false; status: number; body: { error: { code: string; message: string } } },
  status: StatusHandler,
): T | unknown {
  return result.ok ? result.body : status(result.status, result.body);
}

function sanitizeDownloadFileName(value: string): string {
  return value.replaceAll(/[";]/g, "_");
}
