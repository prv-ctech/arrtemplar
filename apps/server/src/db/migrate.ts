import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { env } from "../config/env";
import { createDatabase } from "./client";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

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
