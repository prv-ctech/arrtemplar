import {
  APP_LOG_CATEGORY,
  type ServiceIntegrationAuthMode,
  type ServiceIntegrationField,
  type ServiceIntegrationOperationError,
  type ServiceIntegrationProbeResult,
} from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";
import {
  buildServiceIntegrationBaseUrl,
  createSameOriginHeaders,
  createServiceIntegrationOperationError,
  requestServiceIntegrationText,
} from "./outbound-request-policy";
import {
  isRecord,
  isServiceIntegrationOperationError,
  normalizeServiceIntegrationText,
} from "./probe-helpers";

const logger = getLogger([APP_LOG_CATEGORY, "service-integrations", "slskd"]);
const serviceKind = "slskd";
const serviceLabel = "slskd";
const applicationPath = "api/v0/application";
const defaultTimeoutMs = 5000;

export type SlskdClientConfig = {
  integrationId?: string | null;
  useSsl: boolean;
  host: string;
  port: number;
  urlBase?: string | null;
  authMode: ServiceIntegrationAuthMode;
  apiKey?: string | null;
  username?: string | null;
  password?: string | null;
  timeoutMs?: number;
};

export type SlskdProbeResponse =
  | { ok: true; result: ServiceIntegrationProbeResult }
  | { ok: false; result: ServiceIntegrationProbeResult; error: ServiceIntegrationOperationError };

type SlskdRequestContext = {
  checkedAt: string;
  integrationId: string | null;
  timeoutMs: number;
};

type SlskdFailureInput = {
  step: string;
  error: ServiceIntegrationOperationError;
  configured?: boolean;
  reachable?: boolean;
  authenticated?: boolean;
  statusCode?: number | null;
  responseTimeMs?: number | null;
};

type SlskdJsonResponse = {
  ok: true;
  body: Record<string, unknown>;
  statusCode: number;
  responseTimeMs: number;
};

type SlskdJsonFailure = {
  ok: false;
  error: ServiceIntegrationOperationError;
  statusCode: number;
  responseTimeMs: number;
  reachable: boolean;
  authenticated: boolean;
};

type SlskdApplicationMetadata = {
  version: string | null;
  applicationState: string;
};

export async function probeSlskdClient(config: SlskdClientConfig): Promise<SlskdProbeResponse> {
  const checkedAt = new Date().toISOString();
  const timeoutMs = normalizeTimeout(config.timeoutMs);
  const integrationId = normalizeOptionalText(config.integrationId) ?? null;
  const requestContext = { checkedAt, integrationId, timeoutMs };

  logger.debug("slskd probe started for {serviceKind}.", {
    serviceKind,
    integrationId,
    host: config.host,
    port: config.port,
    authMode: config.authMode,
    timeoutMs,
  });

  const baseUrlResult = buildServiceIntegrationBaseUrl({
    serviceLabel,
    useSsl: config.useSsl,
    host: config.host,
    port: config.port,
    urlBase: config.urlBase,
  });

  if (!baseUrlResult.ok) {
    return createFailure(config, requestContext, {
      step: "base_url",
      error: baseUrlResult.error,
      configured: false,
      reachable: false,
      authenticated: false,
    });
  }

  const authHeadersResult = createAuthHeaders(config, baseUrlResult.baseUrl);

  if (!authHeadersResult.ok) {
    return createFailure(config, requestContext, {
      step: "auth_mode",
      error: authHeadersResult.error,
      configured: false,
      reachable: false,
      authenticated: false,
    });
  }

  logger.info("slskd probe selected auth mode {authMode}.", {
    serviceKind,
    integrationId,
    authMode: config.authMode,
  });

  try {
    const applicationResponse = await requestSlskdJson(
      baseUrlResult.baseUrl,
      applicationPath,
      authHeadersResult.headers,
      timeoutMs,
      config.authMode,
    );

    if (!applicationResponse.ok) {
      return createFailure(config, requestContext, {
        step: "application",
        error: applicationResponse.error,
        reachable: applicationResponse.reachable,
        authenticated: applicationResponse.authenticated,
        statusCode: applicationResponse.statusCode,
        responseTimeMs: applicationResponse.responseTimeMs,
      });
    }

    const applicationMetadata = readApplicationMetadata(applicationResponse.body);

    if (!applicationMetadata) {
      return createFailure(config, requestContext, {
        step: "application",
        error: createOperationError("invalid_response", "slskd application response was invalid."),
        reachable: true,
        authenticated: true,
        statusCode: applicationResponse.statusCode,
        responseTimeMs: applicationResponse.responseTimeMs,
      });
    }

    logger.info("slskd probe succeeded with application state {applicationState}.", {
      serviceKind,
      integrationId,
      statusCode: applicationResponse.statusCode,
      applicationState: applicationMetadata.applicationState,
      responseTimeMs: applicationResponse.responseTimeMs,
    });

    return {
      ok: true,
      result: {
        kind: serviceKind,
        configured: true,
        enabled: true,
        outcome: "success",
        summary: buildSuccessSummary(applicationMetadata),
        checkedAt,
        reachable: true,
        authenticated: true,
        compatible: true,
        version: applicationMetadata.version,
        webApiVersion: null,
        connectionState: applicationMetadata.applicationState,
      },
    };
  } catch (error) {
    return createFailureFromUnknownError(config, requestContext, "application", error);
  }
}

