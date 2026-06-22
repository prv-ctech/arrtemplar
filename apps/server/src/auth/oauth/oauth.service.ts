import { Buffer } from "node:buffer";
import type {
  ApiErrorResponse,
  AuthPatchProviderRequest,
  AuthProviderResponse,
  AuthProviderSlug,
  AuthProviderSummary,
  AuthProvidersListResponse,
  AuthUpsertProviderRequest,
} from "@arrtemplar/shared";
import { SYSTEM_ADMIN_PERMISSION } from "@arrtemplar/shared";
import { eq } from "drizzle-orm";
import type { DatabaseClient } from "../../db/client";
import { type AuthProvider, authIdentities, authProviders } from "../../db/schema";
import {
  createOAuthRandomValue,
  createPkcePair,
  decryptOAuthClientSecret,
  encryptOAuthClientSecret,
  encryptOAuthIdToken,
} from "../../security/oauth-crypto";
import {
  createOAuthStateCookieValue,
  type OAuthStateMode,
  type OAuthStatePayload,
  verifyLogoutStateCookieValue,
  verifyOAuthStateCookieValue,
} from "../../security/oauth-state";
import type { AuthRequestContext, AuthService } from "../auth.service";
import { fetchOidcDiscovery, normalizeIssuerUrl, parseHttpIntegrationUrl } from "./discovery";
import { buildEndSessionRedirect } from "./end-session";
import { type OidcIdTokenClaims, verifyOidcIdToken } from "./jwks";

type OAuthServiceOptions = {
  encryptionKey: string | null;
  webOrigin: string;
};

type OAuthFailure<TStatus extends number> = {
  ok: false;
  status: TStatus;
  body: ApiErrorResponse;
};

type ProviderMutationResult =
  | { ok: true; body: AuthProviderResponse }
  | OAuthFailure<400 | 404 | 503>;

type ProviderDeleteResult = { ok: true; body: { status: "ok" } } | OAuthFailure<404>;

type OAuthStartResult =
  | {
      ok: true;
      authorizationUrl: string;
      stateCookieValue: string;
    }
  | OAuthFailure<400 | 401 | 403 | 404 | 502 | 503>;

type OAuthCallbackResult =
  | {
      ok: true;
      location: string;
      sessionToken?: string;
      expiresAt?: Date;
    }
  | OAuthFailure<400 | 401 | 403 | 404 | 409 | 502 | 503>;

type OAuthCallbackStateResult =
  | { ok: true; encryptionKey: string; provider: AuthProvider; statePayload: OAuthStatePayload }
  | OAuthFailure<400 | 404 | 503>;

type LogoutResult =
  | { kind: "local" }
  | { kind: "sso"; html: string; logoutStateCookieValue: string };

type NormalizedProviderConfig = {
  label: string;
  issuer: string;
  clientId: string;
  scopes: string;
  redirectUris: string[];
  enabled: boolean;
};

type TokenResponse = {
  accessToken?: string;
  idToken: string;
};

const oauthEncryptionKeyRequiredError = createApiError(
  "OAUTH_ENCRYPTION_KEY_REQUIRED",
  "OAuth client secret encryption key is required before enabling or storing a provider secret.",
);
const oauthProviderNotFoundError = createApiError(
  "OAUTH_PROVIDER_NOT_FOUND",
  "OAuth provider is not configured or enabled.",
);
const oauthInvalidProviderConfigError = createApiError(
  "OAUTH_PROVIDER_CONFIG_INVALID",
  "OAuth provider configuration is invalid.",
);
const oauthStateInvalidError = createApiError(
  "OAUTH_STATE_INVALID",
  "OAuth state is invalid or expired.",
);
const oauthProviderUnavailableError = createApiError(
  "OAUTH_PROVIDER_UNAVAILABLE",
  "OAuth provider could not be reached or returned invalid data.",
);
const oauthTokenInvalidError = createApiError("OAUTH_TOKEN_INVALID", "OAuth ID token is invalid.");

