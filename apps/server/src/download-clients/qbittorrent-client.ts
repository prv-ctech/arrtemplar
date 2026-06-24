import type {
  DownloadClientAuthMode,
  DownloadClientField,
  DownloadClientOperationError,
  DownloadClientProbeResult,
} from "@arrtemplar/shared";
import {
  buildDownloadClientBaseUrl,
  createDownloadClientOperationError,
  createSameOriginHeaders,
  requestDownloadClientText,
} from "./outbound-request-policy";

export type QbittorrentClientConfig = {
  useSsl: boolean;
  host: string;
  port: number;
  urlBase?: string | null;
  authMode: DownloadClientAuthMode;
  username?: string | null;
  apiKey?: string | null;
  password?: string | null;
  timeoutMs?: number;
};

export type QbittorrentProbeResult =
  | { ok: true; result: DownloadClientProbeResult }
  | { ok: false; result: DownloadClientProbeResult; error: DownloadClientOperationError };

export async function probeQbittorrentClient(
  config: QbittorrentClientConfig,
): Promise<QbittorrentProbeResult> {
  const checkedAt = new Date().toISOString();
  const baseUrlResult = buildDownloadClientBaseUrl({
    serviceLabel: "qBittorrent",
    useSsl: config.useSsl,
    host: config.host,
    port: config.port,
    urlBase: config.urlBase,
  });

  if (!baseUrlResult.ok) {
    return createFailure(config, checkedAt, baseUrlResult.error, { configured: false });
  }

  const authResult = await createAuthHeaders(config, baseUrlResult.baseUrl, checkedAt);

  if (!authResult.ok) {
    return authResult.failure;
  }

  try {
    const version = await requestText(baseUrlResult.baseUrl, "api/v2/app/version", authResult);
    const webApiVersionResult = await requestAfterVersion(config, checkedAt, version, () =>
      requestText(baseUrlResult.baseUrl, "api/v2/app/webapiVersion", authResult),
    );

    if (!webApiVersionResult.ok) {
      return webApiVersionResult.failure;
    }

    const webApiVersion = webApiVersionResult.value;
    const transferInfoResult = await requestAfterVersion(config, checkedAt, version, () =>
      requestJson(baseUrlResult.baseUrl, "api/v2/transfer/info", authResult),
    );

    if (!transferInfoResult.ok) {
      return createFailure(config, checkedAt, transferInfoResult.error, {
        reachable: true,
        authenticated: transferInfoResult.error.code !== "auth_failed",
        version,
        webApiVersion,
      });
    }

    const transferInfo = transferInfoResult.value;
    const connectionState = readConnectionState(transferInfo);

    if (!connectionState) {
      return createFailure(config, checkedAt, createOperationError("invalid_response", "general"), {
        reachable: true,
        authenticated: true,
        version,
        webApiVersion,
      });
    }

    return {
      ok: true,
      result: createProbeResult(config, checkedAt, {
        outcome: "success",
        summary: `Connected to qBittorrent ${version}.`,
        reachable: true,
        authenticated: true,
        compatible: true,
        version,
        webApiVersion,
        connectionState,
      }),
    };
  } catch (error) {
    const mappedError = mapFetchError(error, config);

    return createFailure(
      config,
      checkedAt,
      mappedError,
      responseFailureSignals(error, mappedError),
    );
  }
}

type StepRequestResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: DownloadClientOperationError;
      failure: {
        ok: false;
        result: DownloadClientProbeResult;
        error: DownloadClientOperationError;
      };
    };

async function requestAfterVersion<T>(
  config: QbittorrentClientConfig,
  checkedAt: string,
  version: string,
  request: () => Promise<T>,
): Promise<StepRequestResult<T>> {
  try {
    return { ok: true, value: await request() };
  } catch (error) {
    const mappedError = mapFetchError(error, config);

    return {
      ok: false,
      error: mappedError,
      failure: createFailure(config, checkedAt, mappedError, {
        reachable: true,
        authenticated: mappedError.code !== "auth_failed",
        version,
      }),
    };
  }
}

type AuthHeaders = {
  config: QbittorrentClientConfig;
  headers: Headers;
  timeoutMs: number;
};

type AuthResult = { ok: true } & AuthHeaders;

async function createAuthHeaders(
  config: QbittorrentClientConfig,
  baseUrl: URL,
  checkedAt: string,
): Promise<
  | AuthResult
  | {
      ok: false;
      failure: {
        ok: false;
        result: DownloadClientProbeResult;
        error: DownloadClientOperationError;
      };
    }
