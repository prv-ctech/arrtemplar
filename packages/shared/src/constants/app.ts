export const APP_NAME = "Arrtemplar" as const;
export const APP_IDENTIFIER = APP_NAME.toLowerCase() as Lowercase<typeof APP_NAME>;
export const APP_LOG_CATEGORY = "app" as const;
export const APP_STORAGE_PREFIX = APP_IDENTIFIER;
export const OAUTH_LOCAL_EMAIL_DOMAIN = `oauth.local.${APP_IDENTIFIER}` as const;
export const APP_VERSION = "0.1.0" as const;
