import { base64UrlEncode, decodeBase64Url } from "../../security/oauth-crypto";
import type { OidcDiscoveryDocument } from "./discovery";
import { parseHttpIntegrationUrl } from "./discovery";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const jwksCacheDurationMs = 5 * 60 * 1000;
const allowedJwtAlgorithms = ["RS256", "ES256"] as const;
const clockSkewSeconds = 60;
const backChannelLogoutEvent = "http://schemas.openid.net/event/backchannel-logout" as const;

type SupportedJwtAlgorithm = (typeof allowedJwtAlgorithms)[number];

export type OidcIdTokenClaims = {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce: string;
  azp?: string;
  sid?: string;
  at_hash?: string;
  c_hash?: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
};

export type OidcLogoutTokenClaims = {
  iss: string;
  sub?: string;
  aud: string[];
  exp: number;
  iat: number;
  jti: string;
  events: { [backChannelLogoutEvent]: Record<string, unknown> };
  sid?: string;
};

export type OidcUserinfoClaims = {
  sub: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
};

export type OidcLogoutTokenProviderCandidate = {
  issuer: string;
  audiences: string[];
};

type JwtHeader = {
  alg: SupportedJwtAlgorithm;
  kid: string | null;
  typ?: string;
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
  accessToken?: string;
  authorizationCode?: string;
  clientId: string;
  discovery: OidcDiscoveryDocument;
  expectedNonce: string;
  idToken: string;
  signingAlgorithm?: SupportedJwtAlgorithm;
  timeoutMs?: number;
}): Promise<OidcIdTokenClaims> {
  const jwt = parseJwt(input.idToken, "OIDC ID token");
  const supportedAlgorithms =
    input.discovery.idTokenSigningAlgValuesSupported.filter(isSupportedJwtAlgorithm);

  if (input.signingAlgorithm && jwt.header.alg !== input.signingAlgorithm) {
    throw new Error("OIDC ID token algorithm does not match provider settings.");
  }

  if (!supportedAlgorithms.includes(jwt.header.alg)) {
    throw new Error("OIDC ID token algorithm is not supported by the configured provider.");
  }

  const jwk = await readVerificationJwk(input.discovery.jwksUri, jwt.header, input.timeoutMs);
  const verified = await verifyJwtSignature(jwt, jwk);

  if (!verified) {
    throw new Error("OIDC ID token signature is invalid.");
  }

  return validateIdTokenClaims(jwt.claims, input);
}

export function readOidcLogoutTokenProviderCandidate(
  logoutToken: string,
): OidcLogoutTokenProviderCandidate | null {
  try {
    const jwt = parseJwt(logoutToken, "OIDC logout token");
    const issuer = jwt.claims.iss;
    const audiences = normalizeAudience(jwt.claims.aud);

    if (typeof issuer !== "string" || !issuer || audiences.length === 0) {
      return null;
    }

    return { issuer, audiences };
  } catch {
    return null;
  }
}

export async function verifyOidcLogoutToken(input: {
  clientId: string;
  discovery: OidcDiscoveryDocument;
  logoutToken: string;
  signingAlgorithm?: SupportedJwtAlgorithm;
  timeoutMs?: number;
}): Promise<OidcLogoutTokenClaims> {
  const jwt = parseJwt(input.logoutToken, "OIDC logout token");
  const supportedAlgorithms =
    input.discovery.idTokenSigningAlgValuesSupported.filter(isSupportedJwtAlgorithm);

  if (input.signingAlgorithm && jwt.header.alg !== input.signingAlgorithm) {
    throw new Error("OIDC logout token algorithm does not match provider settings.");
  }

  if (!supportedAlgorithms.includes(jwt.header.alg)) {
    throw new Error("OIDC logout token algorithm is not supported by the configured provider.");
  }

  const jwk = await readVerificationJwk(input.discovery.jwksUri, jwt.header, input.timeoutMs);
  const verified = await verifyJwtSignature(jwt, jwk);

  if (!verified) {
    throw new Error("OIDC logout token signature is invalid.");
  }

  return validateLogoutTokenClaims(jwt.claims, input);
}

export async function verifyOidcUserinfoToken(input: {
  clientId: string;
  discovery: OidcDiscoveryDocument;
  signingAlgorithm: SupportedJwtAlgorithm;
  timeoutMs?: number;
  userinfoToken: string;
}): Promise<OidcUserinfoClaims> {
  const jwt = parseJwt(input.userinfoToken, "OIDC userinfo token");
  const supportedAlgorithms =
    input.discovery.idTokenSigningAlgValuesSupported.filter(isSupportedJwtAlgorithm);

  if (jwt.header.alg !== input.signingAlgorithm) {
    throw new Error("OIDC userinfo token algorithm does not match provider settings.");
  }

  if (!supportedAlgorithms.includes(jwt.header.alg)) {
    throw new Error("OIDC userinfo token algorithm is not supported by the configured provider.");
  }

  const jwk = await readVerificationJwk(input.discovery.jwksUri, jwt.header, input.timeoutMs);
  const verified = await verifyJwtSignature(jwt, jwk);

  if (!verified) {
    throw new Error("OIDC userinfo token signature is invalid.");
  }

  return validateUserinfoClaims(jwt.claims, input);
}

