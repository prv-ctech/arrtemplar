import * as dns from "node:dns/promises";
import type { ServiceIntegrationField, ServiceIntegrationOperationError } from "@arrtemplar/shared";

const defaultTimeoutMs = 5000;
const defaultMaxResponseBytes = 64 * 1024;

export type ServiceIntegrationRequestTarget = {
  serviceLabel: string;
  useSsl: boolean;
  host: string;
  port: number;
  urlBase?: string | null | undefined;
};

export type ServiceIntegrationRequestOptions = {
  baseUrl: URL;
  serviceLabel: string;
  path: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit;
  timeoutMs?: number | undefined;
  maxResponseBytes?: number;
};

export type ServiceIntegrationTextResponse = {
  status: number;
  headers: Headers;
  text: string;
};

export function buildServiceIntegrationBaseUrl(
  target: ServiceIntegrationRequestTarget,
): { ok: true; baseUrl: URL } | { ok: false; error: ServiceIntegrationOperationError } {
  const host = target.host.trim();

  if (!host) {
    return {
      ok: false,
      error: createServiceIntegrationOperationError(
        "configuration_incomplete",
        `${target.serviceLabel} host is required.`,
        ["host"],
      ),
    };
  }

  if (!isHostOnly(host)) {
    return {
      ok: false,
      error: createServiceIntegrationOperationError(
        "invalid_host",
        `${target.serviceLabel} host is invalid.`,
        ["host"],
      ),
    };
  }

  if (!Number.isInteger(target.port) || target.port < 1 || target.port > 65_535) {
    return {
      ok: false,
      error: createServiceIntegrationOperationError(
        "invalid_port",
        `${target.serviceLabel} port must be between 1 and 65535.`,
        ["port"],
      ),
    };
  }

  const hostname = readNormalizedHostname(host);

  if (isBlockedIpLiteral(hostname)) {
    return {
      ok: false,
      error: createServiceIntegrationOperationError(
        "disallowed_target",
        `${target.serviceLabel} target is not allowed.`,
        ["host"],
      ),
    };
  }

  const urlBaseResult = normalizeUrlBase(target.urlBase, target.serviceLabel);

  if (!urlBaseResult.ok) {
    return { ok: false, error: urlBaseResult.error };
  }

  try {
    const scheme = target.useSsl ? "https" : "http";
    return {
      ok: true,
      baseUrl: new URL(`${scheme}://${host}:${target.port}${urlBaseResult.path}/`),
    };
  } catch {
    return {
      ok: false,
      error: createServiceIntegrationOperationError(
        "invalid_host",
        `${target.serviceLabel} host is invalid.`,
        ["host"],
      ),
    };
  }
}

export function createSameOriginHeaders(baseUrl: URL): Headers {
  const headers = new Headers();

  headers.set("Origin", baseUrl.origin);
  headers.set("Referer", baseUrl.toString());

  return headers;
}

export async function requestServiceIntegrationText(
  options: ServiceIntegrationRequestOptions,
): Promise<ServiceIntegrationTextResponse> {
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const maxResponseBytes = normalizeMaxResponseBytes(options.maxResponseBytes);
  await assertResolvedHostAllowed(options.baseUrl.hostname, options.serviceLabel);

  return await withTimeout(
    timeoutMs,
    async (signal) => {
      const response = await fetch(new URL(options.path, options.baseUrl), {
        method: options.method ?? "GET",
        ...(options.headers ? { headers: options.headers } : {}),
        ...(options.body !== undefined ? { body: options.body } : {}),
        redirect: "manual",
        signal,
      });

      if (response.status >= 300 && response.status < 400) {
        throw createServiceIntegrationOperationError(
          "redirect_blocked",
          `${options.serviceLabel} redirected the request.`,
        );
      }

      const text = await readResponseText(response, maxResponseBytes);

      return { status: response.status, headers: response.headers, text };
    },
    options.serviceLabel,
  );
}

export function createServiceIntegrationOperationError(
  code: ServiceIntegrationOperationError["code"],
  message: string,
  fields: ServiceIntegrationField[] = [],
): ServiceIntegrationOperationError {
  const fieldErrors = fields.map((field) => ({ field, code, message }));

  if (fieldErrors.length === 0) {
    return { code, message };
  }

  return { code, message, fieldErrors };
}

