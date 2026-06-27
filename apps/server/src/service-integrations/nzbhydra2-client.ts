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
  type ServiceIntegrationTextResponse,
} from "./outbound-request-policy";
import {
  createServiceIntegrationProbeErrorFailure,
  isRecord,
  isServiceIntegrationJsonResponse,
  mapServiceIntegrationStatusCode,
  normalizeServiceIntegrationText,
  prepareApiKeyOnlyProbe,
  readServiceIntegrationStringField,
  readServiceIntegrationXmlAttribute,
} from "./probe-helpers";

const logger = getLogger([APP_LOG_CATEGORY, "service-integrations", "nzbhydra2"]);

export type Nzbhydra2ClientConfig = {
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

export type Nzbhydra2ProbeResponse =
  | { ok: true; result: ServiceIntegrationProbeResult }
  | { ok: false; result: ServiceIntegrationProbeResult; error: ServiceIntegrationOperationError };

type Nzbhydra2Caps = {
  title: string | null;
  version: string | null;
};

export async function probeNzbhydra2Client(
  config: Nzbhydra2ClientConfig,
): Promise<Nzbhydra2ProbeResponse> {
  const checkedAt = new Date().toISOString();
  const preparedProbe = prepareApiKeyOnlyProbe(config, {
    kind: "nzbhydra2",
    serviceLabel: "NZBHydra2",
    checkedAt,
    logger,
  });

  if (!preparedProbe.ok) {
    return preparedProbe.failure;
  }

  const { apiKey, baseUrl, timeoutMs } = preparedProbe;
  const headers = createCapsHeaders(baseUrl);

  try {
    const response = await requestNzbhydra2Caps(baseUrl, apiKey, headers, timeoutMs);
    const apiError = mapNzbhydra2ApiError(response.text, response.headers);

    if (apiError) {
      throw apiError;
    }

    const caps = parseCapsResponse(response.text, response.headers);

    if (!caps) {
      throw createOperationError("invalid_response", "NZBHydra2 caps response was invalid.", [
        "general",
      ]);
    }

    logger.info("NZBHydra2 probe succeeded.", {
      title: caps.title,
      version: caps.version,
    });

    return {
      ok: true,
      result: {
        kind: "nzbhydra2",
        configured: true,
        enabled: true,
        outcome: "success",
        summary: buildSuccessSummary(caps),
        checkedAt,
        reachable: true,
        authenticated: true,
        compatible: true,
        version: caps.version,
        webApiVersion: null,
        connectionState: "connected",
      },
    };
  } catch (error) {
    return createServiceIntegrationProbeErrorFailure({
      kind: "nzbhydra2",
      serviceLabel: "NZBHydra2",
      checkedAt,
      logger,
      error,
    });
  }
}

function createCapsHeaders(baseUrl: URL): Headers {
  const headers = createSameOriginHeaders(baseUrl);

  headers.set("accept", "application/xml, application/json;q=0.9");

  return headers;
}

async function requestNzbhydra2Caps(
  baseUrl: URL,
  apiKey: string,
  headers: Headers,
  timeoutMs: number,
): Promise<ServiceIntegrationTextResponse> {
  const path = createCapsRequestPath(apiKey);
  const url = createRedactedCapsUrl(baseUrl);

  logger.debug("NZBHydra2 probe step {step} started.", {
    kind: "nzbhydra2",
    step: "caps",
    timeoutMs,
    url,
  });

  const response = await requestServiceIntegrationText({
    baseUrl,
    serviceLabel: "NZBHydra2",
    path,
    headers,
    timeoutMs,
  });
  const statusError = mapServiceIntegrationStatusCode(response.status, "NZBHydra2");

  if (statusError) {
    throw statusError;
  }

  return response;
}

function createCapsRequestPath(apiKey: string): string {
  const searchParams = new URLSearchParams();

  searchParams.set("t", "caps");
  searchParams.set("apikey", apiKey);

  return `torznab/api?${searchParams.toString()}`;
}

function createRedactedCapsUrl(baseUrl: URL): string {
  const url = new URL("torznab/api", baseUrl);

  url.searchParams.set("t", "caps");

  return url.toString();
}

function parseCapsResponse(text: string, headers: Headers): Nzbhydra2Caps | null {
  const body = text.trim();

  if (!body) {
    return null;
  }

  if (isServiceIntegrationJsonResponse(body, headers, { allowJsonArray: true })) {
    return parseJsonCaps(body);
  }

  return parseXmlCaps(body);
}

function mapNzbhydra2ApiError(
  text: string,
  headers: Headers,
): ServiceIntegrationOperationError | null {
  const body = text.trim();

  if (!body) {
    return null;
  }

  const errorMessage = isServiceIntegrationJsonResponse(body, headers, { allowJsonArray: true })
    ? readJsonErrorMessage(body)
    : readXmlErrorMessage(body);

  if (!errorMessage) {
    return null;
  }

  if (/api\s*key|apikey|unauthori[sz]ed|forbidden/iu.test(errorMessage)) {
    return createOperationError("auth_failed", "NZBHydra2 rejected the API key.", ["apiKey"]);
  }

  return createOperationError("invalid_response", "NZBHydra2 returned an error response.", [
    "general",
  ]);
}

function readJsonErrorMessage(body: string): string | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if (typeof parsed.error === "string") {
    return normalizeServiceIntegrationText(parsed.error);
  }

  const error = isRecord(parsed.error) ? parsed.error : parsed;

  return (
    readServiceIntegrationStringField(error, "description") ??
    readServiceIntegrationStringField(error, "message") ??
    readServiceIntegrationStringField(error, "error")
  );
}

