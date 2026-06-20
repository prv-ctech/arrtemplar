import { describe, expect, it } from "bun:test";
import { migrateDatabase } from "../../../../../apps/server/src/db/migrate";
import {
  openTestDatabase,
  removeTestDatabaseFiles,
  TEST_DATABASE_URL,
} from "../../../../helpers/database";
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
};

type IndexColumn = {
  desc: number;
  name: string;
};

describe("migrateDatabase", () => {
  it("creates all core tables on the canonical test database and can rerun", async () => {
    await removeTestDatabaseFiles();

    migrateDatabase(TEST_DATABASE_URL);
    migrateDatabase(TEST_DATABASE_URL);

    const database = openTestDatabase();

    try {
      expectCoreTables(readTableNames(database));
      expectNotificationHistorySchema(database);
    } finally {
      database.close();
    }
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
}
