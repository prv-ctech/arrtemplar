import type { UserPermission } from "./permissions";

export const API_KEY_PREFIX = "artk_" as const;

export const API_KEY_STATUS_VALUES = ["active", "expired", "revoked"] as const;

export type ApiKeyStatus = (typeof API_KEY_STATUS_VALUES)[number];

export const API_KEY_API_ROUTES = {
  collection: "/api/api-keys",
  detail: "/api/api-keys/:apiKeyId",
  me: "/api/api-keys/me",
  refresh: "/api/api-keys/:apiKeyId/refresh",
  rotate: "/api/api-keys/:apiKeyId/rotate",
  revoke: "/api/api-keys/:apiKeyId/revoke",
} as const;

export type ApiKeyCreatedBy = {
  id: string;
  username: string;
};

export type ApiKeySummary = {
  id: string;
  name: string;
  description: string | null;
  prefix: string;
  maskedKey: string;
  status: ApiKeyStatus;
  permissions: UserPermission[];
  permissionCount: number;
  expiresAt: string | null;
  ipAllowlist: string[];
  lastUsedAt: string | null;
  lastUsedIpAddress: string | null;
  lastUsedUserAgent: string | null;
  createdBy: ApiKeyCreatedBy | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

export type ApiKeyReveal = {
  apiKey: ApiKeySummary;
  secret: string;
};

export type ApiKeyListResponse = {
  apiKeys: ApiKeySummary[];
};

export type ApiKeyResponse = {
  apiKey: ApiKeySummary;
};

export type CreateApiKeyResponse = ApiKeyReveal;

export type RotateApiKeyResponse = ApiKeyReveal;

export type ApiKeyMutationResponse = {
  status: "ok";
  apiKey: ApiKeySummary;
};

export type DeleteApiKeyResponse = ApiKeyMutationResponse;

export type RevokeApiKeyResponse = ApiKeyMutationResponse;

export type RefreshApiKeyResponse = ApiKeyReveal;

export type ApiKeyMeResponse = {
  apiKey: Pick<
    ApiKeySummary,
    "id" | "name" | "prefix" | "maskedKey" | "status" | "permissions" | "expiresAt" | "lastUsedAt"
  >;
};

export type CreateApiKeyRequest = {
  name: string;
  description?: string | null;
  permissions: UserPermission[];
  expiresAt?: string | null;
  ipAllowlist?: string[];
};

export type UpdateApiKeyRequest = Partial<CreateApiKeyRequest>;