function readXmlErrorMessage(body: string): string | null {
  const match = /<\s*error\b([^>]*)\/?\s*>/iu.exec(body);

  if (!match) {
    return null;
  }

  const attributes = match[1] ?? "";

  return (
    readServiceIntegrationXmlAttribute(attributes, "description") ??
    normalizeServiceIntegrationText(body)
  );
}

function parseJsonCaps(body: string): Nzbhydra2Caps | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  return readJsonCaps(parsed);
}

function readJsonCaps(value: unknown): Nzbhydra2Caps | null {
  if (!isRecord(value)) {
    return null;
  }

  const server = isRecord(value.server) ? value.server : null;
  const hasCapsMarker =
    isRecord(value.caps) ||
    server !== null ||
    isRecord(value.searching) ||
    isRecord(value.categories);

  if (!hasCapsMarker) {
    return null;
  }

  return {
    title:
      readServiceIntegrationStringField(server, "title") ??
      readServiceIntegrationStringField(value, "title"),
    version:
      readServiceIntegrationStringField(server, "version") ??
      readServiceIntegrationStringField(value, "version"),
  };
}

function parseXmlCaps(body: string): Nzbhydra2Caps | null {
  if (!hasCapsElement(body)) {
    return null;
  }

  const serverAttributes = readServerAttributes(body);

  return {
    title: serverAttributes ? readServiceIntegrationXmlAttribute(serverAttributes, "title") : null,
    version: serverAttributes
      ? readServiceIntegrationXmlAttribute(serverAttributes, "version")
      : null,
  };
}

function hasCapsElement(body: string): boolean {
  return (
    /<\s*caps(?:\s[^>]*)?>[\s\S]*<\s*\/\s*caps\s*>/iu.test(body) ||
    /<\s*caps(?:\s[^>]*)?\/\s*>/iu.test(body)
  );
}

function readServerAttributes(body: string): string | null {
  const match = /<\s*server\b([^>]*)\/?>/iu.exec(body);

  return match?.[1] ?? null;
}

function buildSuccessSummary(caps: Nzbhydra2Caps): string {
  const title = caps.title ?? "NZBHydra2";

  if (caps.version) {
    return `Connected to ${title} ${caps.version}.`;
  }

  return `Connected to ${title}.`;
}
