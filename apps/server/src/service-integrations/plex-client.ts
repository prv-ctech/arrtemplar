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
  createServiceIntegrationProbeErrorFailure,
  isRecord,
  isServiceIntegrationJsonResponse,
  mapServiceIntegrationStatusCode,
  prepareApiKeyOnlyProbe,
  readServiceIntegrationStringField,
  readServiceIntegrationXmlAttribute,
} from "./probe-helpers";

const logger = getLogger([APP_LOG_CATEGORY, "service-integrations", "plex"]);

export type PlexClientConfig = {
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

export type PlexProbeResponse =
  | { ok: true; result: ServiceIntegrationProbeResult }
  | { ok: false; result: ServiceIntegrationProbeResult; error: ServiceIntegrationOperationError };

type PlexServerInfo = {
  friendlyName: string | null;
  machineIdentifier: string;
  version: string | null;
};

export async function probePlexClient(config: PlexClientConfig): Promise<PlexProbeResponse> {
  const checkedAt = new Date().toISOString();
  const preparedProbe = prepareApiKeyOnlyProbe(config, {
    kind: "plex",
    serviceLabel: "Plex",
    checkedAt,
    logger,
  });

  if (!preparedProbe.ok) {
    return preparedProbe.failure;
  }

  const { apiKey, baseUrl, timeoutMs } = preparedProbe;

  try {
    await requestPlexServerInfo({
      baseUrl,
      path: "identity",
      step: "identity",
      timeoutMs,
      headers: createPlexHeaders(baseUrl),
      requireVersion: false,
    });
    const rootInfo = await requestPlexServerInfo({
      baseUrl,
      path: "",
      step: "root",
      timeoutMs,
      headers: createPlexHeaders(baseUrl, apiKey),
      requireVersion: true,
    });
    const version = rootInfo.version;

    if (!version) {
      throw createOperationError("invalid_response", "Plex root response was invalid.", [
        "general",
      ]);
    }

    logger.info("Plex probe succeeded with version {version}.", {
      version,
      friendlyName: rootInfo.friendlyName,
    });

    return {
      ok: true,
      result: {
        kind: "plex",
        configured: true,
        enabled: true,
        outcome: "success",
        summary: buildSuccessSummary(rootInfo),
        checkedAt,
        reachable: true,
        authenticated: true,
        compatible: true,
        version,
        webApiVersion: null,
        connectionState: "connected",
      },
    };
  } catch (error) {
    return createServiceIntegrationProbeErrorFailure({
      kind: "plex",
      serviceLabel: "Plex",
      checkedAt,
      logger,
      error,
      responseTooLargeAuthenticated: false,
    });
  }
}

function createPlexHeaders(baseUrl: URL, apiKey?: string): Headers {
  const headers = createSameOriginHeaders(baseUrl);

  headers.set("Accept", "application/json");
  headers.set("X-Plex-Client-Identifier", "arrtemplar");
  headers.set("X-Plex-Product", "Arrtemplar");
  headers.set("X-Plex-Version", APP_VERSION);

  if (apiKey) {
    headers.set("X-Plex-Token", apiKey);
  }

  return headers;
}

async function requestPlexServerInfo(options: {
  baseUrl: URL;
  path: string;
  step: "identity" | "root";
  timeoutMs: number;
  headers: Headers;
  requireVersion: boolean;
}): Promise<PlexServerInfo> {
  const url = new URL(options.path, options.baseUrl).toString();

  logger.debug("Plex probe step {step} started.", {
    kind: "plex",
    step: options.step,
    timeoutMs: options.timeoutMs,
    url,
  });

  const response = await requestServiceIntegrationText({
    baseUrl: options.baseUrl,
    serviceLabel: "Plex",
    path: options.path,
    headers: options.headers,
    timeoutMs: options.timeoutMs,
  });
  const statusError = mapServiceIntegrationStatusCode(response.status, "Plex");

  if (statusError) {
    throw statusError;
  }

  const serverInfo = parsePlexServerInfo(response.text, response.headers);

  if (!serverInfo || (options.requireVersion && !serverInfo.version)) {
    throw createOperationError(`invalid_response`, `Plex ${options.step} response was invalid.`, [
      "general",
    ]);
  }

  return serverInfo;
}

function parsePlexServerInfo(text: string, headers: Headers): PlexServerInfo | null {
  const body = text.trim();

  if (!body) {
    return null;
  }

  if (isServiceIntegrationJsonResponse(body, headers)) {
    return parsePlexJson(body);
  }

  return parsePlexXml(body);
}

function parsePlexJson(body: string): PlexServerInfo | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const mediaContainer = isRecord(parsed.MediaContainer) ? parsed.MediaContainer : parsed;

  return readPlexRecord(mediaContainer);
}

function parsePlexXml(body: string): PlexServerInfo | null {
  if (!/^<\??xml\b|<\s*MediaContainer\b/iu.test(body)) {
    return null;
  }

  const match = /<\s*MediaContainer\b([^>]*)>/iu.exec(body);
  const attributes = match?.[1];

  if (!attributes) {
    return null;
  }

  const machineIdentifier = readServiceIntegrationXmlAttribute(attributes, "machineIdentifier");

  if (!machineIdentifier) {
    return null;
  }

  return {
    friendlyName: readServiceIntegrationXmlAttribute(attributes, "friendlyName"),
    machineIdentifier,
    version: readServiceIntegrationXmlAttribute(attributes, "version"),
  };
}

function readPlexRecord(record: Record<string, unknown>): PlexServerInfo | null {
  const machineIdentifier = readServiceIntegrationStringField(record, "machineIdentifier");

  if (!machineIdentifier) {
    return null;
  }

  return {
    friendlyName: readServiceIntegrationStringField(record, "friendlyName"),
    machineIdentifier,
    version: readServiceIntegrationStringField(record, "version"),
  };
}

function buildSuccessSummary(info: PlexServerInfo): string {
  const serverName = info.friendlyName ?? "Plex";

  if (info.version) {
    return `Connected to ${serverName} ${info.version}.`;
  }

  return `Connected to ${serverName}.`;
}
