import type { App } from "@arrweeb-anime/server";
import type {
  AuthSetupStatusResponse,
  AuthUserResponse,
  CreateAdminRequest,
  CreateAdminResponse,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  PublicUser,
} from "@arrweeb-anime/shared";
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "@arrweeb-anime/shared";
import { treaty } from "@elysia/eden";
import { resolveApiBaseUrl } from "./api-base-url";
import { ApiClientError, getApiErrorCode, getApiErrorMessage } from "./api-error";

const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const api = treaty<App>(apiBaseUrl, {
  fetch: {
    credentials: "include",
  },
  onRequest(_path, options) {
    const headers = createApiRequestHeaders(options.method);

    return headers ? { headers } : undefined;
  },
});

type EdenResult<T> = {
  data: T | null;
  error: unknown;
  status: number;
};

export async function getHealth(): Promise<HealthResponse> {
  return unwrapData(await api.health.get(), "Health request failed.");
}

export async function login(input: LoginRequest): Promise<LoginResponse> {
  return unwrapData(await api.api.auth.login.post(input), "Login failed.");
}

export async function getAuthSetupStatus(): Promise<AuthSetupStatusResponse> {
  return unwrapData(await api.api.auth.setup.get(), "Setup status check failed.");
}

export async function createInitialAdmin(input: CreateAdminRequest): Promise<CreateAdminResponse> {
  return unwrapData(await api.api.auth.setup.post(input), "Admin setup failed.");
}

export async function logout(): Promise<LogoutResponse> {
  return unwrapData(await api.api.auth.logout.post(), "Logout failed.");
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const response = unwrapData<AuthUserResponse>(await api.api.auth.me.get(), "Auth check failed.");

  return response.user;
}

export function createApiRequestHeaders(
  method: string | undefined,
): Record<string, string> | undefined {
  if (!method || !unsafeMethods.has(method.toUpperCase())) {
    return undefined;
  }

  return { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE };
}

function unwrapData<T>({ data, error, status }: EdenResult<T>, fallback: string): T {
  if (error) {
    throw new ApiClientError(getApiErrorMessage(error, fallback), status, getApiErrorCode(error));
  }

  if (data === null) {
    throw new ApiClientError(fallback, status);
  }

  return data;
}
