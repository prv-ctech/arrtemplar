import type { ServiceIntegrationField, ServiceIntegrationOperationError } from "@arrtemplar/shared";
import {
  buildValidatedBaseUrl,
  OutboundRequestPolicyError,
  requestOutboundText,
} from "../outbound/request-target-policy";

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
  try {
    return {
      ok: true,
      baseUrl: buildValidatedBaseUrl({
        label: target.serviceLabel,
        scheme: target.useSsl ? "https" : "http",
        host: target.host,
        port: target.port,
        pathBase: target.urlBase,
      }),
    };
  } catch (error) {
    if (error instanceof OutboundRequestPolicyError) {
      return { ok: false, error: mapOutboundError(error) };
    }

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
  try {
    return await requestOutboundText({
      baseUrl: options.baseUrl,
      label: options.serviceLabel,
      path: options.path,
      ...(options.method ? { method: options.method } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
      ...(options.body !== undefined ? { body: options.body } : {}),
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.maxResponseBytes !== undefined
        ? { maxResponseBytes: options.maxResponseBytes }
        : {}),
    });
  } catch (error) {
    if (error instanceof OutboundRequestPolicyError) {
      throw mapOutboundError(error);
    }

    throw error;
  }
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

function mapOutboundError(error: OutboundRequestPolicyError): ServiceIntegrationOperationError {
  switch (error.code) {
    case "invalid_path_base":
      return createServiceIntegrationOperationError("invalid_url_base", error.message, ["urlBase"]);
    case "invalid_host":
      return createServiceIntegrationOperationError("invalid_host", error.message, ["host"]);
    case "invalid_port":
      return createServiceIntegrationOperationError("invalid_port", error.message, ["port"]);
    case "disallowed_target":
      return createServiceIntegrationOperationError("disallowed_target", error.message, ["host"]);
    case "redirect_blocked":
      return createServiceIntegrationOperationError("redirect_blocked", error.message);
    case "response_too_large":
      return createServiceIntegrationOperationError("response_too_large", error.message);
    case "timeout":
      return createServiceIntegrationOperationError("timeout", error.message);
    case "connection_failed":
      return createServiceIntegrationOperationError("connection_failed", error.message);
  }
}
