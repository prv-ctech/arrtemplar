import { APP_LOG_CATEGORY, type ApiErrorResponse } from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";

const securityLogger = getLogger([APP_LOG_CATEGORY, "security"]);

const notFoundError: ApiErrorResponse = {
  error: {
    code: "NOT_FOUND",
    message: "Not found.",
  },
};

const validationError: ApiErrorResponse = {
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid request.",
  },
};

const internalServerError: ApiErrorResponse = {
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error.",
  },
};

export function handleSafeError({
  code,
  error,
  request,
  status,
}: {
  code: string | number;
  error: unknown;
  request?: Request;
  status: (code: number, body: ApiErrorResponse) => unknown;
}): unknown {
  if (code === "NOT_FOUND") {
    return status(404, notFoundError);
  }

  if (code === "VALIDATION") {
    return status(422, validationError);
  }

  logUnexpectedError({ code, error, request });

  return status(500, internalServerError);
}

function logUnexpectedError({
  code,
  error,
  request,
}: {
  code: string | number;
  error: unknown;
  request: Request | undefined;
}): void {
  securityLogger.error("Unhandled request error {eventId}", () => ({
    event: "request.unexpected_error",
    eventId: Bun.randomUUIDv7(),
    code,
    errorType: readErrorType(error),
    status: 500,
    ...readRequestDiagnostics(request),
  }));
}

function readErrorType(error: unknown): string {
  if (error instanceof Error) {
    return error.name || "Error";
  }

  return typeof error;
}

function readRequestDiagnostics(request: Request | undefined): { method?: string; path?: string } {
  if (!request) {
    return {};
  }

  const path = readRequestPath(request.url);

  return {
    method: request.method,
    ...(path ? { path } : {}),
  };
}

function readRequestPath(url: string): string | undefined {
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
}
