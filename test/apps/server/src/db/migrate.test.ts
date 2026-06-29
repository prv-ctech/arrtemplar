import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { configure } from "@logtape/logtape";
import {
  migrateDatabase,
  resolveMigrationsFolderFromModuleUrl,
} from "../../../../../apps/server/src/db/migrate";
import { APP_LOG_CATEGORY, TOAST_NOTIFICATION_EVENTS } from "../../../../../packages/shared/src";
import {
  openTestDatabase,
  removeTestDatabaseFiles,
  TEST_DATABASE_URL,
} from "../../../../helpers/database";
import { createLogBuffer, resetLogTape } from "../../../../helpers/logging";
import { expectCoreTables, readTableNames } from "../../../../helpers/schema-assertions";

type TableColumn = {
  name: string;
  notnull: number;
};

type ForeignKey = {
  from: string;
  on_delete: string;
  table: string;
  to: string;
};

type IndexRow = {
  name: string;
  partial?: number;
  unique?: number;
};

type IndexColumn = {
  desc: number;
  name: string;
};

afterEach(async () => {
  await resetLogTape();
});

describe("migrateDatabase", () => {
  it("resolves the Drizzle migrations folder for both source and bundled entrypoints", async () => {
    const fixtureRoot = await mkdtemp("/tmp/arrtemplar-migrations-");
    const sourceModulePath = join(fixtureRoot, "src", "db", "migrate.ts");
    const bundledModulePath = join(fixtureRoot, "dist", "main.js");
    const sourceMigrationsFolder = join(fixtureRoot, "drizzle");
    const bundledMigrationsFolder = join(fixtureRoot, "dist", "..", "drizzle");

    await mkdir(join(fixtureRoot, "src", "db"), { recursive: true });
    await mkdir(join(fixtureRoot, "dist"), { recursive: true });
    await mkdir(sourceMigrationsFolder, { recursive: true });

    try {
      expect(resolveMigrationsFolderFromModuleUrl(pathToFileURL(sourceModulePath).toString())).toBe(
        sourceMigrationsFolder,
      );
      expect(
        resolveMigrationsFolderFromModuleUrl(pathToFileURL(bundledModulePath).toString()),
      ).toBe(bundledMigrationsFolder);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("creates all core tables on the canonical test database and can rerun", async () => {
    await removeTestDatabaseFiles();

    migrateDatabase(TEST_DATABASE_URL);
    migrateDatabase(TEST_DATABASE_URL);

    const database = openTestDatabase();

    try {
      expectCoreTables(readTableNames(database));
      expectNotificationHistorySchema(database);
      expectServiceIntegrationSchema(database);
    } finally {
      database.close();
    }
  });

  it("logs migration lifecycle events and duration", async () => {
    const { records, sink } = createLogBuffer();

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY, "database", "lifecycle"], sinks: ["buffer"] },
      ],
    });

    await removeTestDatabaseFiles();
    migrateDatabase(TEST_DATABASE_URL);

    expect(records).toContainEqual(
      expect.objectContaining({
        category: [APP_LOG_CATEGORY, "database", "lifecycle"],
        level: "info",
        properties: expect.objectContaining({
          database: "primary",
          event: "database.migration_started",
          migrationsFolder: expect.any(String),
        }),
      }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({
        category: [APP_LOG_CATEGORY, "database", "lifecycle"],
        level: "info",
        properties: expect.objectContaining({
          database: "primary",
          durationMs: expect.any(Number),
          event: "database.migration_completed",
          migrationsFolder: expect.any(String),
        }),
      }),
    );
  });

  it("logs migration failures and rethrows them", async () => {
    const { records, sink } = createLogBuffer();

    await configure({
      sinks: { buffer: sink, meta: () => undefined },
      loggers: [
        { category: ["logtape", "meta"], sinks: ["meta"] },
        { category: [APP_LOG_CATEGORY, "database", "lifecycle"], sinks: ["buffer"] },
      ],
    });

    await removeTestDatabaseFiles();
    const migrationError = new Error("forced migration failure");

    expect(() =>
      migrateDatabase(TEST_DATABASE_URL, {
        migrationsFolder: "data/db/missing-migrations",
        runMigrations: () => {
          throw migrationError;
        },
      }),
    ).toThrow(migrationError);
    expect(records).toContainEqual(
      expect.objectContaining({
        category: [APP_LOG_CATEGORY, "database", "lifecycle"],
        level: "error",
        properties: expect.objectContaining({
          database: "primary",
          event: "database.migration_failed",
          migrationsFolder: "data/db/missing-migrations",
          error: expect.any(Error),
        }),
      }),
    );
  });
});

