import { expect } from "bun:test";
import type { DatabaseClient } from "../../apps/server/src/db/client";

export function readTableNames(database: DatabaseClient): string[] {
  return database.sqlite
    .query<{ name: string }, []>(
      "select name from sqlite_master where type = 'table' order by name",
    )
    .all()
    .map((table) => table.name);
}

export function expectCoreTables(tableNames: string[]): void {
  expect(tableNames).toContain("users");
  expect(tableNames).toContain("sessions");
  expect(tableNames).toContain("audit_logs");
  expect(tableNames).not.toContain("anime_titles");
  expect(tableNames).not.toContain("anime_aliases");
  expect(tableNames).not.toContain("anime_external_ids");
  expect(tableNames).not.toContain("episodes");
  expect(tableNames).not.toContain("metadata_cache");
  expect(tableNames).toContain("__drizzle_migrations");
}
