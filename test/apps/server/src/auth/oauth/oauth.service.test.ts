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
        provider: "authentik",
        issuer,
        subject: "stable-authentik-sub",
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
        provider: "authentik",
        issuer,
        subject: "stable-authentik-sub",
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
      provider: "authentik",
      issuer,
      subject: "stable-authentik-sub",
      userId: storedUsers[0]?.id,
    });
    expect(database.db.select().from(sessions).all()).toHaveLength(2);
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
        provider: "authentik",
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
        provider: "authentik",
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
        provider: "authentik",
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
        provider: "authentik",
        issuer,
        subject: "taken-subject",
        createdAt: new Date().toISOString(),
      })
      .run();

    const takeoverResult = authService.linkOAuthIdentityToAdmin(
      {
        provider: "authentik",
        issuer,
        subject: "taken-subject",
      },
      toPublicActor(adminUser, [SYSTEM_ADMIN_PERMISSION]),
      context,
    );

    expect(linkResult.identity).toMatchObject({
      provider: "authentik",
      issuer,
      subject: "admin-subject",
    });
    expect(nonAdminResult).toMatchObject({ ok: false, status: 403 });
    expect(takeoverResult).toMatchObject({ ok: false, status: 409 });
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
        slug: "authentik",
        label: "Authentik",
        issuer,
        clientId: "template-client",
        clientSecretEncrypted: "ciphertext",
        masterKeyId: "oauth-client-secret-v1",
        scopes: testScopes,
        redirectUris: JSON.stringify(["http://localhost:3000/api/auth/callback/authentik"]),
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
          provider: "authentik",
          issuer,
          subject: "old-issuer-subject",
          createdAt: now,
        },
        {
          id: Bun.randomUUIDv7(),
          userId: user.id,
          provider: "authentik",
          issuer: "https://auth.example.test/application/o/renamed-template-app/",
          subject: "new-issuer-subject",
          createdAt: now,
        },
      ])
      .run();

    expect(oauthService.deleteProvider("authentik")).toEqual({ ok: true, body: { status: "ok" } });
    expect(database.db.select().from(authIdentities).all()).toHaveLength(0);
  });

  it("can force the provider login prompt for post-sign-out Authentik redirects", async () => {
    const database = await createDatabase();
    const authService = new AuthService(database);
    const oauthService = new OAuthService(database, authService, {
      encryptionKey: "00".repeat(32),
      webOrigin: "http://localhost:5173",
    });
    let promptIssuer = "";
    const discoveryServer = Bun.serve({
      port: 0,
      fetch: (_request: Request) =>
        Response.json({
          issuer: promptIssuer,
          authorization_endpoint: `${promptIssuer}authorize/`,
          token_endpoint: `${promptIssuer}token/`,
          jwks_uri: `${promptIssuer}jwks/`,
          id_token_signing_alg_values_supported: ["RS256"],
        }),
    });

    promptIssuer = new URL("/application/o/prompt-login/", discoveryServer.url).toString();
    insertEnabledProvider(database, promptIssuer);

    try {
      const result = await oauthService.buildAuthorizationRedirect({
        mode: "login",
        provider: "authentik",
        prompt: "login",
        requestUrl: "http://localhost:3000/api/auth/oauth/authentik/start?prompt=login",
      });

      if (!result.ok) {
        throw new Error(result.body.error.message);
      }

      expect(new URL(result.authorizationUrl).searchParams.get("prompt")).toBe("login");
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

function insertEnabledProvider(database: DatabaseClient, providerIssuer: string): void {
  const now = new Date().toISOString();

  database.db
    .insert(authProviders)
    .values({
      id: Bun.randomUUIDv7(),
      slug: "authentik",
      label: "Authentik",
      issuer: providerIssuer,
      clientId: "template-client",
      clientSecretEncrypted: "ciphertext",
      masterKeyId: "oauth-client-secret-v1",
      scopes: testScopes,
      redirectUris: JSON.stringify(["http://localhost:3000/api/auth/callback/authentik"]),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}