export class OAuthService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly authService: AuthService,
    private readonly options: OAuthServiceOptions,
  ) {}

  listProviders(): AuthProvidersListResponse {
    return {
      providers: this.database.db
        .select()
        .from(authProviders)
        .all()
        .map(toProviderSummary)
        .sort((left, right) => left.label.localeCompare(right.label)),
    };
  }

  async upsertProvider(
    slug: AuthProviderSlug,
    input: AuthUpsertProviderRequest,
  ): Promise<ProviderMutationResult> {
    const existing = this.findProvider(slug);
    const normalized = normalizeProviderConfig(input);

    if (!normalized) {
      return { ok: false, status: 400, body: oauthInvalidProviderConfigError };
    }

    if ((normalized.enabled || input.clientSecret !== undefined) && !this.options.encryptionKey) {
      return { ok: false, status: 503, body: oauthEncryptionKeyRequiredError };
    }

    let clientSecretEncrypted = existing?.clientSecretEncrypted;
    let masterKeyId = existing?.masterKeyId;
    const clientSecret = normalizeOptionalSecret(input.clientSecret);

    if (input.clientSecret !== undefined) {
      if (!clientSecret || !this.options.encryptionKey) {
        return { ok: false, status: 400, body: oauthInvalidProviderConfigError };
      }

      const encrypted = await encryptOAuthClientSecret(clientSecret, this.options.encryptionKey);
      clientSecretEncrypted = encrypted.encrypted;
      masterKeyId = encrypted.masterKeyId;
    }

    if (!clientSecretEncrypted || !masterKeyId) {
      return { ok: false, status: 400, body: oauthInvalidProviderConfigError };
    }

    const now = new Date().toISOString();

    if (existing) {
      this.database.db
        .update(authProviders)
        .set({
          ...normalized,
          redirectUris: JSON.stringify(normalized.redirectUris),
          clientSecretEncrypted,
          masterKeyId,
          updatedAt: now,
        })
        .where(eq(authProviders.slug, slug))
        .run();
    } else {
      this.database.db
        .insert(authProviders)
        .values({
          id: Bun.randomUUIDv7(),
          slug,
          ...normalized,
          redirectUris: JSON.stringify(normalized.redirectUris),
          clientSecretEncrypted,
          masterKeyId,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    const provider = this.findProvider(slug);

    if (!provider) {
      return { ok: false, status: 404, body: oauthProviderNotFoundError };
    }

    return { ok: true, body: { provider: toProviderSummary(provider) } };
  }

  async patchProvider(
    slug: AuthProviderSlug,
    input: AuthPatchProviderRequest,
  ): Promise<ProviderMutationResult> {
    const existing = this.findProvider(slug);

    if (!existing) {
      return { ok: false, status: 404, body: oauthProviderNotFoundError };
    }

    return this.upsertProvider(slug, {
      label: input.label ?? existing.label,
      issuer: input.issuer ?? existing.issuer,
      clientId: input.clientId ?? existing.clientId,
      scopes: input.scopes ?? existing.scopes,
      redirectUris: input.redirectUris ?? parseStoredRedirectUris(existing.redirectUris),
      enabled: input.enabled ?? existing.enabled,
      ...(input.clientSecret !== undefined ? { clientSecret: input.clientSecret } : {}),
    });
  }

  deleteProvider(slug: AuthProviderSlug): ProviderDeleteResult {
    const existing = this.findProvider(slug);

    if (!existing) {
      return { ok: false, status: 404, body: oauthProviderNotFoundError };
    }

    this.database.db.transaction((tx) => {
      tx.delete(authIdentities).where(eq(authIdentities.provider, slug)).run();
      tx.delete(authProviders).where(eq(authProviders.slug, slug)).run();
    });

    return { ok: true, body: { status: "ok" } };
  }

  async buildAuthorizationRedirect(input: {
    linkToUserId?: string;
    mode: "link" | "login";
    provider: AuthProviderSlug;
    prompt?: "login";
    requestUrl: string;
    returnTo?: string;
  }): Promise<OAuthStartResult> {
    const provider = this.findEnabledProvider(input.provider);

    if (!provider) {
      return { ok: false, status: 404, body: oauthProviderNotFoundError };
    }

    if (input.mode === "link" && !input.linkToUserId) {
      return { ok: false, status: 401, body: oauthStateInvalidError };
    }

    if (!this.options.encryptionKey) {
      return { ok: false, status: 503, body: oauthEncryptionKeyRequiredError };
    }

    const redirectUri = resolveCallbackRedirectUri(provider, input.requestUrl);

    if (!redirectUri) {
      return { ok: false, status: 400, body: oauthInvalidProviderConfigError };
    }

    const returnTo = normalizeReturnTo(input.returnTo, this.options.webOrigin);

    if (!returnTo) {
      return { ok: false, status: 400, body: oauthStateInvalidError };
    }

    const discovery = await readDiscovery(provider.issuer);

    if (!discovery.ok) {
      return discovery;
    }

    const pkce = await createPkcePair();
    const state = createOAuthRandomValue();
    const nonce = createOAuthRandomValue();
    const authorizationUrl = new URL(discovery.document.authorizationEndpoint);

    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", provider.clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("scope", provider.scopes);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("nonce", nonce);
    authorizationUrl.searchParams.set("code_challenge", pkce.codeChallenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");

    if (input.prompt) {
      authorizationUrl.searchParams.set("prompt", input.prompt);
    }

    return {
      ok: true,
      authorizationUrl: authorizationUrl.toString(),
      stateCookieValue: await createOAuthStateCookieValue(
        {
          provider: provider.slug,
          state,
          nonce,
          codeVerifier: pkce.codeVerifier,
          mode: input.mode,
          ...(input.linkToUserId ? { linkToUserId: input.linkToUserId } : {}),
          returnTo,
          redirectUri,
        },
        this.options.encryptionKey,
      ),
    };
  }

  async completeCallback(input: {
    code: string;
    provider: AuthProviderSlug;
    requestUrl: string;
    sessionToken: string | null;
    state: string;
    stateCookieValue: string | undefined;
    context: AuthRequestContext;
  }): Promise<OAuthCallbackResult> {
    const stateResult = await this.verifyCallbackState(input);

    if (!stateResult.ok) {
      return stateResult;
    }

    const { encryptionKey, provider, statePayload } = stateResult;

    const discovery = await readDiscovery(provider.issuer);

    if (!discovery.ok) {
      return discovery;
    }

    const clientSecret = await readClientSecret(provider, encryptionKey);

    if (!clientSecret.ok) {
      return clientSecret;
    }

    const tokenResponse = await exchangeCode({
      code: input.code,
      codeVerifier: statePayload.codeVerifier,
      clientId: provider.clientId,
      clientSecret: clientSecret.value,
      redirectUri: statePayload.redirectUri,
      tokenEndpoint: discovery.document.tokenEndpoint,
    });

    if (!tokenResponse.ok) {
      return tokenResponse;
    }

    const claims = await readVerifiedClaims({
      authorizationCode: input.code,
      clientId: provider.clientId,
      discovery: discovery.document,
      expectedNonce: statePayload.nonce,
      idToken: tokenResponse.token.idToken,
      ...(tokenResponse.token.accessToken ? { accessToken: tokenResponse.token.accessToken } : {}),
    });

    if (!claims.ok) {
      return claims;
    }

    const identityInput = {
      provider: provider.slug,
      issuer: discovery.document.issuer,
      subject: claims.claims.sub,
      ...(claims.claims.preferred_username
        ? { preferredUsername: claims.claims.preferred_username }
        : {}),
      ...(claims.claims.name ? { name: claims.claims.name } : {}),
      ...(claims.claims.email ? { email: claims.claims.email } : {}),
    };

    if (statePayload.mode === "link") {
      return this.completeLinkCallback({
        identityInput,
        sessionToken: input.sessionToken,
        linkToUserId: statePayload.linkToUserId,
        context: input.context,
        returnTo: statePayload.returnTo,
      });
    }

    const idTokenEncrypted = await encryptOAuthIdToken(tokenResponse.token.idToken, encryptionKey);
    const loginResult = this.authService.completeOAuthLogin(identityInput, input.context, {
      provider: provider.slug,
      idTokenEncrypted: idTokenEncrypted.encrypted,
      masterKeyId: idTokenEncrypted.masterKeyId,
    });

    if (!loginResult.ok) {
      return loginResult;
    }

    return {
      ok: true,
      location: statePayload.returnTo,
      sessionToken: loginResult.sessionToken,
      expiresAt: loginResult.expiresAt,
    };
  }

  async readCallbackStateMode(input: {
    provider: AuthProviderSlug;
    requestUrl: string;
    state: string;
    stateCookieValue: string | undefined;
  }): Promise<OAuthStateMode | null> {
    const result = await this.verifyCallbackState(input);

    return result.ok ? result.statePayload.mode : null;
  }

  private async verifyCallbackState(input: {
    provider: AuthProviderSlug;
    requestUrl: string;
    state: string;
    stateCookieValue: string | undefined;
  }): Promise<OAuthCallbackStateResult> {
    const provider = this.findEnabledProvider(input.provider);

    if (!provider) {
      return { ok: false, status: 404, body: oauthProviderNotFoundError };
    }

    const encryptionKey = this.options.encryptionKey;

    if (!encryptionKey) {
      return { ok: false, status: 503, body: oauthEncryptionKeyRequiredError };
    }

    const statePayload = await verifyOAuthStateCookieValue(input.stateCookieValue, encryptionKey);

    if (
      !statePayload ||
      statePayload.provider !== provider.slug ||
      statePayload.state !== input.state ||
      statePayload.redirectUri !== resolveCallbackRedirectUri(provider, input.requestUrl)
    ) {
      return { ok: false, status: 400, body: oauthStateInvalidError };
    }

    return { ok: true, encryptionKey, provider, statePayload };
  }

  private completeLinkCallback(input: {
    identityInput: Parameters<AuthService["linkOAuthIdentityToAdmin"]>[0];
    sessionToken: string | null;
    linkToUserId: string | undefined;
    context: AuthRequestContext;
    returnTo: string;
  }): OAuthCallbackResult {
    if (!input.linkToUserId) {
      return { ok: false, status: 400, body: oauthStateInvalidError };
    }

    const currentUser = this.authService.getCurrentUser(input.sessionToken);

    if (!currentUser || currentUser.id !== input.linkToUserId) {
      return { ok: false, status: 401, body: oauthStateInvalidError };
    }

    const permissionResult = this.authService.requirePermission(
      input.sessionToken,
      SYSTEM_ADMIN_PERMISSION,
    );

    if (!permissionResult.ok) {
      return permissionResult;
    }

    const linked = this.authService.linkOAuthIdentityToAdmin(
      input.identityInput,
      permissionResult.user,
      input.context,
    );

    if (!linked.ok) {
      return linked;
    }

    return { ok: true, location: input.returnTo };
  }

  private findProvider(slug: AuthProviderSlug): AuthProvider | undefined {
    return this.database.db.select().from(authProviders).where(eq(authProviders.slug, slug)).get();
  }

  private findEnabledProvider(slug: AuthProviderSlug): AuthProvider | undefined {
    const provider = this.findProvider(slug);

    return provider?.enabled ? provider : undefined;
  }

  async buildLogout(input: {
    sessionToken: string | null;
    requestUrl: string;
  }): Promise<LogoutResult> {
    if (!this.options.encryptionKey) {
      return { kind: "local" };
    }

    const oauthSessionToken = this.authService.getOAuthLogoutToken(input.sessionToken);

    if (!oauthSessionToken) {
      return { kind: "local" };
    }

    const provider = this.findProvider(oauthSessionToken.provider);

    if (!provider) {
      return { kind: "local" };
    }

    const postLogoutRedirectUri = new URL("/api/auth/logout/callback", input.requestUrl).toString();
    const result = await buildEndSessionRedirect({
      provider,
      oauthSessionToken,
      encryptionKey: this.options.encryptionKey,
      postLogoutRedirectUri,
    });

    if (!result) {
      return { kind: "local" };
    }

    return {
      kind: "sso",
      html: result.html,
      logoutStateCookieValue: result.logoutStateCookieValue,
    };
  }

  async verifyLogoutState(input: {
    state: string;
    logoutStateCookieValue: string | undefined;
  }): Promise<boolean> {
    if (!this.options.encryptionKey) {
      return false;
    }

    const expectedState = await verifyLogoutStateCookieValue(
      input.logoutStateCookieValue,
      this.options.encryptionKey,
    );

    return !!expectedState && expectedState === input.state;
  }
}

async function readDiscovery(
  issuer: string,
): Promise<
  { ok: true; document: Awaited<ReturnType<typeof fetchOidcDiscovery>> } | OAuthFailure<502>
> {
  try {
    return { ok: true, document: await fetchOidcDiscovery(issuer) };
  } catch {
    return { ok: false, status: 502, body: oauthProviderUnavailableError };
  }
}

async function readClientSecret(
  provider: AuthProvider,
  encryptionKey: string,
): Promise<{ ok: true; value: string } | OAuthFailure<503>> {
  try {
    return {
      ok: true,
      value: await decryptOAuthClientSecret(provider.clientSecretEncrypted, encryptionKey),
    };
  } catch {
    return { ok: false, status: 503, body: oauthEncryptionKeyRequiredError };
  }
}

async function readVerifiedClaims(input: {
  accessToken?: string;
  authorizationCode: string;
  clientId: string;
  discovery: Awaited<ReturnType<typeof fetchOidcDiscovery>>;
  expectedNonce: string;
  idToken: string;
}): Promise<{ ok: true; claims: OidcIdTokenClaims } | OAuthFailure<401>> {
  try {
    return { ok: true, claims: await verifyOidcIdToken(input) };
  } catch {
    return { ok: false, status: 401, body: oauthTokenInvalidError };
  }
}

async function exchangeCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  tokenEndpoint: string;
}): Promise<{ ok: true; token: TokenResponse } | OAuthFailure<502>> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.codeVerifier,
  });

  try {
    const response = await fetch(input.tokenEndpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: createBasicAuthHeader(input.clientId, input.clientSecret),
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { ok: false, status: 502, body: oauthProviderUnavailableError };
    }

    return { ok: true, token: validateTokenResponse(await response.json()) };
  } catch {
    return { ok: false, status: 502, body: oauthProviderUnavailableError };
  }
}