function parseJwt(
  value: string,
  label: string,
): {
  header: JwtHeader;
  claims: Record<string, unknown>;
  signingInput: Uint8Array<ArrayBuffer>;
  signature: Uint8Array<ArrayBuffer>;
} {
  const [encodedHeader, encodedPayload, encodedSignature, extra] = value.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature || extra !== undefined) {
    throw new Error(`${label} must be a compact JWT.`);
  }

  const header = parseJwtHeader(encodedHeader, label);
  const claims = parseJwtClaims(encodedPayload, label);

  return {
    header,
    claims,
    signingInput: textEncoder.encode(`${encodedHeader}.${encodedPayload}`),
    signature: decodeBase64Url(encodedSignature),
  };
}

function parseJwtHeader(encodedHeader: string, label: string): JwtHeader {
  const value = parseJsonPart(encodedHeader, `${label} header`);

  if (!value || typeof value !== "object") {
    throw new Error(`${label} header must be a JSON object.`);
  }

  const header = value as Record<string, unknown>;
  const algorithm = header.alg;

  if (!isSupportedJwtAlgorithm(algorithm)) {
    throw new Error(`${label} algorithm must be RS256 or ES256.`);
  }

  return {
    alg: algorithm,
    kid: typeof header.kid === "string" && header.kid ? header.kid : null,
    ...(typeof header.typ === "string" && header.typ ? { typ: header.typ } : {}),
  };
}

