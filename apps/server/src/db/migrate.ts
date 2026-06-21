import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_LOG_CATEGORY } from "@arrtemplar/shared";
import { dispose, getLogger } from "@logtape/logtape";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { env } from "../config/env";
import { configureServerLogging } from "../logging/config";
import { createDatabase } from "./client";

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "../../drizzle");
const serverLogger = getLogger([APP_LOG_CATEGORY, "server"]);

export function migrateDatabase(databaseUrl = env.databaseUrl): void {
  const database = createDatabase(databaseUrl);

  try {
    migrate(database.db, { migrationsFolder });
  } finally {
    database.close();
  }
}

if (import.meta.main) {
  await configureServerLogging();
  migrateDatabase();
  serverLogger.info("Database migrations applied.");
  await dispose();
}
