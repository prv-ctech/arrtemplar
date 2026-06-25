export const CSRF_HEADER_NAME = "X-App-CSRF";
export const CSRF_HEADER_VALUE = "same-origin";
export const API_KEY_HEADER_NAME = "X-Api-Key";
export const API_KEY_QUERY_PARAMETER_NAME = "apikey";
export const API_KEY_MANAGEMENT_PATH_PREFIX = "/api/api-keys";
export const API_KEY_CSRF_EXEMPT_PATH_PREFIXES = ["/api/settings/services"] as const;
