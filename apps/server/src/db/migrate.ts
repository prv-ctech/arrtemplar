import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { env } from "../config/env";
import { createDatabase } from "./client";

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "../../drizzle");

export function migrateDatabase(databaseUrl = env.databaseUrl): void {
  const database = createDatabase(databaseUrl);

  try {
    migrate(database.db, { migrationsFolder });
  } finally {
    database.close();
  }
}

if (import.meta.main) {
  migrateDatabase();
  console.info("Database migrations applied.");
}
