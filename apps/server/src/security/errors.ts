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
  status,
}: {
  code: string | number;
  error: unknown;
  status: (code: number, body: ApiErrorResponse) => unknown;
}): unknown {
  if (code === "NOT_FOUND") {
    return status(404, notFoundError);
  }

  if (code === "VALIDATION") {
    return status(422, validationError);
  }

  logUnexpectedError(code, error);

  return status(500, internalServerError);
}

function logUnexpectedError(code: string | number, error: unknown): void {
  securityLogger.error("Unhandled request error {code}", {
    code,
    errorType: error instanceof Error ? error.name : typeof error,
  });
}
