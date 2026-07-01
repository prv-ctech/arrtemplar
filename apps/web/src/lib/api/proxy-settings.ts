import type {
  DeleteProxyProfileResponse,
  ProxyProfileSummary,
  ProxyProfileTestResponse,
  UpsertProxyProfileRequest,
} from "@arrtemplar/shared";
import { requestApiJson } from "./client";
import {
  normalizeDeleteProxyProfileResponse,
  normalizeProxyProfileListResponse,
  normalizeProxyProfileResponse,
  normalizeProxyProfileTestResponse,
} from "./normalizers";

export async function listProxyProfiles(): Promise<ProxyProfileSummary[]> {
  const response = await requestApiJson({
    fallback: "Proxy settings request failed.",
    method: "GET",
    path: "/api/settings/proxies",
  });

  return normalizeProxyProfileListResponse(response).profiles;
}

export async function createProxyProfile(
  input: UpsertProxyProfileRequest,
): Promise<ProxyProfileSummary> {
  const response = await requestApiJson({
    body: input,
    fallback: "Proxy settings save failed.",
    method: "POST",
    path: "/api/settings/proxies",
  });

  return normalizeProxyProfileResponse(response).profile;
}

export async function updateProxyProfile(
  proxyProfileId: string,
  input: UpsertProxyProfileRequest,
): Promise<ProxyProfileSummary> {
  const response = await requestApiJson({
    body: input,
    fallback: "Proxy settings save failed.",
    method: "PUT",
    path: `/api/settings/proxies/${encodeURIComponent(proxyProfileId)}`,
  });

  return normalizeProxyProfileResponse(response).profile;
}

export async function deleteProxyProfile(
  proxyProfileId: string,
): Promise<DeleteProxyProfileResponse> {
  const response = await requestApiJson({
    fallback: "Proxy settings delete failed.",
    method: "DELETE",
    path: `/api/settings/proxies/${encodeURIComponent(proxyProfileId)}`,
  });

  return normalizeDeleteProxyProfileResponse(response, undefined, proxyProfileId);
}

export async function testProxyProfile(proxyProfileId: string): Promise<ProxyProfileTestResponse> {
  const response = await requestApiJson({
    body: {},
    fallback: "Proxy settings test failed.",
    method: "POST",
    path: `/api/settings/proxies/${encodeURIComponent(proxyProfileId)}/test`,
  });

  return normalizeProxyProfileTestResponse(response, proxyProfileId);
}
