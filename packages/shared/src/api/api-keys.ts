export const API_KEY_SECRET_HEX_LENGTH = 32 as const;
export const API_KEY_SECRET_PATTERN = "^[a-f0-9]{32}$" as const;

export const API_KEY_STATUS_VALUES = ["active", "deleted"] as const;

export type ApiKeyStatus = (typeof API_KEY_STATUS_VALUES)[number];

export const API_KEY_API_ROUTES = {
  collection: "/api/api-keys",
  detail: "/api/api-keys/:apiKeyId",
  rotate: "/api/api-keys/:apiKeyId/rotate",
} as const;

export type ApiKeyCreatedBy = {
  id: string;
  username: string;
};

export type ApiKeySummary = {
  id: string;
  name: string;
  description: string | null;
  keyPrefix: string;
  fingerprint: string;
  maskedKey: string;
  status: ApiKeyStatus;
  lastUsedAt: string | null;
  lastUsedIpAddress: string | null;
  lastUsedUserAgent: string | null;
  createdBy: ApiKeyCreatedBy | null;
  createdAt: string;
  updatedAt: string;
  rotatedAt: string | null;
  deletedAt: string | null;
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

export type CreateApiKeyRequest = {
  name: string;
  description?: string | null;
};

export function isApiKeySecret(value: string): boolean {
  return new RegExp(API_KEY_SECRET_PATTERN).test(value);
}
