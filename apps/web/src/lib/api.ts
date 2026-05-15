import type { App } from "@arrweeb-anime/server";
import type {
  AuthUserResponse,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  PublicUser,
} from "@arrweeb-anime/shared";
import { treaty } from "@elysia/eden";
import { resolveApiBaseUrl } from "./api-base-url";
import { ApiClientError, getApiErrorCode, getApiErrorMessage } from "./api-error";

const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

const api = treaty<App>(apiBaseUrl, {
  fetch: {
    credentials: "include",
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

export async function logout(): Promise<LogoutResponse> {
  return unwrapData(await api.api.auth.logout.post(), "Logout failed.");
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const response = unwrapData<AuthUserResponse>(await api.api.auth.me.get(), "Auth check failed.");

  return response.user;
}

export async function checkAdmin(): Promise<PublicUser | null> {
  const response = unwrapData<AuthUserResponse>(
    await api.api.admin.auth.check.get(),
    "Admin check failed.",
  );

  return response.user;
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
