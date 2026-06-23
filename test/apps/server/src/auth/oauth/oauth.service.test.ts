import { afterEach, describe, expect, it } from "bun:test";
import {
  type AuthRequestContext,
  AuthService,
} from "../../../../../../apps/server/src/auth/auth.service";
import { OAuthService } from "../../../../../../apps/server/src/auth/oauth/oauth.service";
import { hashPassword } from "../../../../../../apps/server/src/auth/password";
import { generatePublicUserId } from "../../../../../../apps/server/src/auth/public-user-id";
import type { DatabaseClient } from "../../../../../../apps/server/src/db/client";
import {
  authIdentities,
  authProviders,
  sessions,
  type User,
  userPermissionGrants,
  users,
} from "../../../../../../apps/server/src/db/schema";
import { encryptOAuthIdToken } from "../../../../../../apps/server/src/security/oauth-crypto";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  OAUTH_LOCAL_EMAIL_DOMAIN,
  type PublicUser,
  SYSTEM_ADMIN_PERMISSION,
  type UserPermission,
} from "../../../../../../packages/shared/src";
import { openTestDatabase, resetTestDatabase } from "../../../../../helpers/database";

const DEFAULT_PASSWORD = "correct-horse-battery-staple";
const issuer = "https://auth.example.test/application/o/template-app/";
const testScopes = ["openid", "profile", "email"].join(" ");
const context: AuthRequestContext = { ipAddress: "127.0.0.1", userAgent: "oauth-test" };
const encryptionKey = "hex:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const openDatabases: DatabaseClient[] = [];

afterEach(() => {
  for (const database of openDatabases.splice(0)) {
    database.close();
  }
});

