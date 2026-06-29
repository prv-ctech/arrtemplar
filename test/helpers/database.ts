import { $ } from "bun";
import { resolveDatabaseUrl, TEST_DATABASE_URL } from "../../apps/server/src/config/database-paths";
import { createDatabase, type DatabaseClient } from "../../apps/server/src/db/client";
import { migrateDatabase } from "../../apps/server/src/db/migrate";

export { TEST_DATABASE_URL };

const TEST_DATABASE_PATH = resolveDatabaseUrl(TEST_DATABASE_URL);
export const TEST_DATABASE_FILES = [
  TEST_DATABASE_PATH,
  `${TEST_DATABASE_PATH}-shm`,
  `${TEST_DATABASE_PATH}-wal`,
] as const;

export async function removeTestDatabaseFiles(): Promise<void> {
  assertCanonicalTestDatabaseEnvironment();

  for (const filePath of TEST_DATABASE_FILES) {
    await $`rm -f ${filePath}`.quiet();
  }
}

export async function resetTestDatabase(): Promise<string> {
  await removeTestDatabaseFiles();
  migrateDatabase(TEST_DATABASE_URL);

  return TEST_DATABASE_URL;
}

export function openTestDatabase(): DatabaseClient {
  assertCanonicalTestDatabaseEnvironment();

  return createDatabase(TEST_DATABASE_URL);
}

export async function resetAndOpenTestDatabase(): Promise<DatabaseClient> {
  await resetTestDatabase();

  return openTestDatabase();
}

function assertCanonicalTestDatabaseEnvironment(): void {
  if (Bun.env.NODE_ENV !== "test") {
    throw new Error("Canonical test database helpers require NODE_ENV=test.");
  }

  if (Bun.env.DATABASE_URL !== TEST_DATABASE_URL) {
    throw new Error(`Canonical test database helpers require DATABASE_URL=${TEST_DATABASE_URL}.`);
  }
}