function createAuthHeaders(
  config: SlskdClientConfig,
  baseUrl: URL,
): { ok: true; headers: Headers } | { ok: false; error: ServiceIntegrationOperationError } {
  const headers = createSameOriginHeaders(baseUrl);

  headers.set("accept", "application/json");

  if (config.authMode === "none") {
    return { ok: true, headers };
  }

  if (config.authMode !== "api_key") {
    return {
      ok: false,
      error: createOperationError(
        "configuration_incomplete",
        "slskd only supports API key or no authentication.",
        ["authMode"],
      ),
    };
  }

  const apiKey = normalizeOptionalText(config.apiKey);

  if (!apiKey) {
    return {
      ok: false,
      error: createOperationError("configuration_incomplete", "slskd API key is required.", [
        "apiKey",
      ]),
    };
  }

  headers.set("X-API-Key", apiKey);

  return { ok: true, headers };
}

async function requestSlskdJson(
  baseUrl: URL,
  path: string,
  headers: Headers,
  timeoutMs: number,
  authMode: ServiceIntegrationAuthMode,
): Promise<SlskdJsonResponse | SlskdJsonFailure> {
  const requestStartedAt = Date.now();
  const response = await requestServiceIntegrationText({
    baseUrl,
    serviceLabel,
    path,
    headers,
    timeoutMs,
  });
  const responseTimeMs = Date.now() - requestStartedAt;
  const statusError = mapSlskdStatusCode(response.status, authMode);

  if (statusError) {
    const failureDetails = readFailureDetails(statusError);

    return {
      ok: false,
      error: statusError,
      statusCode: response.status,
      responseTimeMs,
      reachable: failureDetails.reachable ?? false,
      authenticated: failureDetails.authenticated ?? false,
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(response.text) as unknown;
  } catch {
    return {
      ok: false,
      error: createOperationError("invalid_response", "slskd returned invalid JSON.", ["general"]),
      statusCode: response.status,
      responseTimeMs,
      reachable: true,
      authenticated: true,
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      error: createOperationError("invalid_response", "slskd returned an invalid JSON object.", [
        "general",
      ]),
      statusCode: response.status,
      responseTimeMs,
      reachable: true,
      authenticated: true,
    };
  }

  return {
    ok: true,
    body: parsed,
    statusCode: response.status,
    responseTimeMs,
  };
}

function readApplicationMetadata(value: Record<string, unknown>): SlskdApplicationMetadata | null {
  const version = readApplicationVersion(value);
  const applicationState = readApplicationState(value) ?? "unknown";

  if (!version && applicationState === "unknown") {
    return null;
  }

  return { version, applicationState };
}

function readApplicationVersion(value: Record<string, unknown>): string | null {
  const directVersion = normalizeOptionalText(readString(value, "applicationVersion"));

  if (directVersion) {
    return directVersion;
  }

  const versionValue = value.version;

  if (typeof versionValue === "string") {
    return normalizeOptionalText(versionValue);
  }

  if (!isRecord(versionValue)) {
    return null;
  }

  return (
    readString(versionValue, "current") ??
    readString(versionValue, "full") ??
    readString(versionValue, "latest")
  );
}

function readApplicationState(value: Record<string, unknown>): string | null {
  const directState = readString(value, "state");

  if (directState) {
    return directState;
  }

  const server = isRecord(value.server) ? value.server : null;
  const serverState = readString(server, "state");

  if (serverState) {
    return serverState;
  }

  const isConnected = readBoolean(server, "isConnected");
  const isConnecting = readBoolean(server, "isConnecting");
  const isLoggedIn = readBoolean(server, "isLoggedIn");
  const isLoggingIn = readBoolean(server, "isLoggingIn");

  if (isConnected === true && isLoggedIn === true) {
    return "connected";
  }

  if (isConnected === true) {
    return "connected";
  }

  if (isConnecting === true || isLoggingIn === true) {
    return "connecting";
  }

  if (isConnected === false) {
    return "disconnected";
  }

  return null;
}

function readString(record: Record<string, unknown> | null, field: string): string | null {
  if (!record || typeof record[field] !== "string") {
    return null;
  }

  return normalizeOptionalText(record[field]);
}

function readBoolean(record: Record<string, unknown> | null, field: string): boolean | null {
  if (!record || typeof record[field] !== "boolean") {
    return null;
  }

  return record[field];
}

function buildSuccessSummary(metadata: SlskdApplicationMetadata): string {
  if (metadata.version) {
    return `Connected to slskd ${metadata.version}. State: ${metadata.applicationState}.`;
  }

  return `Connected to slskd. State: ${metadata.applicationState}.`;
}

function createFailureFromUnknownError(
  config: SlskdClientConfig,
  requestContext: SlskdRequestContext,
  step: string,
  error: unknown,
): SlskdProbeResponse {
  if (isOperationError(error)) {
    return createFailure(config, requestContext, {
      step,
      error,
      ...readFailureDetails(error),
    });
  }

  const cause = error instanceof Error ? error : new Error("Unexpected slskd probe failure.");

  logger.error("Service integration probe crashed for {serviceKind}.", {
    serviceKind,
    integrationId: requestContext.integrationId,
    step,
    error: cause,
  });

  return createFailure(config, requestContext, {
    step,
    error: createOperationError("connection_failed", "Could not connect to slskd.", ["general"]),
    reachable: false,
    authenticated: false,
  });
}

function createFailure(
  _config: SlskdClientConfig,
  requestContext: SlskdRequestContext,
  input: SlskdFailureInput,
): SlskdProbeResponse {
  logger.warn("slskd probe failed at {step} with {reason}.", {
    serviceKind,
    integrationId: requestContext.integrationId,
    step: input.step,
    statusCode: input.statusCode ?? null,
    reason: input.error.code,
    responseTimeMs: input.responseTimeMs ?? null,
  });

  return {
    ok: false,
    error: input.error,
    result: {
      kind: serviceKind,
      configured: input.configured ?? true,
      enabled: true,
      outcome: "error",
      summary: input.error.message,
      checkedAt: requestContext.checkedAt,
      reachable: input.reachable ?? false,
      authenticated: input.authenticated ?? false,
      compatible: false,
      version: null,
      webApiVersion: null,
      connectionState: null,
    },
  };
}

function readFailureDetails(error: ServiceIntegrationOperationError): {
  configured?: boolean;
  reachable?: boolean;
  authenticated?: boolean;
} {
  switch (error.code) {
    case "configuration_incomplete":
    case "invalid_host":
    case "invalid_port":
    case "invalid_url_base":
      return { configured: false, reachable: false, authenticated: false };
    case "auth_failed":
      return { reachable: true, authenticated: false };
    case "invalid_response":
    case "service_unavailable":
    case "response_too_large":
      return { reachable: true, authenticated: true };
    case "redirect_blocked":
      return { reachable: true, authenticated: false };
    default:
      return { reachable: false, authenticated: false };
  }
}

function mapSlskdStatusCode(
  status: number,
  authMode: ServiceIntegrationAuthMode,
): ServiceIntegrationOperationError | null {
  if (status === 401 || status === 403) {
    return createOperationError(
      "auth_failed",
      authMode === "api_key"
        ? "slskd rejected the API key."
        : "slskd rejected unauthenticated access.",
      [credentialField(authMode)],
    );
  }

  if (status >= 500) {
    return createOperationError("service_unavailable", `slskd returned HTTP ${status}.`, [
      "general",
    ]);
  }

  if (status >= 400) {
    return createOperationError("connection_failed", `slskd returned HTTP ${status}.`, ["general"]);
  }

  return null;
}

function credentialField(authMode: ServiceIntegrationAuthMode): ServiceIntegrationField {
  return authMode === "api_key" ? "apiKey" : "authMode";
}

function createOperationError(
  code: ServiceIntegrationOperationError["code"],
  message: string,
  fields: ServiceIntegrationField[] = [],
): ServiceIntegrationOperationError {
  return createServiceIntegrationOperationError(code, message, fields);
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return defaultTimeoutMs;
  }

  return Math.max(1, Math.floor(timeoutMs));
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  return typeof value === "string" ? normalizeServiceIntegrationText(value) : null;
}

function isOperationError(error: unknown): error is ServiceIntegrationOperationError {
  return isServiceIntegrationOperationError(error);
}
