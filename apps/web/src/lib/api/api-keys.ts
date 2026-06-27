import type { ApiKeyReveal, ApiKeySummary, CreateApiKeyRequest } from "@arrtemplar/shared";
import { requestApiJson } from "./client";
import {
  normalizeApiKeyListResponse,
  normalizeApiKeyMutationResponse,
  normalizeApiKeyReveal,
} from "./normalizers";

export async function listApiKeys(): Promise<ApiKeySummary[]> {
  const response = await requestApiJson({
    fallback: "API keys request failed.",
    method: "GET",
    path: "/api/api-keys",
  });

  return normalizeApiKeyListResponse(response).apiKeys;
}

export async function createApiKey(input: CreateApiKeyRequest): Promise<ApiKeyReveal> {
  const response = await requestApiJson({
    body: input,
    fallback: "API key creation failed.",
    method: "POST",
    path: "/api/api-keys",
  });

  return normalizeApiKeyReveal(response);
}

export async function rotateApiKey(apiKeyId: string): Promise<ApiKeyReveal> {
  const response = await requestApiJson({
    body: {},
    fallback: "API key rotation failed.",
    method: "POST",
    path: `/api/api-keys/${encodeURIComponent(apiKeyId)}/rotate`,
  });

  return normalizeApiKeyReveal(response);
}

export async function deleteApiKey(apiKeyId: string): Promise<ApiKeySummary> {
  const response = await requestApiJson({
    fallback: "API key delete failed.",
    method: "DELETE",
    path: `/api/api-keys/${encodeURIComponent(apiKeyId)}`,
  });

  return normalizeApiKeyMutationResponse(response).apiKey;
}
