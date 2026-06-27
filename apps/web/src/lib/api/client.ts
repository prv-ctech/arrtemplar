import type { App } from "@arrtemplar/server";
import type { LogoutResponse } from "@arrtemplar/shared";
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "@arrtemplar/shared";
import { treaty } from "@elysia/eden/treaty2";
import { resolveApiBaseUrl } from "../api-base-url";
import {
  ApiClientError,
  getApiErrorCode,
  getApiErrorFieldErrors,
  getApiErrorMessage,
} from "../api-error";

export { ApiClientError } from "../api-error";

const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let cachedApiClient: unknown;

function createEdenClient(): unknown {
  return treaty<App>(apiBaseUrl, {
    fetch: {
      credentials: "include",
    },
    onRequest(_path, options) {
      const headers = createApiRequestHeaders(options.method);

      return headers ? { headers } : undefined;
    },
  });
}

export function getApiClient<TClient>(): TClient {
  cachedApiClient ??= createEdenClient();

  return cachedApiClient as TClient;
}

export type EdenResult<T> = {
  data: T | null;
  error: unknown;
  status: number;
};

export type LogoutResult =
  | { kind: "local"; response: LogoutResponse }
  | { kind: "sso"; redirectUri: string; response: LogoutResponse };

export type NotificationHistoryListParams = {
  page?: number;
  pageSize?: number;
};

export function createApiRequestHeaders(
  method: string | undefined,
): Record<string, string> | undefined {
  if (!method || !unsafeMethods.has(method.toUpperCase())) {
    return undefined;
  }

  return { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE };
}

export type ApiJsonRequest = {
  body?: unknown;
  fallback: string;
  method: "DELETE" | "GET" | "POST" | "PUT";
  path: string;
};

export async function requestApiJson({
  body,
  fallback,
  method,
  path,
}: ApiJsonRequest): Promise<unknown> {
  const csrfHeaders = createApiRequestHeaders(method);
  const headers = new Headers(csrfHeaders);

  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(resolveApiRequestUrl(path), {
    method,
    credentials: "include",
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw await createApiClientErrorFromResponse(response, fallback);
  }

  return readJsonResponse(response);
}

export function resolveApiRequestUrl(path: string): string {
  return apiBaseUrl ? new URL(path, apiBaseUrl).toString() : path;
}

export async function createApiClientErrorFromResponse(
  response: Response,
  fallback: string,
): Promise<ApiClientError> {
  const body = await readJsonResponse(response);

  return new ApiClientError(
    getApiErrorMessage(body, fallback),
    response.status,
    getApiErrorCode(body),
    getApiErrorFieldErrors(body),
  );
}

export async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function unwrapData<T>({ data, error, status }: EdenResult<T>, fallback: string): T {
  if (error) {
    throw new ApiClientError(
      getApiErrorMessage(error, fallback),
      status,
      getApiErrorCode(error),
      getApiErrorFieldErrors(error),
    );
  }

  if (data === null) {
    throw new ApiClientError(fallback, status);
  }

  return data;
}
