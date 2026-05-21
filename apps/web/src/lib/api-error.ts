import type { ApiErrorResponse } from "@arrtemplar/shared";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "API_ERROR",
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const response = readEdenErrorValue(error);

  if (isApiErrorResponse(response)) {
    return response.error.message;
  }

  if (isApiErrorResponse(error)) {
    return error.error.message;
  }

  return fallback;
}

export function getApiErrorCode(error: unknown): string {
  const response = readEdenErrorValue(error);

  if (isApiErrorResponse(response)) {
    return response.error.code;
  }

  if (isApiErrorResponse(error)) {
    return error.error.code;
  }

  return "API_ERROR";
}

function readEdenErrorValue(error: unknown): unknown {
  if (!error || typeof error !== "object" || !("value" in error)) {
    return null;
  }

  return (error as { value?: unknown }).value;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return false;
  }

  const error = (value as { error?: unknown }).error;

  if (!error || typeof error !== "object") {
    return false;
  }

  return (
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}