function validateTokenResponse(value: unknown): TokenResponse {
  if (!value || typeof value !== "object") {
    throw new Error("OIDC token response must be a JSON object.");
  }

  const record = value as Record<string, unknown>;

  if (typeof record.id_token !== "string" || !record.id_token) {
    throw new Error("OIDC token response must include id_token.");
  }

  return {
    idToken: record.id_token,
    ...(typeof record.access_token === "string" && record.access_token
      ? { accessToken: record.access_token }
      : {}),
  };
}

function normalizeProviderConfig(
  input: AuthUpsertProviderRequest,
): NormalizedProviderConfig | null {
  const label = input.label.trim();
  const clientId = input.clientId.trim();
  const scopes = normalizeScopes(input.scopes);
  const redirectUris = normalizeRedirectUris(input.redirectUris);

  if (!label || !clientId || !scopes || redirectUris.length === 0) {
    return null;
  }

  try {
    return {
      label,
      issuer: normalizeIssuerUrl(input.issuer),
      clientId,
      scopes,
      redirectUris,
      enabled: input.enabled,
    };
  } catch {
    return null;
  }
}

function normalizeScopes(value: string): string | null {
  const scopes = [...new Set(value.trim().split(/\s+/u).filter(Boolean))];

  if (!scopes.includes("openid")) {
    return null;
  }

  return scopes.join(" ");
}

