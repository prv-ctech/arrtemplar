import { decodeBase64Url } from "../../security/oauth-crypto";
import type { OidcDiscoveryDocument } from "./discovery";
import { parseHttpIntegrationUrl } from "./discovery";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const jwksCacheDurationMs = 5 * 60 * 1000;
const allowedJwtAlgorithms = ["RS256", "ES256"] as const;
const clockSkewSeconds = 60;

type SupportedJwtAlgorithm = (typeof allowedJwtAlgorithms)[number];

export type OidcIdTokenClaims = {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce: string;
  azp?: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
};

type JwtHeader = {
  alg: SupportedJwtAlgorithm;
  kid: string | null;
};

type OidcJsonWebKey = JsonWebKey & {
  kid?: string;
};

type JwksDocument = {
  keys: OidcJsonWebKey[];
};

type JwksCacheEntry = {
  document: JwksDocument;
  expiresAt: number;
};

const jwksCache = new Map<string, JwksCacheEntry>();

export async function verifyOidcIdToken(input: {
  clientId: string;
  discovery: OidcDiscoveryDocument;
  expectedNonce: string;
  idToken: string;
}): Promise<OidcIdTokenClaims> {
  const jwt = parseJwt(input.idToken);
  const supportedAlgorithms =
    input.discovery.idTokenSigningAlgValuesSupported.filter(isSupportedJwtAlgorithm);

  if (!supportedAlgorithms.includes(jwt.header.alg)) {
    throw new Error("OIDC ID token algorithm is not supported by the configured provider.");
  }

  const jwk = await readVerificationJwk(input.discovery.jwksUri, jwt.header);
  const verified = await verifyJwtSignature(jwt, jwk);

  if (!verified) {
    throw new Error("OIDC ID token signature is invalid.");
  }

  return validateIdTokenClaims(jwt.claims, input);
}

function parseJwt(value: string): {
  header: JwtHeader;
  claims: Record<string, unknown>;
  signingInput: Uint8Array<ArrayBuffer>;
  signature: Uint8Array<ArrayBuffer>;
} {
  const [encodedHeader, encodedPayload, encodedSignature, extra] = value.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature || extra !== undefined) {
    throw new Error("OIDC ID token must be a compact JWT.");
  }

  const header = parseJwtHeader(encodedHeader);
  const claims = parseJwtClaims(encodedPayload);

  return {
    header,
    claims,
    signingInput: textEncoder.encode(`${encodedHeader}.${encodedPayload}`),
    signature: decodeBase64Url(encodedSignature),
  };
}

function parseJwtHeader(encodedHeader: string): JwtHeader {
  const value = parseJsonPart(encodedHeader, "OIDC ID token header");

  if (!value || typeof value !== "object") {
    throw new Error("OIDC ID token header must be a JSON object.");
  }

  const header = value as Record<string, unknown>;
  const algorithm = header.alg;

  if (!isSupportedJwtAlgorithm(algorithm)) {
    throw new Error("OIDC ID token algorithm must be RS256 or ES256.");
  }

  return {
    alg: algorithm,
    kid: typeof header.kid === "string" && header.kid ? header.kid : null,
  };
}

function parseJwtClaims(encodedPayload: string): Record<string, unknown> {
  const value = parseJsonPart(encodedPayload, "OIDC ID token claims");

  if (!value || typeof value !== "object") {
    throw new Error("OIDC ID token claims must be a JSON object.");
  }

  return value as Record<string, unknown>;
}

function parseJsonPart(encodedValue: string, label: string): unknown {
  try {
    return JSON.parse(textDecoder.decode(decodeBase64Url(encodedValue)));
  } catch {
    throw new Error(`${label} is not valid base64url JSON.`);
  }
}

async function readVerificationJwk(jwksUri: string, header: JwtHeader): Promise<OidcJsonWebKey> {
  const jwks = await fetchJwks(jwksUri);
  const candidates = jwks.keys.filter((key) => isUsableSigningKey(key, header.alg));
  const matchingKeys = header.kid ? candidates.filter((key) => key.kid === header.kid) : candidates;

  const matchingKey = matchingKeys[0];

  if (matchingKeys.length !== 1 || !matchingKey) {
    throw new Error("OIDC JWKS did not contain exactly one matching verification key.");
  }

  return matchingKey;
}

async function fetchJwks(jwksUri: string): Promise<JwksDocument> {
  const url = parseHttpIntegrationUrl(jwksUri, "OIDC JWKS").toString();
  const cached = jwksCache.get(url);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.document;
  }

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`OIDC JWKS request failed with status ${response.status}.`);
  }

  const document = validateJwksDocument(await response.json());
  jwksCache.set(url, { document, expiresAt: Date.now() + jwksCacheDurationMs });

  return document;
}

function validateJwksDocument(value: unknown): JwksDocument {
  if (!value || typeof value !== "object") {
    throw new Error("OIDC JWKS must be a JSON object.");
  }

  const keys = (value as Record<string, unknown>).keys;

  if (!Array.isArray(keys)) {
    throw new Error("OIDC JWKS keys must be an array.");
  }

  return {
    keys: keys.filter((key): key is OidcJsonWebKey => !!key && typeof key === "object"),
  };
}

