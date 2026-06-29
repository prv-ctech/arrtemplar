import {
  APP_LOG_CATEGORY,
  type ServiceIntegrationOperationError,
  type ServiceIntegrationProbeResult,
} from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";
import {
  createServiceIntegrationOperationError as createOperationError,
  createSameOriginHeaders,
  requestServiceIntegrationText,
} from "./outbound-request-policy";
import {
  createServiceIntegrationProbeErrorFailure,
  isRecord,
  logServiceIntegrationProbeFailure,
  mapServiceIntegrationProbeError,
  mapServiceIntegrationStatusCode,
  prepareApiKeyOnlyProbe,
} from "./probe-helpers";

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
  const preparedProbe = prepareApiKeyOnlyProbe(config, {
    kind: "prowlarr",
    serviceLabel: "Prowlarr",
    checkedAt,
    logger,
  });

  if (!preparedProbe.ok) {
    return preparedProbe.failure;
  }

  const { apiKey, baseUrl, timeoutMs } = preparedProbe;
  const authenticatedHeaders = createAuthenticatedHeaders(baseUrl, apiKey);

  try {
    await runPingProbe(baseUrl, timeoutMs);
    const statusBody = await requestProwlarrJson(
      baseUrl,
      "api/v1/system/status",
      authenticatedHeaders,
      timeoutMs,
    );
    const version = readVersion(statusBody);

    if (!version) {
      throw createOperationError("invalid_response", "Prowlarr status response was invalid.", [
        "general",
      ]);
    }

    const healthIssues = await readHealthIssues(baseUrl, authenticatedHeaders, timeoutMs, version);
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
    return createServiceIntegrationProbeErrorFailure({
      kind: "prowlarr",
      serviceLabel: "Prowlarr",
      checkedAt,
      logger,
      error,
      responseTooLargeAuthenticated: false,
    });
  }
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
  const statusError = mapServiceIntegrationStatusCode(response.status, "Prowlarr");

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
      logServiceIntegrationProbeFailure(
        logger,
        "prowlarr",
        createOperationError("invalid_response", "Prowlarr health response was invalid.", [
          "general",
        ]),
        { status: 200, version },
      );
      return [];
    }

    return body.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.type !== "string" || typeof entry.message !== "string") {
        return [];
      }

      return entry.type === "ok" ? [] : [{ type: entry.type, message: entry.message }];
    });
  } catch (error) {
    const mappedError = mapServiceIntegrationProbeError(error, "Prowlarr");

    logServiceIntegrationProbeFailure(logger, "prowlarr", mappedError, {
      version,
    });

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