function normalizeRedirectUris(values: readonly string[]): string[] {
  const normalized = new Set<string>();

  for (const value of values) {
    try {
      const url = parseHttpIntegrationUrl(value, "OAuth redirect URI");
      url.hash = "";
      normalized.add(url.toString());
    } catch {
      return [];
    }
  }

  return [...normalized];
}

function parseStoredRedirectUris(value: string): string[] {
  const parsed = JSON.parse(value);

  return Array.isArray(parsed)
    ? parsed.filter((entry): entry is string => typeof entry === "string" && !!entry)
    : [];
}

function normalizeOptionalSecret(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function resolveCallbackRedirectUri(provider: AuthProvider, requestUrl: string): string | null {
  const callbackUrl = new URL(`/api/auth/callback/${provider.slug}`, requestUrl).toString();
  const configuredRedirectUris = parseStoredRedirectUris(provider.redirectUris);

  return configuredRedirectUris.includes(callbackUrl) ? callbackUrl : null;
}

function normalizeReturnTo(value: string | undefined, webOrigin: string): string | null {
  const allowedOrigin = new URL(webOrigin).origin;

  try {
    if (!value) {
      return new URL("/", webOrigin).toString();
    }

    if (value.startsWith("/") && !value.startsWith("//")) {
      return new URL(value, webOrigin).toString();
    }

    const url = parseHttpIntegrationUrl(value, "OAuth returnTo");

    return url.origin === allowedOrigin ? url.toString() : null;
  } catch {
    return null;
  }
}

function toProviderSummary(provider: AuthProvider): AuthProviderSummary {
  return {
    slug: provider.slug,
    label: provider.label,
    issuer: provider.issuer,
    clientId: provider.clientId,
    scopes: provider.scopes,
    redirectUris: parseStoredRedirectUris(provider.redirectUris),
    enabled: provider.enabled,
    hasClientSecret: provider.clientSecretEncrypted.length > 0,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

function createBasicAuthHeader(clientId: string, clientSecret: string): string {
  const credentials = `${formEncodeBasicComponent(clientId)}:${formEncodeBasicComponent(clientSecret)}`;

  return `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;
}

function formEncodeBasicComponent(value: string): string {
  return encodeURIComponent(value).replaceAll("%20", "+");
}

function createApiError(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}
