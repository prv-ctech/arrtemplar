import type { App } from "@arrtemplar/server";
import type {
  AuthIdentity,
  AuthProviderSlug,
  AuthProviderSummary,
  AuthSetupStatusResponse,
  AuthUnlinkAllIdentitiesResponse,
  AuthUpsertProviderRequest,
  CreateAdminRequest,
  CreateAdminResponse,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  PublicUser,
} from "@arrtemplar/shared";
import type { Treaty } from "@elysia/eden/treaty2";
import {
  ApiClientError,
  createApiClientErrorFromResponse,
  createApiRequestHeaders,
  getApiClient,
  type LogoutResult,
  readJsonResponse,
  resolveApiRequestUrl,
  unwrapData,
} from "./client";
import {
  isAuthUnlinkAllIdentitiesResponse,
  isLogoutResponse,
  normalizeAuthIdentity,
  normalizeAuthProviderSummary,
  normalizePublicUser,
} from "./normalizers";

const api = getApiClient<Treaty.Create<App>>();

export async function getHealth(): Promise<HealthResponse> {
  return unwrapData(await api.health.get(), "Health request failed.");
}

export async function login(input: LoginRequest): Promise<LoginResponse> {
  const response = unwrapData(await api.api.auth.login.post(input), "Login failed.");

  return { user: normalizePublicUser(response.user) };
}

export async function getAuthSetupStatus(): Promise<AuthSetupStatusResponse> {
  return unwrapData(await api.api.auth.setup.get(), "Setup status check failed.");
}

export async function createInitialAdmin(input: CreateAdminRequest): Promise<CreateAdminResponse> {
  const response = unwrapData(await api.api.auth.setup.post(input), "Admin setup failed.");

  return { user: normalizePublicUser(response.user) };
}

export async function logout(): Promise<LogoutResult> {
  const headers = createApiRequestHeaders("POST");
  const response = await fetch(resolveApiRequestUrl("/api/auth/logout"), {
    method: "POST",
    credentials: "include",
    ...(headers ? { headers } : {}),
  });

  if (!response.ok) {
    throw await createApiClientErrorFromResponse(response, "Logout failed.");
  }

  const body = await readJsonResponse(response);

  if (!isLogoutResponse(body)) {
    throw new ApiClientError("Logout failed.", response.status);
  }

  if (body.redirectUri) {
    return { kind: "sso", redirectUri: body.redirectUri, response: body };
  }

  return { kind: "local", response: body };
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const response = unwrapData(await api.api.auth.me.get(), "Auth check failed.");

  return response.user ? normalizePublicUser(response.user) : null;
}

export async function listAuthProviders(): Promise<AuthProviderSummary[]> {
  const response = unwrapData(await api.api.auth.providers.get(), "Auth providers request failed.");

  return response.providers.map(normalizeAuthProviderSummary);
}

export async function upsertAuthProvider(
  slug: AuthProviderSlug,
  input: AuthUpsertProviderRequest,
): Promise<AuthProviderSummary> {
  const response = unwrapData(
    await api.api.auth.providers({ slug }).put(input),
    "Auth provider save failed.",
  );

  return normalizeAuthProviderSummary(response.provider);
}

export async function listAuthIdentities(): Promise<AuthIdentity[]> {
  const response = unwrapData(
    await api.api.auth.identities.me.get(),
    "Linked auth identities request failed.",
  );

  return response.identities.map(normalizeAuthIdentity);
}

export async function unlinkAllAuthIdentities(): Promise<AuthUnlinkAllIdentitiesResponse> {
  const headers = createApiRequestHeaders("DELETE");
  const response = await fetch(resolveApiRequestUrl("/api/auth/identities"), {
    method: "DELETE",
    credentials: "include",
    ...(headers ? { headers } : {}),
  });

  if (!response.ok) {
    throw await createApiClientErrorFromResponse(response, "OAuth unlink-all failed.");
  }

  const body = await readJsonResponse(response);

  if (!isAuthUnlinkAllIdentitiesResponse(body)) {
    throw new ApiClientError("OAuth unlink-all failed.", response.status);
  }

  return body;
}
