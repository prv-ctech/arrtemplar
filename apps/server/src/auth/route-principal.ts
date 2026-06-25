import type { PublicUser, UserPermission } from "@arrtemplar/shared";
import type { ApiKeyPrincipal, ApiKeyService } from "./api-key.service";
import type { AuthRequestContext, AuthService } from "./auth.service";

type SessionPermissionResult = ReturnType<AuthService["requirePermission"]>;
type ApiKeyResolutionFailure = Exclude<
  ReturnType<ApiKeyService["resolveRequestApiKey"]>,
  { ok: true }
>;
type RoutePrincipal =
  | { kind: "apiKey"; principal: ApiKeyPrincipal }
  | { kind: "session"; user: PublicUser };

export type RoutePrincipalResult =
  | { ok: true; principal: RoutePrincipal }
  | Exclude<SessionPermissionResult, { ok: true }>
  | ApiKeyResolutionFailure;

export function resolveRoutePrincipal(input: {
  apiKeyService: ApiKeyService;
  authService: AuthService;
  context: AuthRequestContext;
  request: Request;
  requiredPermission: UserPermission;
  sessionToken: string | null;
}): RoutePrincipalResult {
  const apiKeyResult = input.apiKeyService.resolveRequestApiKey(input.request, input.context);

  if (!apiKeyResult.ok) {
    return apiKeyResult;
  }

  if (apiKeyResult.principal) {
    return { ok: true, principal: { kind: "apiKey", principal: apiKeyResult.principal } };
  }

  const permissionResult = input.authService.requirePermission(
    input.sessionToken,
    input.requiredPermission,
  );

  return permissionResult.ok
    ? { ok: true, principal: { kind: "session", user: permissionResult.user } }
    : permissionResult;
}