async function verifyJwtSignature(
  jwt: {
    header: JwtHeader;
    signingInput: Uint8Array<ArrayBuffer>;
    signature: Uint8Array<ArrayBuffer>;
  },
  jwk: JsonWebKey,
): Promise<boolean> {
  const key = await crypto.subtle.importKey("jwk", jwk, keyImportAlgorithm(jwt.header.alg), false, [
    "verify",
  ]);

  return crypto.subtle.verify(
    verifyAlgorithm(jwt.header.alg),
    key,
    jwt.signature,
    jwt.signingInput,
  );
}

function keyImportAlgorithm(
  algorithm: SupportedJwtAlgorithm,
): RsaHashedImportParams | EcKeyImportParams {
  return algorithm === "RS256"
    ? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
    : { name: "ECDSA", namedCurve: "P-256" };
}

function verifyAlgorithm(algorithm: SupportedJwtAlgorithm): AlgorithmIdentifier | EcdsaParams {
  return algorithm === "RS256" ? { name: "RSASSA-PKCS1-v1_5" } : { name: "ECDSA", hash: "SHA-256" };
}

function validateIdTokenClaims(
  claims: Record<string, unknown>,
  input: { clientId: string; discovery: OidcDiscoveryDocument; expectedNonce: string },
): OidcIdTokenClaims {
  return {
    ...validateRegisteredClaims(claims, input),
    ...readOptionalProfileClaims(claims),
  };
}

function validateRegisteredClaims(
  claims: Record<string, unknown>,
  input: { clientId: string; discovery: OidcDiscoveryDocument; expectedNonce: string },
): Pick<OidcIdTokenClaims, "aud" | "azp" | "exp" | "iat" | "iss" | "nonce" | "sub"> {
  const issuer = claims.iss;
  const subject = claims.sub;
  const audience = normalizeAudience(claims.aud);
  const expiresAt = claims.exp;
  const issuedAt = claims.iat;
  const nonce = claims.nonce;
  const authorizedParty = claims.azp;

  if (issuer !== input.discovery.issuer) {
    throw new Error("OIDC ID token issuer does not match discovery issuer.");
  }

  if (typeof subject !== "string" || !subject) {
    throw new Error("OIDC ID token subject must be a non-empty string.");
  }

  if (!audience.includes(input.clientId)) {
    throw new Error("OIDC ID token audience does not include this client.");
  }

  const timing = validateTokenTiming(expiresAt, issuedAt);
  validateAuthorizedParty(authorizedParty, audience, input.clientId);

  if (nonce !== input.expectedNonce) {
    throw new Error("OIDC ID token nonce does not match OAuth state.");
  }

  const validatedClaims: OidcIdTokenClaims = {
    iss: issuer,
    sub: subject,
    aud: audience,
    exp: timing.expiresAt,
    iat: timing.issuedAt,
    nonce,
  };

  if (typeof authorizedParty === "string") {
    validatedClaims.azp = authorizedParty;
  }

  return validatedClaims;
}

function readOptionalProfileClaims(
  claims: Record<string, unknown>,
): Pick<OidcIdTokenClaims, "email" | "email_verified" | "name" | "preferred_username"> {
  const profileClaims: Pick<
    OidcIdTokenClaims,
    "email" | "email_verified" | "name" | "preferred_username"
  > = {};

  const preferredUsername = readOptionalStringClaim(claims.preferred_username);
  const name = readOptionalStringClaim(claims.name);
  const email = readOptionalStringClaim(claims.email);

  if (preferredUsername) {
    profileClaims.preferred_username = preferredUsername;
  }

  if (name) {
    profileClaims.name = name;
  }

  if (email) {
    profileClaims.email = email;
  }

  if (typeof claims.email_verified === "boolean") {
    profileClaims.email_verified = claims.email_verified;
  }

  return profileClaims;
}

function normalizeAudience(audience: unknown): string[] {
  if (typeof audience === "string") {
    return [audience];
  }

  return Array.isArray(audience)
    ? audience.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function validateTokenTiming(
  expiresAt: unknown,
  issuedAt: unknown,
): { expiresAt: number; issuedAt: number } {
  if (typeof expiresAt !== "number" || expiresAt + clockSkewSeconds <= Date.now() / 1000) {
    throw new Error("OIDC ID token is expired.");
  }

  if (typeof issuedAt !== "number" || issuedAt > Date.now() / 1000 + clockSkewSeconds) {
    throw new Error("OIDC ID token issued-at time is invalid.");
  }

  return { expiresAt, issuedAt };
}

function validateAuthorizedParty(
  authorizedParty: unknown,
  audience: readonly string[],
  clientId: string,
): void {
  if (authorizedParty !== undefined && authorizedParty !== clientId) {
    throw new Error("OIDC ID token authorized party does not match this client.");
  }

  if (audience.length > 1 && authorizedParty !== clientId) {
    throw new Error("OIDC ID token authorized party is required for multi-audience tokens.");
  }
}

function readOptionalStringClaim(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isUsableSigningKey(key: JsonWebKey, algorithm: SupportedJwtAlgorithm): boolean {
  if (key.use && key.use !== "sig") {
    return false;
  }

  if (Array.isArray(key.key_ops) && !key.key_ops.includes("verify")) {
    return false;
  }

  if (algorithm === "RS256") {
    return key.kty === "RSA" && typeof key.n === "string" && typeof key.e === "string";
  }

  return (
    key.kty === "EC" &&
    key.crv === "P-256" &&
    typeof key.x === "string" &&
    typeof key.y === "string"
  );
}

function isSupportedJwtAlgorithm(value: unknown): value is SupportedJwtAlgorithm {
  return typeof value === "string" && allowedJwtAlgorithms.some((algorithm) => algorithm === value);
}
