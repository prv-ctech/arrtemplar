import type {
  ServiceIntegrationKind,
  ServiceIntegrationOperationError,
  ServiceIntegrationProbeResult,
} from "@arrtemplar/shared";
import type { Logger } from "@logtape/logtape";
import {
  buildServiceIntegrationBaseUrl,
  createServiceIntegrationOperationError,
} from "./outbound-request-policy";

const defaultTimeoutMs = 5000;

export type ApiKeyOnlyProbeConfig = {
  useSsl: boolean;
  host: string;
  port: number;
  urlBase?: string | null;
  authMode: "api_key" | "username_password";
  apiKey?: string | null;
  timeoutMs?: number;
};

type ServiceIntegrationFailureSignals = {
  configured?: boolean;
  reachable?: boolean;
  authenticated?: boolean;
};

export type ServiceIntegrationProbeFailure = {
  ok: false;
  result: ServiceIntegrationProbeResult;
  error: ServiceIntegrationOperationError;
};

export function prepareApiKeyOnlyProbe(
  config: ApiKeyOnlyProbeConfig,
  options: {
    kind: ServiceIntegrationKind;
    serviceLabel: string;
    checkedAt: string;
    logger: Logger;
  },
):
  | { ok: true; baseUrl: URL; apiKey: string; timeoutMs: number }
  | { ok: false; failure: ServiceIntegrationProbeFailure } {
  const baseUrlResult = buildServiceIntegrationBaseUrl({
    serviceLabel: options.serviceLabel,
    useSsl: config.useSsl,
    host: config.host,
    port: config.port,
    urlBase: config.urlBase,
  });

  if (!baseUrlResult.ok) {
    return {
      ok: false,
      failure: createServiceIntegrationProbeFailure({
        kind: options.kind,
        checkedAt: options.checkedAt,
        error: baseUrlResult.error,
        signals: { configured: false },
        logger: options.logger,
      }),
    };
  }

  if (config.authMode !== "api_key") {
    return {
      ok: false,
      failure: createServiceIntegrationProbeFailure({
        kind: options.kind,
        checkedAt: options.checkedAt,
        error: createServiceIntegrationOperationError(
          "configuration_incomplete",
          `${options.serviceLabel} only supports API key authentication.`,
          ["authMode"],
        ),
        signals: { configured: false },
        logger: options.logger,
      }),
    };
  }

  const apiKey = config.apiKey?.trim();

  if (!apiKey) {
    return {
      ok: false,
      failure: createServiceIntegrationProbeFailure({
        kind: options.kind,
        checkedAt: options.checkedAt,
        error: createServiceIntegrationOperationError(
          "configuration_incomplete",
          `${options.serviceLabel} API key is required.`,
          ["apiKey"],
        ),
        signals: { configured: false },
        logger: options.logger,
      }),
    };
  }

  return {
    ok: true,
    baseUrl: baseUrlResult.baseUrl,
    apiKey,
    timeoutMs: normalizeServiceIntegrationTimeout(config.timeoutMs),
  };
}

function normalizeServiceIntegrationTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return defaultTimeoutMs;
  }

  return Math.max(1, Math.floor(timeoutMs));
}

export function mapServiceIntegrationStatusCode(
  status: number,
  serviceLabel: string,
): ServiceIntegrationOperationError | null {
  if (status >= 300 && status < 400) {
    return createServiceIntegrationOperationError(
      "redirect_blocked",
      `${serviceLabel} redirected the request.`,
      ["general"],
    );
  }

  if (status === 401 || status === 403) {
    return createServiceIntegrationOperationError(
      "auth_failed",
      `${serviceLabel} rejected the API key.`,
      ["apiKey"],
    );
  }

  if (status >= 500) {
    return createServiceIntegrationOperationError(
      "service_unavailable",
      `${serviceLabel} returned HTTP ${status}.`,
      ["general"],
    );
  }

  if (status >= 400) {
    return createServiceIntegrationOperationError(
      "connection_failed",
      `${serviceLabel} returned HTTP ${status}.`,
      ["general"],
    );
  }

  return null;
}

function createServiceIntegrationProbeFailure(options: {
  kind: ServiceIntegrationKind;
  checkedAt: string;
  error: ServiceIntegrationOperationError;
  logger: Logger;
  signals?: ServiceIntegrationFailureSignals;
  responseTooLargeAuthenticated?: boolean;
}): ServiceIntegrationProbeFailure {
  const failureSignalOptions =
    options.responseTooLargeAuthenticated === undefined
      ? {}
      : { responseTooLargeAuthenticated: options.responseTooLargeAuthenticated };
  const signals =
    options.signals ?? readServiceIntegrationFailureSignals(options.error, failureSignalOptions);

  logServiceIntegrationProbeFailure(options.logger, options.kind, options.error);

  return {
    ok: false,
    error: options.error,
    result: {
      kind: options.kind,
      configured: signals.configured ?? true,
      enabled: true,
      outcome: "error",
      summary: options.error.message,
      checkedAt: options.checkedAt,
      reachable: signals.reachable ?? false,
      authenticated: signals.authenticated ?? false,
      compatible: false,
      version: null,
      webApiVersion: null,
      connectionState: null,
    },
  };
}

