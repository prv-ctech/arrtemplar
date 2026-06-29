import {
  APP_LOG_CATEGORY,
  APP_VERSION,
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
  isRecord,
  logServiceIntegrationProbeFailure,
  mapServiceIntegrationProbeError,
  mapServiceIntegrationStatusCode,
  prepareApiKeyOnlyProbe,
} from "./probe-helpers";

const logger = getLogger([APP_LOG_CATEGORY, "service-integrations", "jellyfin"]);

export type JellyfinClientConfig = {
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

export type JellyfinProbeResponse =
  | { ok: true; result: ServiceIntegrationProbeResult }
  | { ok: false; result: ServiceIntegrationProbeResult; error: ServiceIntegrationOperationError };

type JellyfinSystemInfo = {
  serverName: string;
  version: string;
  id: string;
  startupWizardCompleted: boolean;
};

type JellyfinProbeStep = "public" | "authenticated";

type JellyfinFailureSignals = {
  configured?: boolean;
  reachable: boolean;
  authenticated: boolean;
};

export async function probeJellyfinClient(
  config: JellyfinClientConfig,
): Promise<JellyfinProbeResponse> {
  const checkedAt = new Date().toISOString();
  const preparedProbe = prepareApiKeyOnlyProbe(config, {
    kind: "jellyfin",
    serviceLabel: "Jellyfin",
    checkedAt,
    logger,
  });

  if (!preparedProbe.ok) {
    return preparedProbe.failure;
  }

  const { apiKey, baseUrl, timeoutMs } = preparedProbe;

  let publicInfo: JellyfinSystemInfo;

  try {
    publicInfo = await requestJellyfinSystemInfo({
      baseUrl,
      path: "System/Info/Public",
      headers: createJellyfinHeaders(baseUrl),
      timeoutMs,
      step: "public-system-info",
    });
  } catch (error) {
    return createJellyfinProbeErrorFailure({ checkedAt, error, step: "public" });
  }

  if (!publicInfo.startupWizardCompleted) {
    return createStartupWizardFailure(checkedAt, publicInfo.version);
  }

  try {
    const authenticatedInfo = await requestJellyfinSystemInfo({
      baseUrl,
      path: "System/Info",
      headers: createJellyfinHeaders(baseUrl, apiKey),
      timeoutMs,
      step: "system-info",
    });

    logger.info("Jellyfin probe succeeded with version {version}.", {
      version: authenticatedInfo.version,
      serverName: authenticatedInfo.serverName,
    });

    return {
      ok: true,
      result: {
        kind: "jellyfin",
        configured: true,
        enabled: true,
        outcome: "success",
        summary: buildSuccessSummary(authenticatedInfo),
        checkedAt,
        reachable: true,
        authenticated: true,
        compatible: true,
        version: authenticatedInfo.version,
        webApiVersion: null,
        connectionState: "connected",
      },
    };
  } catch (error) {
    return createJellyfinProbeErrorFailure({ checkedAt, error, step: "authenticated" });
  }
}

function createJellyfinHeaders(baseUrl: URL, apiKey?: string): Headers {
  const headers = createSameOriginHeaders(baseUrl);

  headers.set("Accept", "application/json");

  if (apiKey) {
    headers.set("Authorization", createJellyfinAuthorizationHeader(apiKey));
  }

  return headers;
}

function createJellyfinAuthorizationHeader(apiKey: string): string {
  return `MediaBrowser Client="Arrtemplar", Device="Arrtemplar", DeviceId="arrtemplar", Version="${APP_VERSION}", Token="${apiKey}"`;
}

async function requestJellyfinSystemInfo(options: {
  baseUrl: URL;
  path: "System/Info/Public" | "System/Info";
  headers: Headers;
  timeoutMs: number;
  step: string;
}): Promise<JellyfinSystemInfo> {
  const url = new URL(options.path, options.baseUrl).toString();

  logger.debug("Jellyfin probe step {step} started.", {
    kind: "jellyfin",
    step: options.step,
    timeoutMs: options.timeoutMs,
    url,
  });

  const response = await requestServiceIntegrationText({
    baseUrl: options.baseUrl,
    serviceLabel: "Jellyfin",
    path: options.path,
    headers: options.headers,
    timeoutMs: options.timeoutMs,
  });
  const statusError = mapServiceIntegrationStatusCode(response.status, "Jellyfin");

  if (statusError) {
    throw statusError;
  }

  const parsed = parseJellyfinJson(response.text);
  const systemInfo = readJellyfinSystemInfo(parsed);

  if (!systemInfo) {
    throw createOperationError("invalid_response", "Jellyfin system info response was invalid.", [
      "general",
    ]);
  }

  return systemInfo;
}

function parseJellyfinJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw createOperationError("invalid_response", "Jellyfin returned invalid JSON.", ["general"]);
  }
}

