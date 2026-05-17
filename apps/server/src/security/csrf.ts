import { type ApiErrorResponse, CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "@arrweeb-anime/shared";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const csrfVaryHeaders = ["Sec-Fetch-Site", "Origin"];

const csrfRejectedError: ApiErrorResponse = {
  error: {
    code: "CSRF_REJECTED",
    message: "Request rejected by CSRF protection.",
  },
};

export function enforceCsrfPolicy(allowedOrigin: string) {
  return ({
    request,
    set,
    status,
  }: {
    request: Request;
    set: { headers: Record<string, string | number | boolean | undefined> };
    status: (code: 403, body: ApiErrorResponse) => unknown;
  }): unknown => {
    appendCsrfVaryHeader(set.headers);

    if (!requiresCsrfProtection(request)) {
      return;
    }

    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return status(403, csrfRejectedError);
    }

    if (!hasTrustedSourceOrigin(request.headers, allowedOrigin)) {
      return status(403, csrfRejectedError);
    }

    if (request.headers.get(CSRF_HEADER_NAME) !== CSRF_HEADER_VALUE) {
      return status(403, csrfRejectedError);
    }
  };
}

function requiresCsrfProtection(request: Request): boolean {
  return (
    unsafeMethods.has(request.method.toUpperCase()) &&
    new URL(request.url).pathname.startsWith("/api/")
  );
}

function hasTrustedSourceOrigin(headers: Headers, allowedOrigin: string): boolean {
  const origin = headers.get("origin");

  if (origin) {
    return origin === allowedOrigin;
  }

  const referer = headers.get("referer");

  if (!referer) {
    return false;
  }

  return readOrigin(referer) === allowedOrigin;
}

function readOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function appendCsrfVaryHeader(
  headers: Record<string, string | number | boolean | undefined>,
): void {
  const currentVary = headers.vary;

  if (currentVary === "*") {
    return;
  }

  const varyValues = new Set(
    typeof currentVary === "string"
      ? currentVary
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [],
  );

  for (const header of csrfVaryHeaders) {
    varyValues.add(header);
  }

  headers.vary = [...varyValues].join(", ");
}
