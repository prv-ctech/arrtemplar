import type { ApiErrorResponse, PublicUser, UserPermission } from "@arrtemplar/shared";
import type { ApiKeyService } from "./api-key.service";
import type { AuthService } from "./auth.service";
import { resolveRoutePrincipal } from "./route-principal";
import { createRequestContext } from "./routes";

export type MaybePromise<T> = T | Promise<T>;
export type RouteRequestContext = ReturnType<typeof createRequestContext>;
export type ServiceResponse<T> =
  | { ok: true; body: T }
  | { ok: false; status: number; body: ApiErrorResponse };
export type SettingsRouteContext = {
  cookie: Record<string, { value?: unknown } | undefined>;
  request: Request;
  server: Parameters<typeof createRequestContext>[1];
  status: unknown;
};

export async function withSettingsPermissionResult<T>(input: {
  apiKeyService: ApiKeyService;
  authService: AuthService;
  onAllowed: (
    actor: PublicUser | undefined,
    context: RouteRequestContext,
  ) => MaybePromise<ServiceResponse<T>>;
  request: Request;
  requiredPermission: UserPermission;
  server: SettingsRouteContext["server"];
  sessionCookieValue: unknown;
  status: StatusHandler;
}): Promise<T | ReturnType<StatusHandler>> {
  const context = createRequestContext(input.request, input.server);
  const principalResult = resolveRoutePrincipal({
    apiKeyService: input.apiKeyService,
    authService: input.authService,
    context,
    request: input.request,
    requiredPermission: input.requiredPermission,
    sessionToken: readSessionToken(input.sessionCookieValue),
  });

  if (!principalResult.ok) {
    return input.status(principalResult.status, principalResult.body);
  }

  return responseOrStatus(
    await input.onAllowed(
      principalResult.principal.kind === "session" ? principalResult.principal.user : undefined,
      context,
    ),
    input.status,
  );
}

export function readRouteSessionCookie(
  cookie: Record<string, { value?: unknown } | undefined>,
  name: string,
): unknown {
  return cookie[name]?.value;
}

function responseOrStatus<T>(
  result: ServiceResponse<T>,
  status: StatusHandler,
): T | ReturnType<StatusHandler> {
  return result.ok ? result.body : status(result.status, result.body);
}

function readSessionToken(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// biome-ignore lint/suspicious/noExplicitAny: Elysia SelectiveStatus callback types vary per route and are impractical to model precisely in this shared helper.
export type StatusHandler = (...args: any[]) => any;
