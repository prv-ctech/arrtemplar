import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_LOG_CATEGORY } from "@arrtemplar/shared";
import { dispose, getLogger } from "@logtape/logtape";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { env } from "../config/env";
import { configureServerLogging } from "../logging/config";
import { createDatabase } from "./client";

const bundledMigrationsRelativePath = "../drizzle";
const sourceMigrationsRelativePath = "../../drizzle";
const migrationsFolder = resolveMigrationsFolderFromModuleUrl(import.meta.url);
const serverLogger = getLogger([APP_LOG_CATEGORY, "server"]);
const databaseLifecycleLogger = getLogger([APP_LOG_CATEGORY, "database", "lifecycle"]);

type MigrateDatabaseOptions = {
  migrationsFolder?: string;
  runMigrations?: (database: ReturnType<typeof createDatabase>, migrationsFolder: string) => void;
};

export function migrateDatabase(
  databaseUrl = env.databaseUrl,
  options: MigrateDatabaseOptions = {},
): void {
  const database = createDatabase(databaseUrl);
  const selectedMigrationsFolder = options.migrationsFolder ?? migrationsFolder;
  const runMigrations = options.runMigrations ?? runDrizzleMigrations;
  const startedAt = performance.now();
  let migrationError: unknown;

  databaseLifecycleLogger.info("Database migration started for {database}.", {
    event: "database.migration_started",
    database: "primary",
    migrationsFolder: selectedMigrationsFolder,
  });

  try {
    runMigrations(database, selectedMigrationsFolder);
    databaseLifecycleLogger.info(
      "Database migration completed for {database} in {durationMs} ms.",
      () => ({
        event: "database.migration_completed",
        database: "primary",
        migrationsFolder: selectedMigrationsFolder,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
  } catch (error) {
    migrationError = error;
    databaseLifecycleLogger.error("Database migration failed for {database}: {error}", {
      event: "database.migration_failed",
      database: "primary",
      migrationsFolder: selectedMigrationsFolder,
      error,
    });
  }

  try {
    database.close();
  } catch (closeError) {
    if (!migrationError) {
      throw closeError;
    }
  }

  if (migrationError) {
    throw migrationError;
  }
}

export function resolveMigrationsFolderFromModuleUrl(moduleUrl: string): string {
  const moduleDirectory = dirname(fileURLToPath(moduleUrl));

  return join(
    moduleDirectory,
    basename(moduleDirectory) === "dist"
      ? bundledMigrationsRelativePath
      : sourceMigrationsRelativePath,
  );
}

function runDrizzleMigrations(
  database: ReturnType<typeof createDatabase>,
  selectedMigrationsFolder: string,
): void {
  migrate(database.db, { migrationsFolder: selectedMigrationsFolder });
}

if (import.meta.main) {
  await configureServerLogging();

  try {
    migrateDatabase();
    serverLogger.info("Database migrations applied.", {
      event: "database.migrations_applied",
      database: "primary",
    });
  } finally {
    await dispose();
  }
}
