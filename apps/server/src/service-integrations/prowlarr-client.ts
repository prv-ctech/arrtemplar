import {
  APP_LOG_CATEGORY,
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

const logger = getLogger([APP_LOG_CATEGORY, "service-integrations", "prowlarr"]);

export type ProwlarrClientConfig = {
  useSsl: boolean;
  host: string;
  port: number;
  urlBase?: string | null;
  authMode: "api_key" | "username_password";
  apiKey?: string | null;
  username?: string | null;
  password?: string | null;
  timeoutMs?: number;
};

export type ProwlarrProbeResponse =
  | { ok: true; result: ServiceIntegrationProbeResult }
  | { ok: false; result: ServiceIntegrationProbeResult; error: ServiceIntegrationOperationError };

type ProwlarrHealthIssue = {
  message: string;
  type: string;
};

export async function probeProwlarrClient(
  config: ProwlarrClientConfig,
): Promise<ProwlarrProbeResponse> {
  const checkedAt = new Date().toISOString();
  const baseUrlResult = buildServiceIntegrationBaseUrl({
    serviceLabel: "Prowlarr",
    useSsl: config.useSsl,
    host: config.host,
    port: config.port,
    urlBase: config.urlBase,
  });

  if (!baseUrlResult.ok) {
    return createFailure(config, checkedAt, baseUrlResult.error, { configured: false });
  }

  if (config.authMode !== "api_key") {
    return createFailure(
      config,
      checkedAt,
      createOperationError(
        "configuration_incomplete",
        "Prowlarr only supports API key authentication.",
        ["authMode"],
      ),
      { configured: false },
    );
  }

  const apiKey = config.apiKey?.trim();

  if (!apiKey) {
    return createFailure(
      config,
      checkedAt,
      createOperationError("configuration_incomplete", "Prowlarr API key is required.", ["apiKey"]),
      { configured: false },
    );
  }

  const timeoutMs = normalizeTimeout(config.timeoutMs);
  const authenticatedHeaders = createAuthenticatedHeaders(baseUrlResult.baseUrl, apiKey);

  try {
    await runPingProbe(baseUrlResult.baseUrl, timeoutMs);
    const statusBody = await requestProwlarrJson(
      baseUrlResult.baseUrl,
      "api/v1/system/status",
      authenticatedHeaders,
      timeoutMs,
    );
    const version = readVersion(statusBody);

    if (!version) {
      return createFailure(
        config,
        checkedAt,
        createOperationError("invalid_response", "Prowlarr status response was invalid.", [
          "general",
        ]),
        { reachable: true, authenticated: true },
      );
    }

    const healthIssues = await readHealthIssues(
      baseUrlResult.baseUrl,
      authenticatedHeaders,
      timeoutMs,
      version,
    );
    const issueCount = healthIssues.length;
    const summary = buildSuccessSummary(version, healthIssues);
    const connectionState = issueCount > 0 ? "warning" : "connected";

    logger.info("Prowlarr probe succeeded with version {version}.", {
      version,
      healthIssueCount: issueCount,
    });

    return {
      ok: true,
      result: {
        kind: "prowlarr",
        configured: true,
        enabled: true,
        outcome: "success",
        summary,
        checkedAt,
        reachable: true,
        authenticated: true,
        compatible: true,
        version,
        webApiVersion: null,
        connectionState,
      },
    };
  } catch (error) {
    const mappedError = mapProbeError(error);

    if (!isOperationError(error)) {
      const cause =
        error instanceof Error ? error : new Error("Unexpected Prowlarr probe failure.");

      logger.error(cause, {
        kind: "prowlarr",
        code: mappedError.code,
      });
    }

    return createFailure(config, checkedAt, mappedError, readFailureSignals(mappedError));
  }
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return 5000;
  }

  return Math.max(1, Math.floor(timeoutMs));
}

function createAuthenticatedHeaders(baseUrl: URL, apiKey: string): Headers {
  const headers = createSameOriginHeaders(baseUrl);

  headers.set("accept", "application/json");
  headers.set("X-Api-Key", apiKey);

  return headers;
}

async function runPingProbe(baseUrl: URL, timeoutMs: number): Promise<void> {
  const pingUrl = new URL("ping", baseUrl).toString();

  logger.debug("Prowlarr probe step {step} started.", {
    kind: "prowlarr",
    step: "ping",
    timeoutMs,
    url: pingUrl,
  });

  await requestServiceIntegrationText({
    baseUrl,
    serviceLabel: "Prowlarr",
    path: "ping",
    timeoutMs,
  });
}

async function requestProwlarrJson(
  baseUrl: URL,
  path: string,
  headers: Headers,
  timeoutMs: number,
): Promise<unknown> {
  const url = new URL(path, baseUrl).toString();

  logger.debug("Prowlarr probe step {step} started.", {
    kind: "prowlarr",
    step: path,
    timeoutMs,
    url,
  });

  const response = await requestServiceIntegrationText({
    baseUrl,
    serviceLabel: "Prowlarr",
    path,
    headers,
    timeoutMs,
  });
  const statusError = mapStatusCode(response.status);

  if (statusError) {
    throw statusError;
  }

  try {
    return JSON.parse(response.text) as unknown;
  } catch {
    throw createOperationError("invalid_response", "Prowlarr returned invalid JSON.", ["general"]);
  }
}