function expectNotificationHistorySchema(database: ReturnType<typeof openTestDatabase>): void {
  const columns = database.sqlite
    .query<TableColumn, []>("pragma table_info('notification_history')")
    .all();
  const requiredColumns = new Map(columns.map((column) => [column.name, column.notnull]));

  expect([...requiredColumns.keys()]).toEqual([
    "id",
    "user_id",
    "event_id",
    "title",
    "description",
    "severity",
    "importance",
    "read_at",
    "created_at",
  ]);
  expect(requiredColumns.get("user_id")).toBe(1);
  expect(requiredColumns.get("event_id")).toBe(1);
  expect(requiredColumns.get("title")).toBe(1);
  expect(requiredColumns.get("severity")).toBe(1);
  expect(requiredColumns.get("importance")).toBe(1);
  expect(requiredColumns.get("created_at")).toBe(1);

  const foreignKeys = database.sqlite
    .query<ForeignKey, []>("pragma foreign_key_list('notification_history')")
    .all();

  expect(foreignKeys).toContainEqual(
    expect.objectContaining({
      from: "user_id",
      on_delete: "CASCADE",
      table: "users",
      to: "id",
    }),
  );

  const indexes = database.sqlite
    .query<IndexRow, []>("pragma index_list('notification_history')")
    .all()
    .map((index) => index.name);

  expect(indexes).toContain("notification_history_user_created_at_idx");
  expect(indexes).toContain("notification_history_user_unread_idx");

  const createdAtIndexColumns = database.sqlite
    .query<IndexColumn, []>("pragma index_xinfo('notification_history_user_created_at_idx')")
    .all()
    .filter((column) => column.name);

  expect(createdAtIndexColumns).toEqual([
    expect.objectContaining({ desc: 0, name: "user_id" }),
    expect.objectContaining({ desc: 1, name: "created_at" }),
  ]);

  expectNotificationHistoryAcceptsAllToastEvents(database);
}

function expectServiceIntegrationSchema(database: ReturnType<typeof openTestDatabase>): void {
  const indexes = database.sqlite
    .query<IndexRow, []>("pragma index_list('service_integrations')")
    .all();

  expect(indexes).toContainEqual(
    expect.objectContaining({ name: "service_integrations_kind_idx" }),
  );
  expect(indexes).toContainEqual(
    expect.objectContaining({
      name: "service_integrations_default_kind_unique",
      partial: 1,
      unique: 1,
    }),
  );
  expect(indexes.map((index) => index.name)).not.toContain("service_integrations_enabled_idx");

  const insertDefaultClient = database.sqlite.query(
    "insert into service_integrations (id, kind, display_name, is_default, enabled, use_ssl, host, port, auth_mode) values ($id, $kind, $displayName, true, true, false, $host, 8080, 'none')",
  );

  insertDefaultClient.run({
    displayName: "qBittorrent",
    host: "localhost",
    id: "qbittorrent-default",
    kind: "qbittorrent",
  });
  expect(() =>
    insertDefaultClient.run({
      displayName: "qBittorrent duplicate",
      host: "localhost",
      id: "qbittorrent-default-duplicate",
      kind: "qbittorrent",
    }),
  ).toThrow();

  database.sqlite
    .query(
      "insert into service_integrations (id, kind, display_name, is_default, enabled, use_ssl, host, port, auth_mode) values ('qbittorrent-extra', 'qbittorrent', 'qBittorrent extra', false, true, false, 'localhost', 8081, 'none')",
    )
    .run();
  insertDefaultClient.run({
    displayName: "SABnzbd",
    host: "localhost",
    id: "sabnzbd-default",
    kind: "sabnzbd",
  });
}

function expectNotificationHistoryAcceptsAllToastEvents(
  database: ReturnType<typeof openTestDatabase>,
): void {
  database.sqlite
    .query(
      "insert into users (id, public_id, username, email, password_hash) values ($id, $publicId, $username, $email, $passwordHash)",
    )
    .run({
      email: "notification-events@example.com",
      id: "notification-events-user",
      passwordHash: "test-password-hash",
      publicId: "notification-events-public-user",
      username: "notification-events-user",
    });

  const insertNotification = database.sqlite.query(
    "insert into notification_history (id, user_id, event_id, title, severity, importance) values ($id, $userId, $eventId, $title, $severity, $importance)",
  );

  for (const [eventId, classification] of Object.entries(TOAST_NOTIFICATION_EVENTS)) {
    insertNotification.run({
      eventId,
      id: `notification-${eventId}`,
      importance: classification.importance,
      severity: classification.severity,
      title: eventId,
      userId: "notification-events-user",
    });
  }
}
