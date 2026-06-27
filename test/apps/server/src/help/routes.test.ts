import { afterEach, describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import { ApiKeyService } from "../../../../../apps/server/src/auth/api-key.service";
import { hashPassword } from "../../../../../apps/server/src/auth/password";
import type { DatabaseClient } from "../../../../../apps/server/src/db/client";
import { helpTickets, userPermissionGrants, users } from "../../../../../apps/server/src/db/schema";
import {
  CSRF_HEADER_NAME,
  CSRF_HEADER_VALUE,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  DEFAULT_SIGNED_IN_USER_PERMISSIONS,
  type PublicUser,
  SYSTEM_ADMIN_PERMISSION,
  type UserPermission,
} from "../../../../../packages/shared/src";
import {
  closeServerTestDatabases,
  createServerTestApp,
  TEST_WEB_ORIGIN,
  type TestAppContext,
} from "../../../../helpers/server";

const DEFAULT_PASSWORD = "correct-horse-battery-staple";
const pngBytes = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z0f8AAAAASUVORK5CYII=",
    "base64",
  ),
);
const openDatabases: DatabaseClient[] = [];

afterEach(async () => {
  closeServerTestDatabases(openDatabases);
  const proc = Bun.spawn(["rm", "-rf", "data/media/ticket"]);
  await proc.exited;
});