async function readHealthIssues(
  baseUrl: URL,
  headers: Headers,
  timeoutMs: number,
  version: string,
): Promise<ProwlarrHealthIssue[]> {
  try {
    const body = await requestProwlarrJson(baseUrl, "api/v1/health", headers, timeoutMs);

    if (!Array.isArray(body)) {
      logger.warn("Service integration probe failed with {code}.", {
        kind: "prowlarr",
        code: "invalid_response",
        status: 200,
        field: "general",
        version,
      });
      return [];
    }

    return body.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.type !== "string" || typeof entry.message !== "string") {
        return [];
      }

      return entry.type === "ok" ? [] : [{ type: entry.type, message: entry.message }];
    });
  } catch (error) {
    const mappedError = mapProbeError(error);

    logger.warn("Service integration probe failed with {code}.", () => ({
      kind: "prowlarr",
      code: mappedError.code,
      status: readErrorStatus(mappedError),
      field: readErrorField(mappedError),
      version,
    }));

    return [];
  }
}

function buildSuccessSummary(version: string, issues: readonly ProwlarrHealthIssue[]): string {
  if (issues.length === 0) {
    return `Connected to Prowlarr ${version}.`;
  }

  if (issues.length === 1) {
    const [issue] = issues;
    return `Connected to Prowlarr ${version}. Health ${issue?.type}: ${truncateIssue(issue?.message ?? "")}.`;
  }

  return `Connected to Prowlarr ${version}. Health issues: ${issues.length}.`;
}

function truncateIssue(message: string): string {
  return message.length > 120 ? `${message.slice(0, 117)}...` : message;
}

function readVersion(value: unknown): string | null {
  if (!isRecord(value) || typeof value.version !== "string") {
    return null;
  }

  const version = value.version.trim();
  return version.length > 0 ? version : null;
}

function mapStatusCode(status: number): ServiceIntegrationOperationError | null {
  if (status >= 300 && status < 400) {
    return createOperationError("redirect_blocked", "Prowlarr redirected the request.", [
      "general",
    ]);
  }

  if (status === 401 || status === 403) {
    return createOperationError("auth_failed", "Prowlarr rejected the API key.", ["apiKey"]);
  }

  if (status >= 500) {
    return createOperationError("service_unavailable", `Prowlarr returned HTTP ${status}.`, [
      "general",
    ]);
  }

  if (status >= 400) {
    return createOperationError("connection_failed", `Prowlarr returned HTTP ${status}.`, [
      "general",
    ]);
  }

  return null;
}

function mapProbeError(error: unknown): ServiceIntegrationOperationError {
  if (isOperationError(error)) {
    return error;
  }

  if (error instanceof TypeError) {
    return createOperationError("connection_failed", "Could not connect to Prowlarr.", ["general"]);
  }

  return createOperationError("connection_failed", "Could not connect to Prowlarr.", ["general"]);
}

type FailureSignals = {
  configured?: boolean;
  reachable?: boolean;
  authenticated?: boolean;
};

function readFailureSignals(error: ServiceIntegrationOperationError): FailureSignals {
  switch (error.code) {
    case "configuration_incomplete":
      return { configured: false, reachable: false, authenticated: false };
    case "auth_failed":
      return { reachable: true, authenticated: false };
    case "invalid_response":
    case "service_unavailable":
      return { reachable: true, authenticated: true };
    case "redirect_blocked":
      return { reachable: true, authenticated: false };
    default:
      return { reachable: false, authenticated: false };
  }
}

function createFailure(
  _config: ProwlarrClientConfig,
  checkedAt: string,
  error: ServiceIntegrationOperationError,
  signals: FailureSignals = {},
): ProwlarrProbeResponse {
  logger.warn("Service integration probe failed with {code}.", () => ({
    kind: "prowlarr",
    code: error.code,
    status: readErrorStatus(error),
    field: readErrorField(error),
  }));

  return {
    ok: false,
    error,
    result: {
      kind: "prowlarr",
      configured: signals.configured ?? true,
      enabled: true,
      outcome: "error",
      summary: error.message,
      checkedAt,
      reachable: signals.reachable ?? false,
      authenticated: signals.authenticated ?? false,
      compatible: false,
      version: null,
      webApiVersion: null,
      connectionState: null,
    },
  };
}

function readErrorField(error: ServiceIntegrationOperationError): string | null {
  return error.fieldErrors?.[0]?.field ?? null;
}

function readErrorStatus(error: ServiceIntegrationOperationError): number | null {
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

function createOperationError(
  code: ServiceIntegrationOperationError["code"],
  message: string,
  fields: Array<"apiKey" | "authMode" | "general">,
): ServiceIntegrationOperationError {
  return createServiceIntegrationOperationError(code, message, fields);
}

function isOperationError(error: unknown): error is ServiceIntegrationOperationError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      "message" in error &&
      typeof error.message === "string",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
