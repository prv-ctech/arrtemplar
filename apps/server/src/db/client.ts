import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { env } from "../config/env";
import * as schema from "./schema";

export type DatabaseClient = {
  db: BunSQLiteDatabase<typeof schema>;
  sqlite: Database;
  close: () => void;
};

export function createDatabase(databaseUrl = env.databaseUrl): DatabaseClient {
  ensureDatabaseDirectory(databaseUrl);

  const sqlite = new Database(databaseUrl, { create: true });
  sqlite.run("PRAGMA foreign_keys = ON");

  if (databaseUrl !== ":memory:") {
    sqlite.run("PRAGMA journal_mode = WAL");
  }

  return {
    db: drizzle({ client: sqlite, schema }),
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
