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
  mapServiceIntegrationStatusCode,
  prepareApiKeyOnlyProbe,
} from "./probe-helpers";

const logger = getLogger([APP_LOG_CATEGORY, "service-integrations", "jackett"]);
const configuredIndexersPath = "api/v2.0/indexers/all/results/torznab/api";

export type JackettClientConfig = {
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

export type JackettProbeResponse =
  | { ok: true; result: ServiceIntegrationProbeResult }
  | { ok: false; result: ServiceIntegrationProbeResult; error: ServiceIntegrationOperationError };

type JackettIndexerMetadata = {
  indexerCount: number;
};

export async function probeJackettClient(
  config: JackettClientConfig,
): Promise<JackettProbeResponse> {
  const checkedAt = new Date().toISOString();
  const preparedProbe = prepareApiKeyOnlyProbe(config, {
    kind: "jackett",
    serviceLabel: "Jackett",
    checkedAt,
    logger,
  });

  if (!preparedProbe.ok) {
    return preparedProbe.failure;
  }

  const { apiKey, baseUrl, timeoutMs } = preparedProbe;
  const requestPath = buildConfiguredIndexersPath(apiKey);
  const requestUrl = new URL(requestPath, baseUrl);

  logger.debug("Jackett probe step {step} started.", () => ({
    kind: "jackett",
    step: "configured-indexers",
    timeoutMs,
    url: redactSensitiveQueryParams(requestUrl),
  }));

  try {
    const response = await requestServiceIntegrationText({
      baseUrl,
      serviceLabel: "Jackett",
      path: requestPath,
      headers: createJackettHeaders(baseUrl),
      timeoutMs,
    });
    const statusError = mapServiceIntegrationStatusCode(response.status, "Jackett");

    if (statusError) {
      throw statusError;
    }

    const xmlError = mapJackettXmlError(response.text);

    if (xmlError) {
      throw xmlError;
    }

    const metadata = readIndexerMetadata(response.text);

    if (!metadata) {
      throw createOperationError("invalid_response", "Jackett indexer response was invalid.", [
        "general",
      ]);
    }

    logger.info("Jackett probe succeeded with {indexerCount} indexers.", {
      indexerCount: metadata.indexerCount,
    });

    return {
      ok: true,
      result: {
        kind: "jackett",
        configured: true,
        enabled: true,
        outcome: "success",
        summary: buildSuccessSummary(metadata.indexerCount),
        checkedAt,
        reachable: true,
        authenticated: true,
        compatible: true,
        version: null,
        webApiVersion: null,
        connectionState: "connected",
      },
    };
  } catch (error) {
    return createServiceIntegrationProbeErrorFailure({
      kind: "jackett",
      serviceLabel: "Jackett",
      checkedAt,
      logger,
      error,
    });
  }
}

function createJackettHeaders(baseUrl: URL): Headers {
  const headers = createSameOriginHeaders(baseUrl);

  headers.set("accept", "application/xml, text/xml, */*");

  return headers;
}

function buildConfiguredIndexersPath(apiKey: string): string {
  const params = new URLSearchParams({
    t: "indexers",
    configured: "true",
    apikey: apiKey,
  });

  return `${configuredIndexersPath}?${params.toString()}`;
}

function redactSensitiveQueryParams(url: URL): string {
  const redactedUrl = new URL(url);

  redactedUrl.searchParams.delete("apikey");
  redactedUrl.searchParams.delete("passkey");

  return redactedUrl.toString();
}

function readIndexerMetadata(xml: string): JackettIndexerMetadata | null {
  const trimmed = xml.trim();

  if (!looksLikeXml(trimmed)) {
    return null;
  }

  if (/<indexers\b[^>]*\/>/iu.test(trimmed)) {
    return { indexerCount: 0 };
  }

  if (!/<indexers\b[^>]*>/iu.test(trimmed) || !/<\/indexers>/iu.test(trimmed)) {
    return null;
  }

  return { indexerCount: countIndexerElements(trimmed) };
}

function looksLikeXml(value: string): boolean {
  return value.startsWith("<") && /<\/?[a-z][\w:.-]*(?:\s|>|\/)/iu.test(value);
}

function countIndexerElements(xml: string): number {
  return xml.match(/<indexer(?:\s|>)/giu)?.length ?? 0;
}

function mapJackettXmlError(xml: string): ServiceIntegrationOperationError | null {
  if (!/<error\b/iu.test(xml)) {
    return null;
  }

  if (/api\s*key|apikey|passkey|unauthori[sz]ed|forbidden/iu.test(xml)) {
    return createOperationError("auth_failed", "Jackett rejected the API key.", ["apiKey"]);
  }

  return createOperationError("invalid_response", "Jackett returned an error response.", [
    "general",
  ]);
}

function buildSuccessSummary(indexerCount: number): string {
  return `Connected to Jackett. Configured indexers: ${indexerCount}.`;
}
