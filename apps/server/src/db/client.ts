import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
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

  if (resolvedDatabaseUrl !== ":memory:") {
    sqlite.run("PRAGMA journal_mode = WAL");
  }

  return {
    db: drizzle(sqlite, {
      schema,
      logger: getDrizzleLogger({
        category: ["arrweeb", "database", "query"],
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