function parseJwtClaims(encodedPayload: string, label: string): Record<string, unknown> {
  const value = parseJsonPart(encodedPayload, `${label} claims`);

  if (!value || typeof value !== "object") {
    throw new Error(`${label} claims must be a JSON object.`);
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

async function readVerificationJwk(
  jwksUri: string,
  header: JwtHeader,
  timeoutMs = 10_000,
): Promise<OidcJsonWebKey> {
  let jwks = await fetchJwks(jwksUri, { timeoutMs });
  const candidates = jwks.keys.filter((key) => isUsableSigningKey(key, header.alg));
  let matchingKeys = header.kid ? candidates.filter((key) => key.kid === header.kid) : candidates;

  if (header.kid && matchingKeys.length === 0) {
    jwks = await fetchJwks(jwksUri, { refresh: true, timeoutMs });
    matchingKeys = jwks.keys
      .filter((key) => isUsableSigningKey(key, header.alg))
      .filter((key) => key.kid === header.kid);
  }

  const matchingKey = matchingKeys[0];

  if (matchingKeys.length !== 1 || !matchingKey) {
    throw new Error("OIDC JWKS did not contain exactly one matching verification key.");
  }

  return matchingKey;
}

async function fetchJwks(
  jwksUri: string,
  options: { refresh?: boolean; timeoutMs?: number } = {},
): Promise<JwksDocument> {
  const url = parseHttpIntegrationUrl(jwksUri, "OIDC JWKS").toString();
  const cached = jwksCache.get(url);

  if (!options.refresh && cached && cached.expiresAt > Date.now()) {
    return cached.document;
  }

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
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

async function validateIdTokenClaims(
  claims: Record<string, unknown>,
  input: {
    accessToken?: string;
    authorizationCode?: string;
    clientId: string;
    discovery: OidcDiscoveryDocument;
    expectedNonce: string;
  },
): Promise<OidcIdTokenClaims> {
  await validateTokenHashClaims(claims, input);

  return {
    ...validateRegisteredClaims(claims, input),
    ...readOptionalTokenHashClaims(claims),
    ...readOptionalProfileClaims(claims),
  };
}

function validateLogoutTokenClaims(
  claims: Record<string, unknown>,
  input: { clientId: string; discovery: OidcDiscoveryDocument },
): OidcLogoutTokenClaims {
  const issuer = claims.iss;
  const audience = normalizeAudience(claims.aud);
  const expiresAt = claims.exp;
  const issuedAt = claims.iat;
  const jwtId = claims.jti;
  const events = claims.events;
  const subject = readOptionalStringClaim(claims.sub);
  const sid = readOptionalStringClaim(claims.sid);

  if (issuer !== input.discovery.issuer) {
    throw new Error("OIDC logout token issuer does not match discovery issuer.");
  }

  if (!audience.includes(input.clientId)) {
    throw new Error("OIDC logout token audience does not include this client.");
  }

  const timing = validateTokenTiming(expiresAt, issuedAt, "OIDC logout token");

  if (typeof jwtId !== "string" || !jwtId) {
    throw new Error("OIDC logout token jti must be a non-empty string.");
  }

  if (claims.nonce !== undefined) {
    throw new Error("OIDC logout token must not include nonce.");
  }

  if (!subject && !sid) {
    throw new Error("OIDC logout token must include sub or sid.");
  }

  if (!events || typeof events !== "object" || Array.isArray(events)) {
    throw new Error("OIDC logout token events must be a JSON object.");
  }

  const logoutEvent = (events as Record<string, unknown>)[backChannelLogoutEvent];

  if (!logoutEvent || typeof logoutEvent !== "object" || Array.isArray(logoutEvent)) {
    throw new Error("OIDC logout token events must include the back-channel logout event.");
  }

  return {
    iss: issuer,
    aud: audience,
    exp: timing.expiresAt,
    iat: timing.issuedAt,
    jti: jwtId,
    events: { [backChannelLogoutEvent]: logoutEvent as Record<string, unknown> },
    ...(subject ? { sub: subject } : {}),
    ...(sid ? { sid } : {}),
  };
}

function validateUserinfoClaims(
  claims: Record<string, unknown>,
  input: { clientId: string; discovery: OidcDiscoveryDocument },
): OidcUserinfoClaims {
  const subject = claims.sub;

  if (typeof subject !== "string" || !subject) {
    throw new Error("OIDC userinfo subject must be a non-empty string.");
  }

  if (claims.iss !== undefined && claims.iss !== input.discovery.issuer) {
    throw new Error("OIDC userinfo issuer does not match discovery issuer.");
  }

  if (claims.aud !== undefined && !normalizeAudience(claims.aud).includes(input.clientId)) {
    throw new Error("OIDC userinfo audience does not include this client.");
  }

  validateOptionalTokenTiming(claims, "OIDC userinfo token");

  return {
    sub: subject,
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

  const timing = validateTokenTiming(expiresAt, issuedAt, "OIDC ID token");
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
): Pick<OidcIdTokenClaims, "email" | "email_verified" | "name" | "preferred_username" | "sid"> {
  const profileClaims: Pick<
    OidcIdTokenClaims,
    "email" | "email_verified" | "name" | "preferred_username" | "sid"
  > = {};

  const sid = readOptionalStringClaim(claims.sid);
  const preferredUsername = readOptionalStringClaim(claims.preferred_username);
  const name = readOptionalStringClaim(claims.name);
  const email = readOptionalStringClaim(claims.email);

  if (sid) {
    profileClaims.sid = sid;
  }

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

function readOptionalTokenHashClaims(
  claims: Record<string, unknown>,
): Pick<OidcIdTokenClaims, "at_hash" | "c_hash"> {
  const hashClaims: Pick<OidcIdTokenClaims, "at_hash" | "c_hash"> = {};

  if (typeof claims.c_hash === "string") {
    hashClaims.c_hash = claims.c_hash;
  }

  if (typeof claims.at_hash === "string") {
    hashClaims.at_hash = claims.at_hash;
  }

  return hashClaims;
}

async function validateTokenHashClaims(
  claims: Record<string, unknown>,
  input: {
    accessToken?: string;
    authorizationCode?: string;
  },
): Promise<void> {
  await validateTokenHashClaim("c_hash", claims.c_hash, input.authorizationCode);
  await validateTokenHashClaim("at_hash", claims.at_hash, input.accessToken);
}

async function validateTokenHashClaim(
  claimName: "at_hash" | "c_hash",
  claimValue: unknown,
  tokenValue: string | undefined,
): Promise<void> {
  if (claimValue === undefined) {
    return;
  }

  if (typeof claimValue !== "string" || !claimValue) {
    throw new Error(`OIDC ID token ${claimName} must be a non-empty string.`);
  }

  if (!tokenValue) {
    throw new Error(`OIDC ID token ${claimName} cannot be verified without its source token.`);
  }

  const expected = await createTokenHashClaim(tokenValue);

  if (claimValue !== expected) {
    throw new Error(`OIDC ID token ${claimName} does not match.`);
  }
}

async function createTokenHashClaim(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));

  return base64UrlEncode(digest.slice(0, digest.byteLength / 2));
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
  label: string,
): { expiresAt: number; issuedAt: number } {
  if (typeof expiresAt !== "number" || expiresAt + clockSkewSeconds <= Date.now() / 1000) {
    throw new Error(`${label} is expired.`);
  }

  if (typeof issuedAt !== "number" || issuedAt > Date.now() / 1000 + clockSkewSeconds) {
    throw new Error(`${label} issued-at time is invalid.`);
  }

  return { expiresAt, issuedAt };
}

function validateOptionalTokenTiming(claims: Record<string, unknown>, label: string): void {
  if (claims.exp === undefined && claims.iat === undefined) {
    return;
  }

  validateTokenTiming(claims.exp, claims.iat, label);
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
