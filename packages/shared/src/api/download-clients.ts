export const DOWNLOAD_CLIENT_KIND_VALUES = ["qbittorrent", "sabnzbd"] as const;

export type DownloadClientKind = (typeof DOWNLOAD_CLIENT_KIND_VALUES)[number];

export const DOWNLOAD_CLIENT_AUTH_MODE_VALUES = ["api_key", "username_password"] as const;

export type DownloadClientAuthMode = (typeof DOWNLOAD_CLIENT_AUTH_MODE_VALUES)[number];

export const DOWNLOAD_CLIENT_PROBE_OUTCOME_VALUES = [
  "success",
  "error",
  "disabled",
  "not_configured",
] as const;

export type DownloadClientProbeOutcome = (typeof DOWNLOAD_CLIENT_PROBE_OUTCOME_VALUES)[number];

export const DOWNLOAD_CLIENT_FIELD_VALUES = [
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

export type DownloadClientField = (typeof DOWNLOAD_CLIENT_FIELD_VALUES)[number];

export const DOWNLOAD_CLIENT_ERROR_CODE_VALUES = [
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

export type DownloadClientErrorCode = (typeof DOWNLOAD_CLIENT_ERROR_CODE_VALUES)[number];

export const DOWNLOAD_CLIENT_API_ROUTES = {
  collection: "/api/settings/services",
  detail: "/api/settings/services/:kind",
  instance: "/api/settings/services/instances/:clientId",
  instanceStatus: "/api/settings/services/instances/:clientId/status",
  instanceTest: "/api/settings/services/instances/:clientId/test",
  instances: "/api/settings/services/:kind/instances",
  probe: "/api/settings/services/:kind/test",
  status: "/api/settings/services/:kind/status",
} as const;

export type DownloadClientFieldError = {
  field: DownloadClientField;
  code: DownloadClientErrorCode;
  message: string;
};

export type DownloadClientOperationError = {
  code: DownloadClientErrorCode;
  message: string;
  fieldErrors?: DownloadClientFieldError[];
};

export type DownloadClientSavedConfig = {
  id: string;
  kind: DownloadClientKind;
  displayName: string;
  isDefault: boolean;
  enabled: boolean;
  useSsl: boolean;
  host: string;
  port: number;
  urlBase: string | null;
  authMode: DownloadClientAuthMode;
  username: string | null;
  hasApiKey: boolean;
  hasPassword: boolean;
  lastTestedAt: string | null;
  lastTestOutcome: DownloadClientProbeOutcome | null;
  lastTestMessage: string | null;
  lastStatusCheckedAt: string | null;
  lastStatusOutcome: DownloadClientProbeOutcome | null;
  lastStatusMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DownloadClientListResponse = {
  clients: DownloadClientSavedConfig[];
};

export type DownloadClientResponse = {
  client: DownloadClientSavedConfig | null;
};

export type UpsertDownloadClientRequest = {
  displayName?: string | null;
  enabled: boolean;
  useSsl: boolean;
  host: string;
  port: number;
  urlBase?: string | null;
  authMode: DownloadClientAuthMode;
  username?: string | null;
  apiKey?: string;
  password?: string;
};

export type DeleteDownloadClientResponse = {
  status: "ok";
  deletedId: string;
  deletedKind: DownloadClientKind;
};

export type DownloadClientProbeResult = {
  kind: DownloadClientKind;
  configured: boolean;
  enabled: boolean;
  outcome: DownloadClientProbeOutcome;
  summary: string;
  checkedAt: string;
  reachable: boolean;
  authenticated: boolean;
  compatible: boolean;
  version: string | null;
  webApiVersion: string | null;
  connectionState: string | null;
};

export type DownloadClientProbeResponse = {
  result: DownloadClientProbeResult;
  error?: DownloadClientOperationError;
};

export function isDownloadClientKind(value: unknown): value is DownloadClientKind {
  return typeof value === "string" && DOWNLOAD_CLIENT_KIND_VALUES.some((kind) => kind === value);
}

export function isDownloadClientAuthMode(value: unknown): value is DownloadClientAuthMode {
  return (
    typeof value === "string" && DOWNLOAD_CLIENT_AUTH_MODE_VALUES.some((mode) => mode === value)
  );
}

export function isDownloadClientProbeOutcome(value: unknown): value is DownloadClientProbeOutcome {
  return (
    typeof value === "string" &&
    DOWNLOAD_CLIENT_PROBE_OUTCOME_VALUES.some((outcome) => outcome === value)
  );
}