describe("help routes", () => {
  it("lets a signed-in user create, list, view, and download their own ticket attachments", async () => {
    const { app, viewer } = await createHelpTestApp();
    const viewerCookie = await loginAndReadCookie(app, viewer.email);
    const createResponse = await app.handle(
      createMultipartTicketRequest(
        "/api/help/tickets",
        {
          title: "Playback issue",
          description: "Episode import is stuck.",
          attachments: [new File([pngBytes], "capture.png", { type: "image/png" })],
        },
        { cookie: viewerCookie },
      ),
    );
    const createBody = await createResponse.json();
    const ticketId = createBody.ticket.id;
    const attachmentId = createBody.ticket.attachments[0]?.id;

    expect(createResponse.status).toBe(200);
    expect(createBody.ticket).toMatchObject({
      id: expect.any(String),
      title: "Playback issue",
      description: "Episode import is stuck.",
      status: "new",
      attachmentCount: 1,
      createdBy: { id: viewer.id, username: viewer.username },
    });
    expect(createBody.ticket.attachments[0]).toMatchObject({
      mediaKind: "image",
      mimeType: "image/webp",
      originalFileName: "capture.png",
      width: 1,
      height: 1,
    });

    const listResponse = await app.handle(
      new Request("http://localhost/api/help/tickets?scope=mine", {
        headers: { cookie: viewerCookie },
      }),
    );
    const listBody = await listResponse.json();
    const detailResponse = await app.handle(
      new Request(`http://localhost/api/help/tickets/${ticketId}`, {
        headers: { cookie: viewerCookie },
      }),
    );
    const detailBody = await detailResponse.json();
    const attachmentResponse = await app.handle(
      new Request(`http://localhost/api/help/tickets/${ticketId}/attachments/${attachmentId}`, {
        headers: { cookie: viewerCookie },
      }),
    );

    expect(listResponse.status).toBe(200);
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0]?.id).toBe(ticketId);
    expect(detailResponse.status).toBe(200);
    expect(detailBody.ticket.id).toBe(ticketId);
    expect(attachmentResponse.status).toBe(200);
    expect(attachmentResponse.headers.get("content-type")).toBe("image/webp");
    expect((await attachmentResponse.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("blocks cross-user reads and all-ticket listing for non-managers", async () => {
    const { app, viewer, other } = await createHelpTestApp();
    const viewerCookie = await loginAndReadCookie(app, viewer.email);
    const otherCookie = await loginAndReadCookie(app, other.email);
    const createResponse = await app.handle(
      createMultipartTicketRequest(
        "/api/help/tickets",
        {
          title: "Indexer issue",
          description: "Indexer validation failed.",
          attachments: [],
        },
        { cookie: viewerCookie },
      ),
    );
    const createBody = await createResponse.json();

    const foreignDetailResponse = await app.handle(
      new Request(`http://localhost/api/help/tickets/${createBody.ticket.id}`, {
        headers: { cookie: otherCookie },
      }),
    );
    const forbiddenAllResponse = await app.handle(
      new Request("http://localhost/api/help/tickets?scope=all", {
        headers: { cookie: viewerCookie },
      }),
    );

    expect(foreignDetailResponse.status).toBe(403);
    expect(forbiddenAllResponse.status).toBe(403);
  });

  it("lets admins and API keys list all tickets and update status", async () => {
    const { app, database, admin, viewer } = await createHelpTestApp();
    const viewerCookie = await loginAndReadCookie(app, viewer.email);
    const adminCookie = await loginAndReadCookie(app, admin.email);
    const createResponse = await app.handle(
      createMultipartTicketRequest(
        "/api/help/tickets",
        {
          title: "Queue stalled",
          description: "Need admin review.",
          attachments: [],
        },
        { cookie: viewerCookie },
      ),
    );
    const createBody = await createResponse.json();
    const apiKeySecret = createAdminApiKeySecret(database, admin);

    const adminListResponse = await app.handle(
      new Request("http://localhost/api/help/tickets?scope=all", {
        headers: { cookie: adminCookie },
      }),
    );
    const adminListBody = await adminListResponse.json();
    const adminPatchResponse = await app.handle(
      createJsonRequest(
        `/api/help/tickets/${createBody.ticket.id}/status`,
        { status: "in_progress" },
        { cookie: adminCookie, method: "PATCH" },
      ),
    );
    const adminPatchBody = await adminPatchResponse.json();
    const apiKeyListResponse = await app.handle(
      new Request("http://localhost/api/help/tickets?scope=all", {
        headers: { authorization: `Bearer ${apiKeySecret}` },
      }),
    );
    const apiKeyPatchResponse = await app.handle(
      createJsonRequest(
        `/api/help/tickets/${createBody.ticket.id}/status`,
        { status: "completed" },
        { authorization: `Bearer ${apiKeySecret}`, includeCsrf: false, method: "PATCH" },
      ),
    );
    const apiKeyPatchBody = await apiKeyPatchResponse.json();
    const viewerDetailResponse = await app.handle(
      new Request(`http://localhost/api/help/tickets/${createBody.ticket.id}`, {
        headers: { cookie: viewerCookie },
      }),
    );
    const viewerDetailBody = await viewerDetailResponse.json();

    expect(adminListResponse.status).toBe(200);
    expect(adminListBody.items.map((item: { id: string }) => item.id)).toContain(
      createBody.ticket.id,
    );
    expect(adminPatchResponse.status).toBe(200);
    expect(adminPatchBody.ticket.status).toBe("in_progress");
    expect(apiKeyListResponse.status).toBe(200);
    expect(apiKeyPatchResponse.status).toBe(200);
    expect(apiKeyPatchBody.ticket.status).toBe("completed");
    expect(viewerDetailResponse.status).toBe(200);
    expect(viewerDetailBody.ticket.status).toBe("completed");
    expect(
      database.db
        .select()
        .from(helpTickets)
        .all()
        .some((row) => row.id === createBody.ticket.id),
    ).toBe(true);
  });
});

async function createHelpTestApp(): Promise<{
  app: TestAppContext["app"];
  database: DatabaseClient;
  admin: PublicUser;
  viewer: PublicUser;
  other: PublicUser;
}>;
async function createHelpTestApp(
  extraUsers: Array<{
    username: string;
    email: string;
    password: string;
    permissions?: UserPermission[];
  }>,
): Promise<{
  app: TestAppContext["app"];
  database: DatabaseClient;
  admin: PublicUser;
  viewer: PublicUser;
  other: PublicUser;
}>;
async function createHelpTestApp(
  extraUsers: Array<{
    username: string;
    email: string;
    password: string;
    permissions?: UserPermission[];
  }> = [],
) {
  const { app, database } = await createServerTestApp(openDatabases);

  await insertTestUser(database, {
    username: "admin",
    email: "admin@example.local",
    password: DEFAULT_PASSWORD,
    permissions: [SYSTEM_ADMIN_PERMISSION, "help:manage"],
  });
  await insertTestUser(database, {
    username: "viewer",
    email: "viewer@example.local",
    password: DEFAULT_PASSWORD,
  });
  await insertTestUser(database, {
    username: "other",
    email: "other@example.local",
    password: DEFAULT_PASSWORD,
  });

  for (const user of extraUsers) {
    await insertTestUser(database, user);
  }

  return {
    app,
    database,
    admin: requirePublicUserByEmail(database, "admin@example.local", [
      SYSTEM_ADMIN_PERMISSION,
      "help:manage",
    ]),
    viewer: requirePublicUserByEmail(database, "viewer@example.local"),
    other: requirePublicUserByEmail(database, "other@example.local"),
  };
}

async function insertTestUser(
  database: DatabaseClient,
  input: {
    username: string;
    email: string;
    password: string;
    permissions?: UserPermission[];
  },
): Promise<void> {
  const now = new Date().toISOString();
  const userId = Bun.randomUUIDv7();
  const publicId = createFixedPublicId(input.username);

  database.db
    .insert(users)
    .values({
      id: userId,
      publicId,
      username: input.username,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      toastNotificationsEnabled: DEFAULT_NOTIFICATION_PREFERENCES.toastsEnabled,
      toastNotificationFrequency: DEFAULT_NOTIFICATION_PREFERENCES.frequency,
      disabledAt: null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    })
    .run();

  if (input.permissions?.length) {
    database.db
      .insert(userPermissionGrants)
      .values(
        input.permissions.map((permission) => ({
          id: Bun.randomUUIDv7(),
          userId,
          permission,
          grantedByUserId: userId,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();
  }
}

async function loginAndReadCookie(app: TestAppContext["app"], email: string): Promise<string> {
  const response = await app.handle(
    createJsonRequest(
      "/api/auth/login",
      {
        email,
        password: DEFAULT_PASSWORD,
      },
      { method: "POST" },
    ),
  );
  const setCookie = response.headers.get("set-cookie") ?? "";

  if (response.status !== 200 || !setCookie) {
    throw new Error(`Login failed for ${email}`);
  }

  return toCookieHeader(setCookie);
}

function createMultipartTicketRequest(
  path: string,
  input: { attachments: File[]; description: string; title: string },
  options: { authorization?: string; cookie?: string },
): Request {
  const form = new FormData();
  form.set("title", input.title);
  form.set("description", input.description);

  for (const attachment of input.attachments) {
    form.append("attachments", attachment);
  }

  const headers = new Headers({
    origin: TEST_WEB_ORIGIN,
    [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
  });

  if (options.cookie) {
    headers.set("cookie", options.cookie);
  }

  if (options.authorization) {
    headers.set("authorization", options.authorization);
  }

  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: form,
  });
}

function createJsonRequest(
  path: string,
  body: unknown,
  options: {
    authorization?: string;
    cookie?: string;
    includeCsrf?: boolean;
    method: "PATCH" | "POST";
  },
): Request {
  const headers = new Headers({
    "content-type": "application/json",
    origin: TEST_WEB_ORIGIN,
  });

  if (options.includeCsrf !== false) {
    headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
  }

  if (options.cookie) {
    headers.set("cookie", options.cookie);
  }

  if (options.authorization) {
    headers.set("authorization", options.authorization);
  }

  return new Request(`http://localhost${path}`, {
    method: options.method,
    headers,
    body: JSON.stringify(body),
  });
}

function createAdminApiKeySecret(database: DatabaseClient, admin: PublicUser): string {
  const service = new ApiKeyService(database);
  const result = service.createApiKey({ name: "Help dashboard" }, admin, {
    ipAddress: "127.0.0.1",
    path: "/api/help/tickets",
    userAgent: "bun-test",
  });

  if (!result.ok) {
    throw new Error("Failed to create admin API key for help route tests.");
  }

  return result.body.secret;
}

function requirePublicUserByEmail(
  database: DatabaseClient,
  email: string,
  permissions: UserPermission[] = [...DEFAULT_SIGNED_IN_USER_PERMISSIONS],
): PublicUser {
  const user = database.db
    .select()
    .from(users)
    .all()
    .find((row) => row.email === email);

  if (!user) {
    throw new Error(`User ${email} was not found.`);
  }

  return {
    id: user.publicId,
    username: user.username,
    email: user.email,
    avatarId: DEFAULT_PROFILE_AVATAR_ID,
    bannerId: DEFAULT_PROFILE_BANNER_ID,
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    permissions: [...permissions],
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function createFixedPublicId(seed: string): string {
  return `${seed.replace(/[^a-z0-9]/gi, "").slice(0, 9)}${"X".repeat(9)}`.slice(0, 9);
}

function toCookieHeader(setCookieHeader: string): string {
  return setCookieHeader.split(";")[0] ?? "";
}