describe("OAuth auth service", () => {
  it("auto-creates an OAuth user by subject and reuses it on repeat login", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);

    const firstLogin = authService.completeOAuthLogin(
      {
        provider: "oidc",
        issuer,
        subject: "stable-oidc-sub",
        preferredUsername: "cnonajulca",
        email: "plex-user@example.test",
      },
      context,
    );

    if (!firstLogin.ok) {
      throw new Error(firstLogin.body.error.message);
    }

    const secondLogin = authService.completeOAuthLogin(
      {
        provider: "oidc",
        issuer,
        subject: "stable-oidc-sub",
        preferredUsername: "changed-name",
        email: "changed@example.test",
      },
      context,
    );

    if (!secondLogin.ok) {
      throw new Error(secondLogin.body.error.message);
    }

    const storedUsers = database.db.select().from(users).all();
    const storedIdentities = database.db.select().from(authIdentities).all();

    expect(firstLogin.user.id).toBe(secondLogin.user.id);
    expect(storedUsers).toHaveLength(1);
    expect(storedUsers[0]).toMatchObject({
      authMethod: "oauth",
      email: "plex-user@example.test",
      passwordHash: "!oauth",
      username: "cnonajulca",
    });
    expect(storedIdentities).toHaveLength(1);
    expect(storedIdentities[0]).toMatchObject({
      provider: "oidc",
      issuer,
      subject: "stable-oidc-sub",
      preferredUsername: "changed-name",
      email: "changed@example.test",
      userId: storedUsers[0]?.id,
    });
    expect(database.db.select().from(sessions).all()).toHaveLength(2);
  });

  it("refuses unknown OAuth users when auto-registration is disabled", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);

    const result = authService.completeOAuthLogin(
      {
        provider: "oidc",
        issuer,
        subject: "new-disabled-subject",
        preferredUsername: "blocked-user",
        email: "blocked-user@example.test",
      },
      context,
      undefined,
      { autoRegister: false },
    );

    expect(result).toMatchObject({
      ok: false,
      status: 401,
      body: { error: { code: "OAUTH_AUTO_REGISTER_DISABLED" } },
    });
    expect(database.db.select().from(users).all()).toHaveLength(0);
    expect(database.db.select().from(authIdentities).all()).toHaveLength(0);
  });

  it("persists the encrypted OAuth ID token only on the new login session", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);

    const firstLogin = authService.completeOAuthLogin(
      {
        provider: "oidc",
        issuer,
        subject: "token-subject",
        preferredUsername: "token-user",
        email: "token-user@example.test",
      },
      context,
      {
        provider: "oidc",
        idTokenEncrypted: "first-encrypted-id-token",
        masterKeyId: "first-master-key-id",
        sid: "first-provider-session",
      },
    );

    if (!firstLogin.ok) {
      throw new Error(firstLogin.body.error.message);
    }

    authService.completeOAuthLogin(
      {
        provider: "oidc",
        issuer,
        subject: "token-subject",
        preferredUsername: "token-user",
        email: "token-user@example.test",
      },
      context,
      {
        provider: "oidc",
        idTokenEncrypted: "second-encrypted-id-token",
        masterKeyId: "second-master-key-id",
        sid: "second-provider-session",
      },
    );

    const storedSessions = database.db.select().from(sessions).all();

    expect(storedSessions).toHaveLength(2);
    expect(
      storedSessions.some(
        (session) =>
          session.oauthProvider === "oidc" &&
          session.oauthIdTokenEncrypted === "first-encrypted-id-token" &&
          session.oauthMasterKeyId === "first-master-key-id" &&
          session.oauthSid === "first-provider-session",
      ),
    ).toBe(true);
    expect(
      storedSessions.some(
        (session) =>
          session.oauthProvider === "oidc" &&
          session.oauthIdTokenEncrypted === "second-encrypted-id-token" &&
          session.oauthMasterKeyId === "second-master-key-id" &&
          session.oauthSid === "second-provider-session",
      ),
    ).toBe(true);
  });

  it("stores null oauth sid when the ID token has no session id", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);

    const login = authService.completeOAuthLogin(
      {
        provider: "oidc",
        issuer,
        subject: "sidless-subject",
        preferredUsername: "sidless-user",
        email: "sidless-user@example.test",
      },
      context,
      {
        provider: "oidc",
        idTokenEncrypted: "sidless-encrypted-id-token",
        masterKeyId: "sidless-master-key-id",
      },
    );

    if (!login.ok) {
      throw new Error(login.body.error.message);
    }

    const storedSession = database.db.select().from(sessions).get();

    expect(storedSession?.oauthSid).toBeNull();
  });

  it("leaves OAuth token columns null for local sessions", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);
    await insertUser(database, {
      username: "local-owner",
      email: "local@example.test",
      permissions: [SYSTEM_ADMIN_PERMISSION],
    });

    const login = await authService.login(
      { email: "local@example.test", password: DEFAULT_PASSWORD },
      context,
    );

    if (!login.ok) {
      throw new Error(login.body.error.message);
    }

    const storedSession = database.db.select().from(sessions).get();

    if (!storedSession) {
      throw new Error("Expected local login to create a session.");
    }

    expect(storedSession.oauthProvider).toBeNull();
    expect(storedSession.oauthIdTokenEncrypted).toBeNull();
    expect(storedSession.oauthMasterKeyId).toBeNull();
    expect(storedSession.oauthSid).toBeNull();
  });

  it("does not key OAuth users by email and blocks local login for OAuth accounts", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);
    const localUser = await insertUser(database, {
      username: "local-owner",
      email: "shared@example.test",
      permissions: [SYSTEM_ADMIN_PERMISSION],
    });

    const oauthLogin = authService.completeOAuthLogin(
      {
        provider: "oidc",
        issuer,
        subject: "different-subject-same-email",
        preferredUsername: "local-owner",
        email: "shared@example.test",
      },
      context,
    );

    if (!oauthLogin.ok) {
      throw new Error(oauthLogin.body.error.message);
    }

    const oauthUser = database.db
      .select()
      .from(users)
      .all()
      .find((user) => user.publicId === oauthLogin.user.id);

    expect(oauthUser?.id).not.toBe(localUser.id);
    expect(oauthUser?.email).toEndWith(`@${OAUTH_LOCAL_EMAIL_DOMAIN}`);
    expect(oauthUser?.username).toContain("local-owner-");
    expect(
      (await authService.login({ email: oauthUser?.email ?? "", password: "anything" }, context))
        .ok,
    ).toBe(false);
  });

  it("links identities only to admins and rejects takeover attempts", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);
    const adminUser = await insertUser(database, {
      username: "admin",
      email: "admin@example.test",
      permissions: [SYSTEM_ADMIN_PERMISSION],
    });
    const normalUser = await insertUser(database, {
      username: "viewer",
      email: "viewer@example.test",
    });

    const linkResult = authService.linkOAuthIdentityToAdmin(
      {
        provider: "oidc",
        issuer,
        subject: "admin-subject",
      },
      toPublicActor(adminUser, [SYSTEM_ADMIN_PERMISSION]),
      context,
    );

    if (!linkResult.ok) {
      throw new Error(linkResult.body.error.message);
    }

    const nonAdminResult = authService.linkOAuthIdentityToAdmin(
      {
        provider: "oidc",
        issuer,
        subject: "viewer-subject",
      },
      toPublicActor(normalUser, []),
      context,
    );

    database.db
      .insert(authIdentities)
      .values({
        id: Bun.randomUUIDv7(),
        userId: normalUser.id,
        provider: "oidc",
        issuer,
        subject: "taken-subject",
        createdAt: new Date().toISOString(),
      })
      .run();

    const takeoverResult = authService.linkOAuthIdentityToAdmin(
      {
        provider: "oidc",
        issuer,
        subject: "taken-subject",
      },
      toPublicActor(adminUser, [SYSTEM_ADMIN_PERMISSION]),
      context,
    );

    expect(linkResult.identity).toMatchObject({
      provider: "oidc",
      subjectPreview: "admin-…ject",
    });
    expect(nonAdminResult).toMatchObject({ ok: false, status: 403 });
    expect(takeoverResult).toMatchObject({ ok: false, status: 409 });
  });

  it("returns safe linked identity display metadata", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);
    const adminUser = await insertUser(database, {
      username: "identity-admin",
      email: "identity-admin@example.test",
      permissions: [SYSTEM_ADMIN_PERMISSION],
    });

    insertEnabledProvider(database, issuer, { providerKind: "keycloak" });
    const linkResult = authService.linkOAuthIdentityToAdmin(
      {
        provider: "oidc",
        issuer,
        subject: "very-long-sensitive-subject-value",
        preferredUsername: "identity-handle",
        name: "Identity Name",
        email: "identity@example.test",
      },
      toPublicActor(adminUser, [SYSTEM_ADMIN_PERMISSION]),
      context,
    );

    if (!linkResult.ok) {
      throw new Error(linkResult.body.error.message);
    }

    expect(linkResult.identity).toMatchObject({
      provider: "oidc",
      providerKind: "keycloak",
      subjectPreview: "very-l…alue",
      displayName: "identity-handle",
      preferredUsername: "identity-handle",
      name: "Identity Name",
      email: "identity@example.test",
    });
    expect("subject" in linkResult.identity).toBe(false);
  });

  it("links multiple external OAuth identities to one local admin", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);
    const adminUser = await insertUser(database, {
      username: "multi-link-admin",
      email: "multi-link-admin@example.test",
      permissions: [SYSTEM_ADMIN_PERMISSION],
    });
    const actor = toPublicActor(adminUser, [SYSTEM_ADMIN_PERMISSION]);

    insertEnabledProvider(database, issuer);

    const firstResult = authService.linkOAuthIdentityToAdmin(
      {
        provider: "oidc",
        issuer,
        subject: "external-subject-one",
        preferredUsername: "external-one",
      },
      actor,
      context,
    );
    const secondResult = authService.linkOAuthIdentityToAdmin(
      {
        provider: "oidc",
        issuer,
        subject: "external-subject-two",
        preferredUsername: "external-two",
      },
      actor,
      context,
    );

    expect(firstResult).toMatchObject({ ok: true });
    expect(secondResult).toMatchObject({ ok: true });
    expect(
      database.db
        .select({
          userId: authIdentities.userId,
          preferredUsername: authIdentities.preferredUsername,
        })
        .from(authIdentities)
        .all(),
    ).toEqual([
      { userId: adminUser.id, preferredUsername: "external-one" },
      { userId: adminUser.id, preferredUsername: "external-two" },
    ]);
  });

  it("deleting a provider removes all identities for that provider slug", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);
    const oauthService = new OAuthService(database, authService, {
      encryptionKey: null,
      webOrigin: "http://localhost:5173",
    });
    const user = await insertUser(database, {
      username: "linked-user",
      email: "linked-user@example.test",
    });
    const now = new Date().toISOString();

    database.db
      .insert(authProviders)
      .values({
        id: Bun.randomUUIDv7(),
        slug: "oidc",
        label: "OIDC",
        issuer,
        clientId: "template-client",
        clientSecretEncrypted: "ciphertext",
        masterKeyId: "oauth-client-secret-v1",
        scopes: testScopes,
        redirectUris: JSON.stringify(["http://localhost:3000/api/auth/callback/oidc"]),
        enabled: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    database.db
      .insert(authIdentities)
      .values([
        {
          id: Bun.randomUUIDv7(),
          userId: user.id,
          provider: "oidc",
          issuer,
          subject: "old-issuer-subject",
          createdAt: now,
        },
        {
          id: Bun.randomUUIDv7(),
          userId: user.id,
          provider: "oidc",
          issuer: "https://auth.example.test/application/o/renamed-template-app/",
          subject: "new-issuer-subject",
          createdAt: now,
        },
      ])
      .run();

    expect(oauthService.deleteProvider("oidc")).toEqual({ ok: true, body: { status: "ok" } });
    expect(database.db.select().from(authIdentities).all()).toHaveLength(0);
  });

  it("builds an end-session redirect URI without logout parameters", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);
    const oauthService = new OAuthService(database, authService, {
      encryptionKey,
      webOrigin: "http://localhost:5173",
    });
    let logoutIssuer = "";
    const discoveryServer = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json({
          issuer: logoutIssuer,
          authorization_endpoint: `${logoutIssuer}authorize/`,
          token_endpoint: `${logoutIssuer}token/`,
          jwks_uri: `${logoutIssuer}jwks/`,
          end_session_endpoint: `${logoutIssuer}end-session/`,
          id_token_signing_alg_values_supported: ["RS256"],
        }),
    });

    logoutIssuer = new URL("/application/o/sso-logout/", discoveryServer.url).toString();
    insertEnabledProvider(database, logoutIssuer);

    try {
      const loginResult = authService.completeOAuthLogin(
        {
          provider: "oidc",
          issuer: logoutIssuer,
          subject: "logout-subject",
          preferredUsername: "logout-user",
          email: "logout-user@example.test",
        },
        context,
        {
          provider: "oidc",
          idTokenEncrypted: "unused-id-token",
          masterKeyId: "unused-master-key-id",
        },
      );

      if (!loginResult.ok) {
        throw new Error(loginResult.body.error.message);
      }

      const logout = await oauthService.buildLogout({
        sessionToken: loginResult.sessionToken,
      });
      expect(oauthService.deleteProvider("oidc")).toEqual({ ok: true, body: { status: "ok" } });
      if (logout.kind !== "sso") {
        throw new Error("Expected SSO logout redirect.");
      }

      const redirectUri = new URL(logout.redirectUri);

      expect(logout.redirectUri).toBe(`${logoutIssuer}end-session/`);
      expect(redirectUri.searchParams.has("id_token_hint")).toBe(false);
      expect(redirectUri.searchParams.has("post_logout_redirect_uri")).toBe(false);
      expect(redirectUri.searchParams.has("client_id")).toBe(false);
      expect(redirectUri.searchParams.has("state")).toBe(false);
    } finally {
      discoveryServer.stop(true);
    }
  });

  it("uses the configured end-session endpoint before discovery logout metadata", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);
    const oauthService = new OAuthService(database, authService, {
      encryptionKey,
      webOrigin: "http://localhost:5173",
    });
    const configuredIssuer = "https://auth.example.test/application/o/configured-logout/";
    const configuredLogoutUrl = `${configuredIssuer}logout/`;

    insertEnabledProvider(database, configuredIssuer, { endSessionEndpoint: configuredLogoutUrl });
    const loginResult = authService.completeOAuthLogin(
      {
        provider: "oidc",
        issuer: configuredIssuer,
        subject: "configured-logout-subject",
        preferredUsername: "configured-logout-user",
        email: "configured-logout-user@example.test",
      },
      context,
      {
        provider: "oidc",
        idTokenEncrypted: "unused-id-token",
        masterKeyId: "unused-master-key-id",
      },
    );

    if (!loginResult.ok) {
      throw new Error(loginResult.body.error.message);
    }

    await expect(
      oauthService.buildLogout({ sessionToken: loginResult.sessionToken }),
    ).resolves.toEqual({
      kind: "sso",
      redirectUri: configuredLogoutUrl,
    });
  });

  it("falls back to local logout when discovery has no end-session endpoint", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);
    const oauthService = new OAuthService(database, authService, {
      encryptionKey,
      webOrigin: "http://localhost:5173",
    });
    let noLogoutIssuer = "";
    const discoveryServer = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json({
          issuer: noLogoutIssuer,
          authorization_endpoint: `${noLogoutIssuer}authorize/`,
          token_endpoint: `${noLogoutIssuer}token/`,
          jwks_uri: `${noLogoutIssuer}jwks/`,
          id_token_signing_alg_values_supported: ["RS256"],
        }),
    });

    noLogoutIssuer = new URL("/application/o/no-sso-logout/", discoveryServer.url).toString();
    insertEnabledProvider(database, noLogoutIssuer);

    try {
      const encryptedIdToken = await encryptOAuthIdToken("test-id-token", encryptionKey);
      const loginResult = authService.completeOAuthLogin(
        {
          provider: "oidc",
          issuer: noLogoutIssuer,
          subject: "local-fallback-subject",
          preferredUsername: "fallback-user",
          email: "fallback-user@example.test",
        },
        context,
        {
          provider: "oidc",
          idTokenEncrypted: encryptedIdToken.encrypted,
          masterKeyId: encryptedIdToken.masterKeyId,
        },
      );

      if (!loginResult.ok) {
        throw new Error(loginResult.body.error.message);
      }

      await expect(
        oauthService.buildLogout({
          sessionToken: loginResult.sessionToken,
        }),
      ).resolves.toEqual({ kind: "local" });
    } finally {
      discoveryServer.stop(true);
    }
  });
});

