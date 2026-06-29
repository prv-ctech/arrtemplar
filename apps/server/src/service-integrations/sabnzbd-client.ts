import type {
  ServiceIntegrationAuthMode,
  ServiceIntegrationField,
  ServiceIntegrationOperationError,
  ServiceIntegrationProbeResult,
} from "@arrtemplar/shared";
import {
  buildServiceIntegrationBaseUrl,
  createServiceIntegrationOperationError,
  requestServiceIntegrationText,
} from "./outbound-request-policy";

const API_KEY_REQUIRED_TEXT = "API Key Required";
const API_KEY_INCORRECT_TEXT = "API Key Incorrect";

export type SabnzbdClientSettings = {
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

export type SabnzbdClientProbeResponse =
  | { ok: true; result: ServiceIntegrationProbeResult }
  | { ok: false; result: ServiceIntegrationProbeResult; error: ServiceIntegrationOperationError };

type SabnzbdApiMode = "version" | "status";

type SabnzbdJsonResponse =
  | { ok: true; body: unknown }
  | {
      ok: false;
      error: ServiceIntegrationOperationError;
      reachable: boolean;
      authenticated: boolean;
    };

export async function probeSabnzbdClient(
  settings: SabnzbdClientSettings,
): Promise<SabnzbdClientProbeResponse> {
  const checkedAt = new Date().toISOString();
  const baseUrlResult = buildServiceIntegrationBaseUrl({
    serviceLabel: "SABnzbd",
    useSsl: settings.useSsl,
    host: settings.host,
    port: settings.port,
    urlBase: settings.urlBase,
  });

  if (!baseUrlResult.ok) {
    return createFailureResult({
      checkedAt,
      error: baseUrlResult.error,
      configured: false,
      reachable: false,
    });
  }

  const credentialError = validateConfiguredCredentials(settings);

  if (credentialError) {
    return createFailureResult({
      checkedAt,
      error: credentialError,
      configured: false,
      reachable: false,
    });
  }

  const versionResponse = await fetchSabnzbdJson(settings, baseUrlResult.baseUrl, "version");

  if (!versionResponse.ok) {
    return createFailureResult({
      checkedAt,
      error: versionResponse.error,
      reachable: versionResponse.reachable,
      authenticated: versionResponse.authenticated,
    });
  }

  const version = readVersion(versionResponse.body);

  if (!version) {
    return createFailureResult({
      checkedAt,
      error: createOperationError(
        "invalid_response",
        "SABnzbd version response was not valid JSON.",
      ),
      reachable: true,
    });
  }

  const statusResponse = await fetchSabnzbdJson(settings, baseUrlResult.baseUrl, "status");

  if (!statusResponse.ok) {
    return createFailureResult({
      checkedAt,
      error: statusResponse.error,
      reachable: statusResponse.reachable,
      authenticated: statusResponse.authenticated,
      version,
    });
  }

  if (!isRecord(statusResponse.body)) {
    return createFailureResult({
      checkedAt,
      error: createOperationError("invalid_response", "SABnzbd status response was invalid."),
      reachable: true,
      version,
    });
  }

  return {
    ok: true,
    result: createProbeResult({
      checkedAt,
      outcome: "success",
      summary: "SABnzbd connection succeeded.",
      reachable: true,
      authenticated: true,
      compatible: true,
      version,
      connectionState: "connected",
    }),
  };
}

async function fetchSabnzbdJson(
  settings: SabnzbdClientSettings,
  baseUrl: URL,
  mode: SabnzbdApiMode,
): Promise<SabnzbdJsonResponse> {
  let response: Awaited<ReturnType<typeof requestServiceIntegrationText>>;

  try {
    response = await requestServiceIntegrationText({
      baseUrl,
      serviceLabel: "SABnzbd",
      path: buildSabnzbdApiPath(settings, mode),
      headers: { accept: "application/json" },
      timeoutMs: settings.timeoutMs,
    });
  } catch (error) {
    if (isOperationError(error)) {
      return {
        ok: false,
        error,
        reachable: error.code !== "timeout" && error.code !== "connection_failed",
        authenticated: false,
      };
    }

    return {
      ok: false,
      error: createOperationError("connection_failed", "SABnzbd could not be reached."),
      reachable: false,
      authenticated: false,
    };
  }

  const bodyText = response.text;
  const responseTextCredentialError = createCredentialTextError(bodyText);

  if (responseTextCredentialError) {
    return {
      ok: false,
      error: responseTextCredentialError,
      reachable: true,
      authenticated: false,
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: createRejectedCredentialError(settings.authMode),
      reachable: true,
      authenticated: false,
    };
  }

  if (response.status < 200 || response.status >= 300) {
    return {
      ok: false,
      error: createOperationError("service_unavailable", "SABnzbd returned an error response."),
      reachable: true,
      authenticated: false,
    };
  }

  try {
    return { ok: true, body: JSON.parse(bodyText) };
  } catch {
    return {
      ok: false,
      error: createOperationError("invalid_response", "SABnzbd returned invalid JSON."),
      reachable: true,
      authenticated: false,
    };
  }
}

function buildSabnzbdApiPath(settings: SabnzbdClientSettings, mode: SabnzbdApiMode): string {
  const url = new URL(composeApiPath(settings.urlBase), "http://sabnzbd.local");

  url.searchParams.set("mode", mode);
  url.searchParams.set("output", "json");
  appendConfiguredCredentials(url, settings);

  return `${url.pathname}${url.search}`;
}

function composeApiPath(urlBase: string | null | undefined): string {
  if (!urlBase) {
    return "/api";
  }

  const normalizedUrlBase = urlBase.trim().replace(/^\/+|\/+$/g, "");

  if (!normalizedUrlBase) {
    return "/api";
  }

  return `/${normalizedUrlBase}/api`;
}

function appendConfiguredCredentials(url: URL, settings: SabnzbdClientSettings): void {
  if (settings.authMode === "api_key") {
    if (hasConfiguredValue(settings.apiKey)) {
      url.searchParams.set("apikey", settings.apiKey);
    }

    return;
  }

  if (hasConfiguredValue(settings.username)) {
    url.searchParams.set("ma_username", settings.username);
  }

  if (hasConfiguredValue(settings.password)) {
    url.searchParams.set("ma_password", settings.password);
  }
}

function validateConfiguredCredentials(
  settings: SabnzbdClientSettings,
): ServiceIntegrationOperationError | null {
  if (settings.authMode === "api_key" && !hasConfiguredValue(settings.apiKey)) {
    return createOperationError("auth_failed", "SABnzbd API key is required.", ["apiKey"]);
  }

  if (settings.authMode === "username_password") {
    const missingFields: ServiceIntegrationField[] = [];

    if (!hasConfiguredValue(settings.username)) {
      missingFields.push("username");
    }

    if (!hasConfiguredValue(settings.password)) {
      missingFields.push("password");
    }

    if (missingFields.length > 0) {
      return createOperationError(
        "auth_failed",
        "SABnzbd username and password are required.",
        missingFields,
      );
    }
  }

  return null;
}

function createCredentialTextError(bodyText: string): ServiceIntegrationOperationError | null {
  if (bodyText.includes(API_KEY_REQUIRED_TEXT)) {
    return createOperationError("auth_failed", "SABnzbd API key is required.", ["apiKey"]);
  }

  if (bodyText.includes(API_KEY_INCORRECT_TEXT)) {
    return createOperationError("auth_failed", "SABnzbd API key was rejected.", ["apiKey"]);
  }

  return null;
}

function createRejectedCredentialError(
  authMode: ServiceIntegrationAuthMode,
): ServiceIntegrationOperationError {
  if (authMode === "api_key") {
    return createOperationError("auth_failed", "SABnzbd API key was rejected.", ["apiKey"]);
  }

  return createOperationError("auth_failed", "SABnzbd username or password was rejected.", [
    "username",
    "password",
  ]);
}

function createFailureResult({
  checkedAt,
  error,
  configured = true,
  reachable,
  authenticated = false,
  version = null,
  connectionState = null,
}: {
  checkedAt: string;
  error: ServiceIntegrationOperationError;
  configured?: boolean;
  reachable: boolean;
  authenticated?: boolean;
  version?: string | null;
  connectionState?: string | null;
}): SabnzbdClientProbeResponse {
  return {
    ok: false,
    error,
    result: createProbeResult({
      checkedAt,
      outcome: "error",
      summary: error.message,
      configured,
      reachable,
      authenticated,
      compatible: false,
      version,
      connectionState,
    }),
  };
}

function createProbeResult({
  checkedAt,
  outcome,
  summary,
  configured = true,
  reachable,
  authenticated,
  compatible,
  version,
  connectionState,
}: {
  checkedAt: string;
  outcome: ServiceIntegrationProbeResult["outcome"];
  summary: string;
  configured?: boolean;
  reachable: boolean;
  authenticated: boolean;
  compatible: boolean;
  version: string | null;
  connectionState: string | null;
}): ServiceIntegrationProbeResult {
  return {
    kind: "sabnzbd",
    configured,
    enabled: true,
    outcome,
    summary,
    checkedAt,
    reachable,
    authenticated,
    compatible,
    version,
    webApiVersion: null,
    connectionState,
  };
}

function createOperationError(
  code: ServiceIntegrationOperationError["code"],
  message: string,
  fields: ServiceIntegrationField[] = [],
): ServiceIntegrationOperationError {
  return createServiceIntegrationOperationError(code, message, fields);
}

function readVersion(body: unknown): string | null {
  if (!isRecord(body) || typeof body.version !== "string" || body.version.length === 0) {
    return null;
  }

  return body.version;
}

function hasConfiguredValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
