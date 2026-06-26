export const SERVICE_INTEGRATION_KIND_VALUES = ["qbittorrent", "sabnzbd", "prowlarr"] as const;

export type ServiceIntegrationKind = (typeof SERVICE_INTEGRATION_KIND_VALUES)[number];

export const SERVICE_INTEGRATION_AUTH_MODE_VALUES = ["api_key", "username_password"] as const;

export type ServiceIntegrationAuthMode = (typeof SERVICE_INTEGRATION_AUTH_MODE_VALUES)[number];

export const SERVICE_INTEGRATION_PROBE_OUTCOME_VALUES = [
  "success",
  "error",
  "disabled",
  "not_configured",
] as const;

export type ServiceIntegrationProbeOutcome =
  (typeof SERVICE_INTEGRATION_PROBE_OUTCOME_VALUES)[number];

export const SERVICE_INTEGRATION_FIELD_VALUES = [
  "displayName",
  "host",
  "port",
  "urlBase",
  "authMode",
  "username",
  "apiKey",
  "password",
  "general",
] as const;

export type ServiceIntegrationField = (typeof SERVICE_INTEGRATION_FIELD_VALUES)[number];

export const SERVICE_INTEGRATION_ERROR_CODE_VALUES = [
  "configuration_incomplete",
  "invalid_host",
  "invalid_port",
  "invalid_url_base",
  "invalid_scheme",
  "disallowed_target",
  "redirect_blocked",
  "response_too_large",
  "timeout",
  "auth_failed",
  "connection_failed",
  "invalid_response",
  "unsupported_version",
  "service_unavailable",
] as const;

export type ServiceIntegrationErrorCode = (typeof SERVICE_INTEGRATION_ERROR_CODE_VALUES)[number];

export const SERVICE_INTEGRATION_API_ROUTES = {
  collection: "/api/settings/services",
  detail: "/api/settings/services/:kind",
  instance: "/api/settings/services/instances/:integrationId",
  instanceStatus: "/api/settings/services/instances/:integrationId/status",
  instanceTest: "/api/settings/services/instances/:integrationId/test",
  instances: "/api/settings/services/:kind/instances",
  probe: "/api/settings/services/:kind/test",
  status: "/api/settings/services/:kind/status",
} as const;

export type ServiceIntegrationFieldError = {
  field: ServiceIntegrationField;
  code: ServiceIntegrationErrorCode;
  message: string;
};

export type ServiceIntegrationOperationError = {
  code: ServiceIntegrationErrorCode;
  message: string;
  fieldErrors?: ServiceIntegrationFieldError[];
};

export type ServiceIntegrationSavedConfig = {
  id: string;
  kind: ServiceIntegrationKind;
  displayName: string;
  isDefault: boolean;
  enabled: boolean;
  useSsl: boolean;
  host: string;
  port: number;
  urlBase: string | null;
  authMode: ServiceIntegrationAuthMode;
  username: string | null;
  hasApiKey: boolean;
  hasPassword: boolean;
  lastTestedAt: string | null;
  lastTestOutcome: ServiceIntegrationProbeOutcome | null;
  lastTestMessage: string | null;
  lastStatusCheckedAt: string | null;
  lastStatusOutcome: ServiceIntegrationProbeOutcome | null;
  lastStatusMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceIntegrationListResponse = {
  integrations: ServiceIntegrationSavedConfig[];
};

export type ServiceIntegrationResponse = {
  integration: ServiceIntegrationSavedConfig | null;
};

export type UpsertServiceIntegrationRequest = {
  displayName?: string | null;
  enabled?: boolean;
  useSsl: boolean;
  host: string;
  port: number;
  urlBase?: string | null;
  authMode: ServiceIntegrationAuthMode;
  username?: string | null;
  apiKey?: string;
  password?: string;
};

export type DeleteServiceIntegrationResponse = {
  status: "ok";
  deletedId: string;
  deletedKind: ServiceIntegrationKind;
};

export type ServiceIntegrationProbeResult = {
  kind: ServiceIntegrationKind;
  configured: boolean;
  enabled: boolean;
  outcome: ServiceIntegrationProbeOutcome;
  summary: string;
  checkedAt: string;
  reachable: boolean;
  authenticated: boolean;
  compatible: boolean;
  version: string | null;
  webApiVersion: string | null;
  connectionState: string | null;
};

export type ServiceIntegrationProbeResponse = {
  result: ServiceIntegrationProbeResult;
  error?: ServiceIntegrationOperationError;
};

export function isServiceIntegrationKind(value: unknown): value is ServiceIntegrationKind {
  return (
    typeof value === "string" && SERVICE_INTEGRATION_KIND_VALUES.some((kind) => kind === value)
  );
}

export function isServiceIntegrationAuthMode(value: unknown): value is ServiceIntegrationAuthMode {
  return (
    typeof value === "string" && SERVICE_INTEGRATION_AUTH_MODE_VALUES.some((mode) => mode === value)
  );
}

export function isServiceIntegrationProbeOutcome(
  value: unknown,
): value is ServiceIntegrationProbeOutcome {
  return (
    typeof value === "string" &&
    SERVICE_INTEGRATION_PROBE_OUTCOME_VALUES.some((outcome) => outcome === value)
  );
}
