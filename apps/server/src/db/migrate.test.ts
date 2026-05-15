import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "./client";
import { migrateDatabase } from "./migrate";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("migrateDatabase", () => {
  it("creates all Phase 1 tables on a fresh SQLite database and can rerun", () => {
    const databaseUrl = createTempDatabaseUrl();

    migrateDatabase(databaseUrl);
    migrateDatabase(databaseUrl);

    const database = createDatabase(databaseUrl);

    try {
      const tableNames = database.sqlite
        .query<{ name: string }, []>(
          "select name from sqlite_master where type = 'table' order by name",
        )
        .all()
        .map((table) => table.name);

      expect(tableNames).toContain("users");
      expect(tableNames).toContain("sessions");
      expect(tableNames).toContain("audit_logs");
      expect(tableNames).toContain("anime_titles");
      expect(tableNames).toContain("anime_aliases");
      expect(tableNames).toContain("anime_external_ids");
      expect(tableNames).toContain("episodes");
      expect(tableNames).toContain("metadata_cache");
      expect(tableNames).toContain("__drizzle_migrations");
    } finally {
      database.close();
    }
  });
});

function createTempDatabaseUrl(): string {
  const directory = mkdtempSync(join(tmpdir(), "animehub-db-"));
  tempDirectories.push(directory);

  return join(directory, "animehub.sqlite");
}
