import { describe, expect, it } from "bun:test";
import { createDatabase } from "../../apps/server/src/db/client";
import {
  openTestDatabase,
  removeTestDatabaseFiles,
  resetTestDatabase,
  TEST_DATABASE_FILES,
  TEST_DATABASE_URL,
} from "./database";
import { expectCoreTables, readTableNames } from "./schema-assertions";

describe("canonical test database helper", () => {
  it("removes the canonical test database and SQLite sidecars", async () => {
    for (const filePath of TEST_DATABASE_FILES) {
      await Bun.write(filePath, "stale sqlite file", { createPath: true });
      expect(await Bun.file(filePath).exists()).toBe(true);
    }

    await removeTestDatabaseFiles();

    for (const filePath of TEST_DATABASE_FILES) {
      expect(await Bun.file(filePath).exists()).toBe(false);
    }
  });

  it("resets the canonical test database with real migrations", async () => {
    await resetTestDatabase();

    const database = openTestDatabase();

    try {
      expectCoreTables(readTableNames(database));
    } finally {
      database.close();
    }
  });

  it("opens explicit relative database paths from the workspace root", () => {
    const previousDirectory = process.cwd();
    process.chdir("apps/server");

    const database = createDatabase(TEST_DATABASE_URL);

    try {
      const [mainDatabase] = database.sqlite
        .query<{ file: string }, []>("pragma database_list")
        .all();

      expect(mainDatabase?.file.endsWith(TEST_DATABASE_URL)).toBe(true);
      expect(mainDatabase?.file).not.toContain("apps/server/data/db");
    } finally {
      database.close();
      process.chdir(previousDirectory);
    }
  });
});
