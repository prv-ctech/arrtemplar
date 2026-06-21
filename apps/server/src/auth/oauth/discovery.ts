const discoveryCacheDurationMs = 5 * 60 * 1000;
const supportedIdTokenAlgorithms = new Set(["RS256", "ES256"]);

export type OidcDiscoveryDocument = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string | null;
  jwksUri: string;
  endSessionEndpoint: string | null;
  idTokenSigningAlgValuesSupported: string[];
  tokenEndpointAuthMethodsSupported: string[];
};

type DiscoveryCacheEntry = {
  document: OidcDiscoveryDocument;
  expiresAt: number;
};

const discoveryCache = new Map<string, DiscoveryCacheEntry>();

export async function fetchOidcDiscovery(issuer: string): Promise<OidcDiscoveryDocument> {
  const normalizedIssuer = normalizeIssuerUrl(issuer);
  const cached = discoveryCache.get(normalizedIssuer);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.document;
  }

  const discoveryUrl = new URL(".well-known/openid-configuration", normalizedIssuer).toString();
  const response = await fetch(discoveryUrl, {
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`OIDC discovery request failed with status ${response.status}.`);
  }

  const document = validateDiscoveryDocument(await response.json(), normalizedIssuer);
  discoveryCache.set(normalizedIssuer, {
    document,
    expiresAt: Date.now() + discoveryCacheDurationMs,
  });

  return document;
}

export function normalizeIssuerUrl(value: string): string {
  const url = parseHttpIntegrationUrl(value, "OIDC issuer");

  url.search = "";
  url.hash = "";

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
}

export function parseHttpIntegrationUrl(value: string, label: string): URL {
  const url = new URL(value);

  if (url.username || url.password) {
    throw new Error(`${label} URL must not include credentials.`);
  }

  if (url.protocol === "https:") {
    return url;
  }

  if (url.protocol === "http:" && isLocalhost(url.hostname) && Bun.env.NODE_ENV !== "production") {
    return url;
  }

  throw new Error(`${label} URL must use https.`);
}

function validateDiscoveryDocument(value: unknown, expectedIssuer: string): OidcDiscoveryDocument {
  if (!value || typeof value !== "object") {
    throw new Error("OIDC discovery document must be a JSON object.");
  }

  const record = value as Record<string, unknown>;
  const issuer = readRequiredString(record.issuer, "issuer");
  const issuerUrl = normalizeIssuerUrl(issuer);

  if (issuerUrl !== expectedIssuer) {
    throw new Error("OIDC discovery issuer does not match the configured issuer.");
  }

  const expectedOrigin = new URL(expectedIssuer).origin;
  const authorizationEndpoint = readSameOriginUrl(
    record.authorization_endpoint,
    "authorization_endpoint",
    expectedOrigin,
  );
  const tokenEndpoint = readSameOriginUrl(record.token_endpoint, "token_endpoint", expectedOrigin);
  const jwksUri = readSameOriginUrl(record.jwks_uri, "jwks_uri", expectedOrigin);
  const userinfoEndpoint = readOptionalSameOriginUrl(
    record.userinfo_endpoint,
    "userinfo_endpoint",
    expectedOrigin,
  );
  const endSessionEndpoint = readOptionalSameOriginUrl(
    record.end_session_endpoint,
    "end_session_endpoint",
    expectedOrigin,
  );
  const idTokenSigningAlgValuesSupported = readStringArray(
    record.id_token_signing_alg_values_supported,
    "id_token_signing_alg_values_supported",
  ).filter((algorithm) => supportedIdTokenAlgorithms.has(algorithm));

  if (idTokenSigningAlgValuesSupported.length === 0) {
    throw new Error("OIDC discovery must advertise RS256 or ES256 ID-token signing.");
  }

  return {
    issuer: issuerUrl,
    authorizationEndpoint,
    tokenEndpoint,
    userinfoEndpoint,
    jwksUri,
    endSessionEndpoint,
    idTokenSigningAlgValuesSupported,
    tokenEndpointAuthMethodsSupported: readOptionalStringArray(
      record.token_endpoint_auth_methods_supported,
    ),
  };
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`OIDC discovery field ${field} must be a non-empty string.`);
  }

  return value.trim();
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`OIDC discovery field ${field} must be an array.`);
  }

  const values = value.filter((entry): entry is string => typeof entry === "string" && !!entry);

  if (values.length === 0) {
    throw new Error(`OIDC discovery field ${field} must include at least one value.`);
  }

  return values;
}

function readOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && !!entry);
}

function readSameOriginUrl(value: unknown, field: string, expectedOrigin: string): string {
  const url = parseHttpIntegrationUrl(readRequiredString(value, field), `OIDC discovery ${field}`);

  if (url.origin !== expectedOrigin) {
    throw new Error(`OIDC discovery field ${field} must share the issuer origin.`);
  }

  return url.toString();
}

function readOptionalSameOriginUrl(
  value: unknown,
  field: string,
  expectedOrigin: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return readSameOriginUrl(value, field, expectedOrigin);
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