async function createDatabase(): Promise<DatabaseClient> {
  await resetTestDatabase();
  const database = openTestDatabase();
  openDatabases.push(database);

  return database;
}

async function insertUser(
  database: DatabaseClient,
  input: { email: string; permissions?: UserPermission[]; username: string },
): Promise<User> {
  const now = new Date().toISOString();
  const user = {
    id: Bun.randomUUIDv7(),
    publicId: generatePublicUserId(),
    username: input.username,
    email: input.email,
    avatarId: DEFAULT_PROFILE_AVATAR_ID,
    bannerId: DEFAULT_PROFILE_BANNER_ID,
    toastNotificationsEnabled: DEFAULT_NOTIFICATION_PREFERENCES.toastsEnabled,
    toastNotificationFrequency: DEFAULT_NOTIFICATION_PREFERENCES.frequency,
    authMethod: "local",
    passwordHash: await hashPassword(DEFAULT_PASSWORD),
    disabledAt: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  } satisfies User;

  database.db.insert(users).values(user).run();

  if (input.permissions?.length) {
    database.db
      .insert(userPermissionGrants)
      .values(
        input.permissions.map((permission) => ({
          id: Bun.randomUUIDv7(),
          userId: user.id,
          permission,
          grantedByUserId: user.id,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();
  }

  return user;
}

function toPublicActor(user: User, permissions: UserPermission[]): PublicUser {
  return {
    id: user.publicId,
    username: user.username,
    email: user.email,
    avatarId: DEFAULT_PROFILE_AVATAR_ID,
    bannerId: DEFAULT_PROFILE_BANNER_ID,
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    permissions: [...DEFAULT_SIGNED_IN_USER_PERMISSIONS, ...permissions],
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function insertEnabledProvider(
  database: DatabaseClient,
  providerIssuer: string,
  options: { endSessionEndpoint?: string; providerKind?: "keycloak" } = {},
): void {
  const now = new Date().toISOString();

  database.db
    .insert(authProviders)
    .values({
      id: Bun.randomUUIDv7(),
      slug: "oidc",
      providerKind: options.providerKind ?? "custom",
      label: "OIDC",
      issuer: providerIssuer,
      clientId: "template-client",
      clientSecretEncrypted: "ciphertext",
      masterKeyId: "oauth-client-secret-v1",
      scopes: testScopes,
      redirectUris: JSON.stringify(["http://localhost:3000/api/auth/callback/oidc"]),
      enabled: true,
      ...(options.endSessionEndpoint ? { endSessionEndpoint: options.endSessionEndpoint } : {}),
      createdAt: now,
      updatedAt: now,
    })
    .run();
}