export function createServiceIntegrationProbeErrorFailure(options: {
  kind: ServiceIntegrationKind;
  serviceLabel: string;
  checkedAt: string;
  logger: Logger;
  error: unknown;
  responseTooLargeAuthenticated?: boolean;
}): ServiceIntegrationProbeFailure {
  const mappedError = mapServiceIntegrationProbeError(options.error, options.serviceLabel);

  if (!isServiceIntegrationOperationError(options.error)) {
    const cause =
      options.error instanceof Error
        ? options.error
        : new Error(`Unexpected ${options.serviceLabel} probe failure.`);

    options.logger.error(cause, {
      kind: options.kind,
      code: mappedError.code,
    });
  }

  return createServiceIntegrationProbeFailure({
    kind: options.kind,
    checkedAt: options.checkedAt,
    error: mappedError,
    logger: options.logger,
    ...(options.responseTooLargeAuthenticated === undefined
      ? {}
      : { responseTooLargeAuthenticated: options.responseTooLargeAuthenticated }),
  });
}

export function mapServiceIntegrationProbeError(
  error: unknown,
  serviceLabel: string,
): ServiceIntegrationOperationError {
  if (isServiceIntegrationOperationError(error)) {
    return error;
  }

  return createServiceIntegrationOperationError(
    "connection_failed",
    `Could not connect to ${serviceLabel}.`,
    ["general"],
  );
}

export function logServiceIntegrationProbeFailure(
  logger: Logger,
  kind: ServiceIntegrationKind,
  error: ServiceIntegrationOperationError,
  properties: Record<string, unknown> = {},
): void {
  logger.warn("Service integration probe failed with {code}.", () => ({
    kind,
    code: error.code,
    status: readServiceIntegrationErrorStatus(error),
    field: readServiceIntegrationErrorField(error),
    ...properties,
  }));
}

function isServiceIntegrationOperationError(
  error: unknown,
): error is ServiceIntegrationOperationError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      "message" in error &&
      typeof error.message === "string",
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isServiceIntegrationJsonResponse(
  body: string,
  headers: Headers,
  options: { allowJsonArray?: boolean } = {},
): boolean {
  const contentType = headers.get("content-type")?.toLowerCase() ?? "";

  return (
    contentType.includes("application/json") ||
    body.startsWith("{") ||
    (options.allowJsonArray === true && body.startsWith("["))
  );
}

export function readServiceIntegrationStringField(
  record: Record<string, unknown> | null,
  field: string,
): string | null {
  if (!record || typeof record[field] !== "string") {
    return null;
  }

  return normalizeServiceIntegrationText(record[field]);
}

export function readServiceIntegrationXmlAttribute(
  attributes: string,
  name: string,
): string | null {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*("([^"]*)"|'([^']*)')`, "iu");
  const match = pattern.exec(attributes);
  const value = match?.[2] ?? match?.[3] ?? null;

  return value ? normalizeServiceIntegrationText(decodeXmlEntities(value)) : null;
}

export function normalizeServiceIntegrationText(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function readServiceIntegrationFailureSignals(
  error: ServiceIntegrationOperationError,
  options: { responseTooLargeAuthenticated?: boolean } = {},
): ServiceIntegrationFailureSignals {
  switch (error.code) {
    case "configuration_incomplete":
      return { configured: false, reachable: false, authenticated: false };
    case "auth_failed":
      return { reachable: true, authenticated: false };
    case "invalid_response":
    case "service_unavailable":
      return { reachable: true, authenticated: true };
    case "response_too_large":
      return options.responseTooLargeAuthenticated === false
        ? { reachable: false, authenticated: false }
        : { reachable: true, authenticated: true };
    case "redirect_blocked":
      return { reachable: true, authenticated: false };
    default:
      return { reachable: false, authenticated: false };
  }
}

function readServiceIntegrationErrorField(error: ServiceIntegrationOperationError): string | null {
  return error.fieldErrors?.[0]?.field ?? null;
}

function readServiceIntegrationErrorStatus(error: ServiceIntegrationOperationError): number | null {
  switch (error.code) {
    case "auth_failed":
      return 401;
    case "service_unavailable":
      return 500;
    case "redirect_blocked":
      return 302;
    default:
      return null;
  }
}
