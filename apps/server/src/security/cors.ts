import { CSRF_HEADER_NAME } from "@arrtemplar/shared";
import type { HTTPMethod } from "@elysia/cors";

export const corsAllowedMethods: HTTPMethod[] = ["GET", "POST", "OPTIONS"];
export const corsAllowedHeaders = ["Content-Type", CSRF_HEADER_NAME];

export function removeRejectedOriginCredentials(allowedOrigin: string) {
  return ({
    request,
    set,
  }: {
    request: Request;
    set: { headers: Record<string, string | number | boolean | undefined> };
  }): void => {
    const origin = request.headers.get("origin");

    if (origin === allowedOrigin) {
      return;
    }

    delete set.headers["access-control-allow-credentials"];
  };
}