> {
  const sameOriginHeaders = createSameOriginHeaders(baseUrl);
  const timeoutMs = normalizeTimeout(config.timeoutMs);

  if (config.authMode === "api_key") {
    const apiKey = config.apiKey?.trim();

    if (!apiKey) {
      return {
        ok: false,
        failure: createFailure(
          config,
          checkedAt,
          createOperationError(
            "configuration_incomplete",
            "apiKey",
            "qBittorrent API key is required.",
          ),
          { configured: false },
        ),
      };
    }

    sameOriginHeaders.set("Authorization", `Bearer ${apiKey}`);

    return { ok: true, config, headers: sameOriginHeaders, timeoutMs };
  }

  const username = config.username?.trim();
  const password = config.password ?? "";

  if (!username) {
    return {
      ok: false,
      failure: createFailure(
        config,
        checkedAt,
        createOperationError(
          "configuration_incomplete",
          "username",
          "qBittorrent username is required.",
        ),
        { configured: false },
      ),
    };
  }

  if (!password) {
    return {
      ok: false,
      failure: createFailure(
        config,
        checkedAt,
        createOperationError(
          "configuration_incomplete",
          "password",
          "qBittorrent password is required.",
        ),
        { configured: false },
      ),
    };
  }

  try {
    const loginResult = await requestDownloadClientText({
      baseUrl,
      serviceLabel: "qBittorrent",
      path: "api/v2/auth/login",
      method: "POST",
      headers: sameOriginHeaders,
      body: new URLSearchParams({ username, password }),
      timeoutMs,
    });
    const statusError = mapHttpStatus(loginResult.status, config);

    if (statusError) {
      return {
        ok: false,
        failure: createFailure(
          config,
          checkedAt,
          statusError,
          responseFailureSignals(statusError, statusError),
        ),
      };
    }

    if (loginResult.text === "Fails.") {
      return {
        ok: false,
        failure: createFailure(config, checkedAt, createOperationError("auth_failed", "password"), {
          reachable: true,
          authenticated: false,
        }),
      };
    }

    const cookie = readCookieHeader(loginResult.headers);
    const loginSucceeded =
      loginResult.text === "Ok." || (loginResult.text === "" && Boolean(cookie));

    if (!loginSucceeded) {
      return {
        ok: false,
        failure: createFailure(
          config,
          checkedAt,
          createOperationError("invalid_response", "general"),
          { reachable: true, authenticated: false },
        ),
      };
    }

    if (!cookie) {
      return {
        ok: false,
        failure: createFailure(
          config,
          checkedAt,
          createOperationError("invalid_response", "general"),
          { reachable: true, authenticated: true },
        ),
      };
    }

    sameOriginHeaders.set("Cookie", cookie);

    return { ok: true, config, headers: sameOriginHeaders, timeoutMs };
  } catch (error) {
    return { ok: false, failure: createFailure(config, checkedAt, mapFetchError(error, config)) };
  }
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return 5000;
  }

  return Math.max(1, Math.floor(timeoutMs));
}

async function requestText(baseUrl: URL, path: string, auth: AuthHeaders): Promise<string> {
  const response = await requestDownloadClientText({
    baseUrl,
    serviceLabel: "qBittorrent",
    path,
    headers: auth.headers,
    timeoutMs: auth.timeoutMs,
  });
  const statusError = mapHttpStatus(response.status, auth.config);

  if (statusError) {
    throw statusError;
  }

  if (!response.text) {
    throw createOperationError("invalid_response", "general");
  }

  return response.text;
}

async function requestJson(baseUrl: URL, path: string, auth: AuthHeaders): Promise<unknown> {
  const response = await requestDownloadClientText({
    baseUrl,
    serviceLabel: "qBittorrent",
    path,
    headers: auth.headers,
    timeoutMs: auth.timeoutMs,
  });
  const statusError = mapHttpStatus(response.status, auth.config);

  if (statusError) {
    throw statusError;
  }

  try {
    return JSON.parse(response.text) as unknown;
  } catch {
    throw createOperationError("invalid_response", "general");
  }
}

