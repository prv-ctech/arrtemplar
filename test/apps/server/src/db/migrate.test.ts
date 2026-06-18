import { describe, it } from "bun:test";
import { migrateDatabase } from "../../../../../apps/server/src/db/migrate";
import {
  openTestDatabase,
  removeTestDatabaseFiles,
  TEST_DATABASE_URL,
} from "../../../../helpers/database";
import { expectCoreTables, readTableNames } from "../../../../helpers/schema-assertions";

describe("migrateDatabase", () => {
  it("creates all core tables on the canonical test database and can rerun", async () => {
    await removeTestDatabaseFiles();

    migrateDatabase(TEST_DATABASE_URL);
    migrateDatabase(TEST_DATABASE_URL);

    const database = openTestDatabase();

    try {
      expectCoreTables(readTableNames(database));
    } finally {
      database.close();
    }
  });
});
