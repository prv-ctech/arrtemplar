import * as dns from "node:dns/promises";
import { isIP } from "node:net";

const defaultTimeoutMs = 5000;
const defaultMaxResponseBytes = 64 * 1024;

export type OutboundTargetField = "general" | "host" | "pathBase" | "port";

export type OutboundRequestPolicyErrorCode =
  | "connection_failed"
  | "disallowed_target"
  | "invalid_host"
  | "invalid_path_base"
  | "invalid_port"
  | "redirect_blocked"
  | "response_too_large"
  | "timeout";

export class OutboundRequestPolicyError extends Error {
  constructor(
    readonly code: OutboundRequestPolicyErrorCode,
    readonly field: OutboundTargetField,
    message: string,
  ) {
    super(message);
    this.name = "OutboundRequestPolicyError";
  }
}

export type OutboundRequestTarget = {
  label: string;
  scheme: "http" | "https";
  host: string;
  port: number;
  pathBase?: string | null | undefined;
};

export type OutboundTextRequestOptions = {
  baseUrl: URL;
  label: string;
  path: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit;
  timeoutMs?: number | undefined;
  maxResponseBytes?: number;
};

export type OutboundTextResponse = {
  status: number;
  headers: Headers;
  text: string;
};

export function buildValidatedBaseUrl(target: OutboundRequestTarget): URL {
  const host = target.host.trim();

  if (!host) {
    throw new OutboundRequestPolicyError(
      "invalid_host",
      "host",
      `${target.label} host is required.`,
    );
  }

  if (!isHostOnly(host)) {
    throw new OutboundRequestPolicyError(
      "invalid_host",
      "host",
      `${target.label} host is invalid.`,
    );
  }

  if (!Number.isInteger(target.port) || target.port < 1 || target.port > 65_535) {
    throw new OutboundRequestPolicyError(
      "invalid_port",
      "port",
      `${target.label} port must be between 1 and 65535.`,
    );
  }

  const hostname = readNormalizedHostname(host);

  if (isBlockedIpLiteral(hostname)) {
    throw new OutboundRequestPolicyError(
      "disallowed_target",
      "host",
      `${target.label} target is not allowed.`,
    );
  }

  const pathBase = normalizePathBase(target.pathBase, target.label);

  try {
    return new URL(`${target.scheme}://${host}:${target.port}${pathBase}/`);
  } catch {
    throw new OutboundRequestPolicyError(
      "invalid_host",
      "host",
      `${target.label} host is invalid.`,
    );
  }
}

export async function requestOutboundText(
  options: OutboundTextRequestOptions,
): Promise<OutboundTextResponse> {
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const maxResponseBytes = normalizeMaxResponseBytes(options.maxResponseBytes);
  await assertResolvedHostAllowed(options.baseUrl.hostname, options.label);

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
        throw new OutboundRequestPolicyError(
          "redirect_blocked",
          "general",
          `${options.label} redirected the request.`,
        );
      }

      const text = await readResponseText(response, maxResponseBytes);

      return { status: response.status, headers: response.headers, text };
    },
    options.label,
  );
}

export function normalizePathBase(pathBase: string | null | undefined, label: string): string {
  const trimmed = pathBase?.trim() ?? "";

  if (!trimmed || trimmed === "/") {
    return "";
  }

  if (
    !trimmed.startsWith("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.includes("\\") ||
    trimmed.split("/").some((segment) => segment === "..")
  ) {
    throw new OutboundRequestPolicyError(
      "invalid_path_base",
      "pathBase",
      `${label} path must be a safe path that starts with /.`,
    );
  }

  return trimmed.replace(/\/+$/u, "");
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
    return (
      parsed.hostname.length > 0 && parsed.origin !== "null" && isQualifiedHostname(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function isQualifiedHostname(hostname: string): boolean {
  const normalized = normalizeLiteralHostname(hostname);

  if (normalized === "localhost" || isIP(normalized) !== 0) {
    return true;
  }

  if (!normalized.includes(".")) {
    return false;
  }

  return normalized.split(".").every(isValidHostnameLabel);
}

function readNormalizedHostname(host: string): string {
  try {
    const parsed = new URL(`http://${host}/`);
    return normalizeLiteralHostname(parsed.hostname);
  } catch {
    return normalizeLiteralHostname(host);
  }
}

function isBlockedIpLiteral(hostname: string): boolean {
  const normalized = normalizeMappedIpv4(hostname);

  if (isLinkLocalIpv6(normalized) || isBlockedMetadataHostname(normalized)) {
    return true;
  }

  const octets = parseIpv4Octets(normalized);

  if (!octets) {
    return false;
  }

  return octets[0] === 169 && octets[1] === 254;
}

function normalizeMappedIpv4(hostname: string): string {
  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu.exec(hostname);

  if (mappedIpv4?.[1]) {
    return mappedIpv4[1];
  }

  const mappedHexIpv4 = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/iu.exec(hostname);

  if (!mappedHexIpv4) {
    return hostname;
  }

  const high = Number.parseInt(mappedHexIpv4[1] ?? "", 16);
  const low = Number.parseInt(mappedHexIpv4[2] ?? "", 16);

  if (!Number.isInteger(high) || !Number.isInteger(low)) {
    return hostname;
  }

  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

function normalizeLiteralHostname(hostname: string): string {
  return hostname
    .replace(/^\[|\]$/gu, "")
    .replace(/\.$/u, "")
    .toLowerCase();
}

function isValidHostnameLabel(label: string): boolean {
  return /^[a-z0-9-]{1,63}$/iu.test(label) && !label.startsWith("-") && !label.endsWith("-");
}

function isBlockedMetadataHostname(hostname: string): boolean {
  return [
    "metadata",
    "metadata.aws.internal",
    "metadata.google.internal",
    "instance-data.ec2.internal",
    "fd00:ec2::254",
  ].some((candidate) => candidate === hostname);
}

async function assertResolvedHostAllowed(hostname: string, label: string): Promise<void> {
  if (isBlockedIpLiteral(normalizeLiteralHostname(hostname))) {
    throw new OutboundRequestPolicyError(
      "disallowed_target",
      "host",
      `${label} target is not allowed.`,
    );
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => []);

  if (addresses.some((entry) => isBlockedIpLiteral(entry.address))) {
    throw new OutboundRequestPolicyError(
      "disallowed_target",
      "host",
      `${label} target is not allowed.`,
    );
  }
}

export async function assertResolvedHostAllowedForOutboundTarget(
  hostname: string,
  label: string,
): Promise<void> {
  await assertResolvedHostAllowed(hostname, label);
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
  label: string,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(
        new OutboundRequestPolicyError(
          "timeout",
          "general",
          `${label} did not respond before the timeout.`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([request(controller.signal), timeoutPromise]);
  } catch (error) {
    if (error instanceof OutboundRequestPolicyError) {
      throw error;
    }

    if (isTimeoutError(error) || isAbortError(error)) {
      throw new OutboundRequestPolicyError(
        "timeout",
        "general",
        `${label} did not respond before the timeout.`,
      );
    }

    if (error instanceof TypeError) {
      throw new OutboundRequestPolicyError(
        "connection_failed",
        "general",
        `Could not connect to ${label}.`,
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
      throw new OutboundRequestPolicyError(
        "response_too_large",
        "general",
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
      throw new OutboundRequestPolicyError(
        "response_too_large",
        "general",
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
