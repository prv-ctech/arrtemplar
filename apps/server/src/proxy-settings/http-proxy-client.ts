import { Buffer } from "node:buffer";
import {
  APP_LOG_CATEGORY,
  type HttpProxyScheme,
  type ProxyProfileTestResult,
} from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";
import {
  assertResolvedHostAllowedForOutboundTarget,
  buildValidatedBaseUrl,
  OutboundRequestPolicyError,
} from "../outbound/request-target-policy";

const logger = getLogger([APP_LOG_CATEGORY, "settings", "proxies", "http-proxy"]);
const defaultCanaryUrl = "https://example.com/";

type ProxyFetchInit = RequestInit & {
  proxy?: string | { url: string; headers?: HeadersInit };
};

type ProxyFetch = (input: string | URL, init: ProxyFetchInit) => Promise<Response>;

export type HttpProxyTestInput = {
  proxyProfileId: string;
  scheme: HttpProxyScheme;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  timeoutMs: number;
};

export type HttpProxyTestDependencies = {
  canaryUrl?: string;
  fetch?: ProxyFetch;
  now?: () => string;
};

export async function testHttpProxyConnection(
  input: HttpProxyTestInput,
  dependencies: HttpProxyTestDependencies = {},
): Promise<ProxyProfileTestResult> {
  const fetchImpl = dependencies.fetch ?? (fetch as ProxyFetch);
  const now = dependencies.now ?? (() => new Date().toISOString());
  const canaryUrl = dependencies.canaryUrl ?? defaultCanaryUrl;
  const hasCredentials = Boolean(input.username || input.password);

  logger.debug("HTTP proxy test started for {proxyProfileId}.", {
    event: "settings.proxies.http_proxy.test.started",
    proxyProfileId: input.proxyProfileId,
    scheme: input.scheme,
    host: input.host,
    port: input.port,
    timeoutMs: input.timeoutMs,
    hasCredentials,
  });

  const proxyBaseUrl = tryBuildProxyBaseUrl(input, now);

  if (!proxyBaseUrl.ok) {
    return proxyBaseUrl.result;
  }

  try {
    await assertResolvedHostAllowedForOutboundTarget(proxyBaseUrl.value.hostname, "HTTP proxy");
  } catch (error) {
    if (error instanceof OutboundRequestPolicyError) {
      return createFailureResult(input, {
        message: error.message,
        now,
        reason: error.code,
        step: "resolve",
      });
    }

    throw error;
  }

  const startedAt = performance.now();

  try {
    const response = await fetchImpl(
      canaryUrl,
      buildProxyFetchInit(input, proxyBaseUrl.value.origin, hasCredentials),
    );
    const responseTimeMs = Math.round(performance.now() - startedAt);

    if (response.status >= 200 && response.status < 400) {
      logger.info("HTTP proxy test succeeded for {proxyProfileId}.", {
        event: "settings.proxies.http_proxy.test.succeeded",
        proxyProfileId: input.proxyProfileId,
        statusCode: response.status,
        responseTimeMs,
      });

      return {
        profileId: input.proxyProfileId,
        kind: "http_proxy",
        outcome: "success",
        message: `HTTP proxy reached ${new URL(canaryUrl).host}.`,
        testedAt: now(),
        statusCode: response.status,
        responseTimeMs,
      };
    }

    return createFailureResult(input, {
      message: `HTTP proxy canary returned HTTP ${response.status}.`,
      now,
      reason: `http_${response.status}`,
      responseTimeMs,
      statusCode: response.status,
      step: "canary",
    });
  } catch (error) {
    return handleProxyCanaryError(input, error, now, startedAt);
  }
}

function tryBuildProxyBaseUrl(
  input: HttpProxyTestInput,
  now: () => string,
): { ok: true; value: URL } | { ok: false; result: ProxyProfileTestResult } {
  try {
    return {
      ok: true,
      value: buildValidatedBaseUrl({
        label: "HTTP proxy",
        scheme: input.scheme,
        host: input.host,
        port: input.port,
      }),
    };
  } catch (error) {
    if (error instanceof OutboundRequestPolicyError) {
      return {
        ok: false,
        result: createFailureResult(input, {
          message: error.message,
          now,
          reason: error.message,
          step: "validate",
        }),
      };
    }

    throw error;
  }
}

function buildProxyFetchInit(
  input: HttpProxyTestInput,
  proxyUrl: string,
  hasCredentials: boolean,
): ProxyFetchInit {
  return {
    redirect: "manual",
    signal: AbortSignal.timeout(input.timeoutMs),
    proxy: {
      url: proxyUrl,
      ...(hasCredentials
        ? { headers: createProxyAuthorizationHeaders(input.username, input.password) }
        : {}),
    },
  };
}

function handleProxyCanaryError(
  input: HttpProxyTestInput,
  error: unknown,
  now: () => string,
  startedAt: number,
): ProxyProfileTestResult {
  const responseTimeMs = Math.round(performance.now() - startedAt);

  if (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return createFailureResult(input, {
      message: "HTTP proxy did not respond before the timeout.",
      now,
      reason: "timeout",
      responseTimeMs,
      step: "canary",
    });
  }

  if (error instanceof TypeError) {
    return createFailureResult(input, {
      message: "Could not connect to HTTP proxy.",
      now,
      reason: "connection_failed",
      responseTimeMs,
      step: "canary",
    });
  }

  throw error;
}

function createProxyAuthorizationHeaders(
  username: string | null,
  password: string | null,
): HeadersInit {
  const token = Buffer.from(`${username ?? ""}:${password ?? ""}`).toString("base64");

  return {
    "Proxy-Authorization": `Basic ${token}`,
  };
}

function createFailureResult(
  input: HttpProxyTestInput,
  options: {
    message: string;
    now: () => string;
    reason: string;
    step: string;
    responseTimeMs?: number | undefined;
    statusCode?: number | undefined;
  },
): ProxyProfileTestResult {
  logger.warn("HTTP proxy test failed at {step} with {reason}.", {
    event: "settings.proxies.http_proxy.test.failed",
    proxyProfileId: input.proxyProfileId,
    step: options.step,
    statusCode: options.statusCode ?? null,
    reason: options.reason,
    responseTimeMs: options.responseTimeMs ?? null,
  });

  return {
    profileId: input.proxyProfileId,
    kind: "http_proxy",
    outcome: "failed",
    message: options.message,
    testedAt: options.now(),
    statusCode: options.statusCode ?? null,
    responseTimeMs: options.responseTimeMs ?? null,
  };
}