function readJellyfinSystemInfo(value: unknown): JellyfinSystemInfo | null {
  if (!isRecord(value)) {
    return null;
  }

  const serverName = readStringField(value, "ServerName");
  const version = readStringField(value, "Version");
  const id = readStringField(value, "Id");
  const startupWizardCompleted = value.StartupWizardCompleted;

  if (!serverName || !version || !id || typeof startupWizardCompleted !== "boolean") {
    return null;
  }

  return { serverName, version, id, startupWizardCompleted };
}

function readStringField(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function createStartupWizardFailure(
  checkedAt: string,
  version: string,
): Extract<JellyfinProbeResponse, { ok: false }> {
  const error = createOperationError(
    "unsupported_version",
    "Jellyfin setup is not complete. Complete the startup wizard first.",
    ["general"],
  );

  return createJellyfinProbeFailure({
    checkedAt,
    error,
    signals: { reachable: true, authenticated: false },
    summary: error.message,
    version,
    connectionState: "setup_required",
  });
}

function createJellyfinProbeErrorFailure(options: {
  checkedAt: string;
  error: unknown;
  step: JellyfinProbeStep;
}): Extract<JellyfinProbeResponse, { ok: false }> {
  const mappedError = mapServiceIntegrationProbeError(options.error, "Jellyfin");

  if (!isServiceIntegrationOperationError(options.error)) {
    const cause =
      options.error instanceof Error
        ? options.error
        : new Error("Unexpected Jellyfin probe failure.");

    logger.error(cause, {
      kind: "jellyfin",
      code: mappedError.code,
    });
  }

  return createJellyfinProbeFailure({
    checkedAt: options.checkedAt,
    error: mappedError,
    signals: readFailureSignals(mappedError, options.step),
  });
}

function createJellyfinProbeFailure(options: {
  checkedAt: string;
  error: ServiceIntegrationOperationError;
  signals: JellyfinFailureSignals;
  summary?: string;
  version?: string | null;
  connectionState?: string | null;
}): Extract<JellyfinProbeResponse, { ok: false }> {
  logServiceIntegrationProbeFailure(logger, "jellyfin", options.error);

  return {
    ok: false,
    error: options.error,
    result: {
      kind: "jellyfin",
      configured: options.signals.configured ?? true,
      enabled: true,
      outcome: "error",
      summary: options.summary ?? options.error.message,
      checkedAt: options.checkedAt,
      reachable: options.signals.reachable,
      authenticated: options.signals.authenticated,
      compatible: false,
      version: options.version ?? null,
      webApiVersion: null,
      connectionState: options.connectionState ?? null,
    },
  };
}

function readFailureSignals(
  error: ServiceIntegrationOperationError,
  step: JellyfinProbeStep,
): JellyfinFailureSignals {
  switch (error.code) {
    case "configuration_incomplete":
      return { configured: false, reachable: false, authenticated: false };
    case "auth_failed":
      return { reachable: true, authenticated: false };
    case "redirect_blocked":
      return { reachable: true, authenticated: false };
    case "invalid_response":
    case "response_too_large":
    case "service_unavailable":
      return { reachable: true, authenticated: step === "authenticated" };
    default:
      return { reachable: false, authenticated: false };
  }
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

function buildSuccessSummary(systemInfo: JellyfinSystemInfo): string {
  return `Connected to ${systemInfo.serverName} ${systemInfo.version}.`;
}