function readConnectionState(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return typeof value.connection_status === "string" ? value.connection_status : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readCookieHeader(headers: Headers): string | null {
  const setCookie = headers.get("set-cookie");

  if (!setCookie) {
    return null;
  }

  const [cookie] = setCookie.split(";", 1);

  return cookie?.trim() || null;
}

function mapHttpStatus(
  status: number,
  config: QbittorrentClientConfig,
): DownloadClientOperationError | null {
  if (status >= 300 && status < 400) {
    return createOperationError(
      "redirect_blocked",
      "general",
      "qBittorrent redirected the request.",
    );
  }

  if (status === 401 || status === 403) {
    return createOperationError("auth_failed", credentialField(config.authMode));
  }

  if (status >= 500) {
    return createOperationError(
      "service_unavailable",
      "general",
      `qBittorrent returned HTTP ${status}.`,
    );
  }

  if (status >= 400) {
    return createOperationError(
      "connection_failed",
      "general",
      `qBittorrent returned HTTP ${status}.`,
    );
  }

  return null;
}

function mapFetchError(
  error: unknown,
  _config: QbittorrentClientConfig,
): DownloadClientOperationError {
  if (isOperationError(error)) {
    return error;
  }

  if (isAbortError(error)) {
    return createOperationError("timeout", "general");
  }

  if (error instanceof TypeError) {
    return createOperationError("connection_failed", "general");
  }

  return createOperationError("connection_failed", "general");
}

function responseFailureSignals(
  error: unknown,
  mappedError?: DownloadClientOperationError,
): FailureSignals | undefined {
  const operationError = mappedError ?? (isOperationError(error) ? error : null);

  if (!operationError || !isOperationError(error)) {
    return undefined;
  }

  switch (operationError.code) {
    case "auth_failed":
      return { reachable: true, authenticated: false };
    case "service_unavailable":
    case "invalid_response":
    case "redirect_blocked":
      return { reachable: true, authenticated: true };
    case "configuration_incomplete":
      return { configured: false, reachable: false, authenticated: false };
    default:
      return { reachable: false, authenticated: false };
  }
}

function isOperationError(error: unknown): error is DownloadClientOperationError {
  if (!isRecord(error)) {
    return false;
  }

  return typeof error.code === "string" && typeof error.message === "string";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

type FailureSignals = {
  configured?: boolean;
  reachable?: boolean;
  authenticated?: boolean;
  compatible?: boolean;
  version?: string | null;
  webApiVersion?: string | null;
  connectionState?: string | null;
};

function createFailure(
  config: QbittorrentClientConfig,
  checkedAt: string,
  error: DownloadClientOperationError,
  signals: FailureSignals = {},
): { ok: false; result: DownloadClientProbeResult; error: DownloadClientOperationError } {
  return {
    ok: false,
    error,
    result: createProbeResult(config, checkedAt, {
      outcome: "error",
      summary: error.message,
      configured: signals.configured ?? true,
      reachable: signals.reachable ?? false,
      authenticated: signals.authenticated ?? false,
      compatible: signals.compatible ?? false,
      version: signals.version ?? null,
      webApiVersion: signals.webApiVersion ?? null,
      connectionState: signals.connectionState ?? null,
    }),
  };
}

type ProbeResultInput = {
  outcome: DownloadClientProbeResult["outcome"];
  summary: string;
  configured?: boolean;
  reachable: boolean;
  authenticated: boolean;
  compatible: boolean;
  version?: string | null;
  webApiVersion?: string | null;
  connectionState?: string | null;
};

function createProbeResult(
  _config: QbittorrentClientConfig,
  checkedAt: string,
  input: ProbeResultInput,
): DownloadClientProbeResult {
  return {
    kind: "qbittorrent",
    configured: input.configured ?? true,
    enabled: true,
    outcome: input.outcome,
    summary: input.summary,
    checkedAt,
    reachable: input.reachable,
    authenticated: input.authenticated,
    compatible: input.compatible,
    version: input.version ?? null,
    webApiVersion: input.webApiVersion ?? null,
    connectionState: input.connectionState ?? null,
  };
}

function createOperationError(
  code: DownloadClientOperationError["code"],
  field: DownloadClientField,
  message = defaultErrorMessage(code),
): DownloadClientOperationError {
  return createDownloadClientOperationError(code, message, [field]);
}

function credentialField(authMode: DownloadClientAuthMode): DownloadClientField {
  return authMode === "api_key" ? "apiKey" : "password";
}

function defaultErrorMessage(code: DownloadClientOperationError["code"]): string {
  switch (code) {
    case "configuration_incomplete":
      return "qBittorrent configuration is incomplete.";
    case "invalid_host":
      return "qBittorrent host is invalid.";
    case "invalid_port":
      return "qBittorrent port must be between 1 and 65535.";
    case "invalid_url_base":
      return "qBittorrent URL base must be a path that starts with /.";
    case "redirect_blocked":
      return "qBittorrent redirected the request.";
    case "timeout":
      return "qBittorrent did not respond before the timeout.";
    case "auth_failed":
      return "qBittorrent rejected the credentials.";
    case "connection_failed":
      return "Could not connect to qBittorrent.";
    case "invalid_response":
      return "qBittorrent returned an invalid response.";
    case "service_unavailable":
      return "qBittorrent is unavailable.";
    case "invalid_scheme":
    case "disallowed_target":
    case "response_too_large":
    case "unsupported_version":
      return "qBittorrent connection failed.";
  }
}