function normalizeUrlBase(
  urlBase: string | null | undefined,
  serviceLabel: string,
): { ok: true; path: string } | { ok: false; error: ServiceIntegrationOperationError } {
  const trimmed = urlBase?.trim() ?? "";

  if (!trimmed || trimmed === "/") {
    return { ok: true, path: "" };
  }

  if (
    !trimmed.startsWith("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.includes("\\") ||
    trimmed.split("/").some((segment) => segment === "..")
  ) {
    return {
      ok: false,
      error: createServiceIntegrationOperationError(
        "invalid_url_base",
        `${serviceLabel} URL base must be a safe path that starts with /.`,
        ["urlBase"],
      ),
    };
  }

  return { ok: true, path: trimmed.replace(/\/+$/u, "") };
}

function isHostOnly(host: string): boolean {
  if (/\s/u.test(host) || host.includes("://") || /[/\\@?#]/u.test(host)) {
    return false;
  }

  if (host.includes(":") && !(host.startsWith("[") && host.endsWith("]"))) {
    return false;
  }

  try {
    const parsed = new URL(`http://${host}/`);
    return parsed.hostname.length > 0 && parsed.origin !== "null";
  } catch {
    return false;
  }
}

function readNormalizedHostname(host: string): string {
  try {
    const parsed = new URL(`http://${host}/`);
    return parsed.hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  } catch {
    return host.replace(/^\[|\]$/gu, "").toLowerCase();
  }
}

function isBlockedIpLiteral(hostname: string): boolean {
  if (isLinkLocalIpv6(hostname)) {
    return true;
  }

  const octets = parseIpv4Octets(hostname);

  if (!octets) {
    return false;
  }

  return octets[0] === 169 && octets[1] === 254;
}

async function assertResolvedHostAllowed(hostname: string, serviceLabel: string): Promise<void> {
  if (isBlockedIpLiteral(hostname)) {
    throw createServiceIntegrationOperationError(
      "disallowed_target",
      `${serviceLabel} target is not allowed.`,
      ["host"],
    );
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => []);

  if (addresses.some((entry) => isBlockedIpLiteral(entry.address))) {
    throw createServiceIntegrationOperationError(
      "disallowed_target",
      `${serviceLabel} target is not allowed.`,
      ["host"],
    );
  }
}

function isLinkLocalIpv6(hostname: string): boolean {
  return /^fe[89ab][0-9a-f]/iu.test(hostname);
}

function parseIpv4Octets(hostname: string): number[] | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname)) {
    return null;
  }

  const octets = hostname.split(".").map((segment) => Number(segment));

  return octets.every((segment) => Number.isInteger(segment) && segment >= 0 && segment <= 255)
    ? octets
    : null;
}

function normalizeTimeout(timeoutMs: number | undefined): number {
  if (timeoutMs === undefined) {
    return defaultTimeoutMs;
  }

  return Math.max(1, Math.floor(timeoutMs));
}

function normalizeMaxResponseBytes(maxResponseBytes: number | undefined): number {
  if (maxResponseBytes === undefined) {
    return defaultMaxResponseBytes;
  }

  return Math.max(1, Math.floor(maxResponseBytes));
}

async function withTimeout<T>(
  timeoutMs: number,
  request: (signal: AbortSignal) => Promise<T>,
  serviceLabel: string,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(
        createServiceIntegrationOperationError(
          "timeout",
          `${serviceLabel} did not respond before the timeout.`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([request(controller.signal), timeoutPromise]);
  } catch (error) {
    if (isTimeoutError(error) || isAbortError(error)) {
      throw createServiceIntegrationOperationError(
        "timeout",
        `${serviceLabel} did not respond before the timeout.`,
      );
    }

    if (error instanceof TypeError) {
      throw createServiceIntegrationOperationError(
        "connection_failed",
        `Could not connect to ${serviceLabel}.`,
      );
    }

    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function readResponseText(response: Response, maxResponseBytes: number): Promise<string> {
  const contentLength = response.headers.get("content-length");

  if (contentLength) {
    const parsedLength = Number(contentLength);

    if (Number.isFinite(parsedLength) && parsedLength > maxResponseBytes) {
      throw createServiceIntegrationOperationError(
        "response_too_large",
        "Response exceeded the allowed size limit.",
      );
    }
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    receivedBytes += value.byteLength;

    if (receivedBytes > maxResponseBytes) {
      throw createServiceIntegrationOperationError(
        "response_too_large",
        "Response exceeded the allowed size limit.",
      );
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());

  return chunks.join("").trim();
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
