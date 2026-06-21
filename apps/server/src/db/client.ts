import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs"; // verify-ignore: bun:sqlite opens synchronously, so DB parent directory creation must be synchronous.
import { dirname } from "node:path";
import { APP_LOG_CATEGORY } from "@arrtemplar/shared";
import { getLogger as getDrizzleLogger } from "@logtape/drizzle-orm";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { resolveDatabaseUrl } from "../config/database-paths";
import { env } from "../config/env";
import * as schema from "./schema";

export type DatabaseClient = {
  db: BunSQLiteDatabase<typeof schema>;
  sqlite: Database;
  close: () => void;
};

export function createDatabase(databaseUrl = env.databaseUrl): DatabaseClient {
  const resolvedDatabaseUrl = resolveDatabaseUrl(databaseUrl);
  ensureDatabaseDirectory(resolvedDatabaseUrl);

  const sqlite = new Database(resolvedDatabaseUrl, { create: true, strict: true });
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run("PRAGMA busy_timeout = 5000");
  sqlite.run("PRAGMA synchronous = NORMAL");

  if (resolvedDatabaseUrl !== ":memory:") {
    sqlite.run("PRAGMA journal_mode = WAL");
  }

  return {
    db: drizzle(sqlite, {
      schema,
      logger: getDrizzleLogger({
        category: [APP_LOG_CATEGORY, "database", "query"],
        level: "debug",
      }),
    }),
    sqlite,
    close: () => sqlite.close(),
  };
}

function ensureDatabaseDirectory(databaseUrl: string): void {
  if (databaseUrl === ":memory:" || databaseUrl.startsWith("file:")) {
    return;
  }

  const directory = dirname(databaseUrl);

  if (directory !== ".") {
    mkdirSync(directory, { recursive: true });
  }
}
