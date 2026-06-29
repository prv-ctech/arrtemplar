import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs"; // verify-ignore: bun:sqlite opens synchronously, so DB parent directory creation must be synchronous.
import { dirname } from "node:path";
import { APP_LOG_CATEGORY } from "@arrtemplar/shared";
import { getLogger as getDrizzleLogger } from "@logtape/drizzle-orm";
import { getLogger } from "@logtape/logtape";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import {
  type ResolvedDatabaseTarget,
  resolveDatabaseTarget,
  UnsupportedDatabaseUrlError,
} from "../config/database-paths";
import { env } from "../config/env";
import * as schema from "./schema";

export type DatabaseClient = {
  db: BunSQLiteDatabase<typeof schema>;
  sqlite: Database;
  close: () => void;
};

const lifecycleLogger = getLogger([APP_LOG_CATEGORY, "database", "lifecycle"]);

export function createDatabase(databaseUrl = env.databaseUrl): DatabaseClient {
  const databaseTarget = resolveDatabaseTargetForOpen(databaseUrl);
  ensureDatabaseDirectory(databaseTarget);

  const sqlite = openSqliteConnection(databaseTarget);

  try {
    configureSqliteConnection(sqlite, databaseTarget);
    optimizeDatabase(sqlite, databaseTarget, "open");
  } catch (error) {
    closeAfterConfigurationFailure(sqlite, databaseTarget);
    throw error;
  }

  lifecycleLogger.debug("Database connection configured for {database}.", () => ({
    event: "database.connection_configured",
    database: "primary",
    storage: databaseTarget.storage,
    databaseUrlKind: databaseTarget.databaseUrlKind,
    journalMode: readJournalMode(sqlite),
    synchronous: "NORMAL",
    foreignKeys: true,
    busyTimeoutMs: 5000,
    trustedSchema: false,
  }));

  return {
    db: drizzle(sqlite, {
      schema,
      logger: getDrizzleLogger({
        category: [APP_LOG_CATEGORY, "database", "query"],
        level: "debug",
        dialect: "sqlite",
      }),
    }),
    sqlite,
    close: createCloseConnection(sqlite, databaseTarget),
  };
}

function resolveDatabaseTargetForOpen(databaseUrl: string): ResolvedDatabaseTarget {
  try {
    return resolveDatabaseTarget(databaseUrl);
  } catch (error) {
    if (error instanceof UnsupportedDatabaseUrlError) {
      lifecycleLogger.warn(
        "Database connection rejected for {database}: unsupported URL form {databaseUrlKind}.",
        {
          event: "database.connection_rejected",
          database: "primary",
          databaseUrlKind: error.databaseUrlKind,
        },
      );
    }

    throw error;
  }
}

function openSqliteConnection(databaseTarget: ResolvedDatabaseTarget): Database {
  try {
    return new Database(databaseTarget.databaseUrl, { create: true, strict: true });
  } catch (error) {
    lifecycleLogger.error("Database connection failed for {database}: {error}", {
      event: "database.connection_failed",
      database: "primary",
      databaseUrlKind: databaseTarget.databaseUrlKind,
      storage: databaseTarget.storage,
      error,
    });

    throw error;
  }
}

function configureSqliteConnection(sqlite: Database, databaseTarget: ResolvedDatabaseTarget): void {
  runConfigurationPragma(sqlite, databaseTarget, "foreign_keys", "PRAGMA foreign_keys = ON");
  runConfigurationPragma(sqlite, databaseTarget, "busy_timeout", "PRAGMA busy_timeout = 5000");
  runConfigurationPragma(sqlite, databaseTarget, "synchronous", "PRAGMA synchronous = NORMAL");
  runConfigurationPragma(sqlite, databaseTarget, "trusted_schema", "PRAGMA trusted_schema = OFF");

  if (!databaseTarget.isFileBacked) {
    return;
  }

  runConfigurationPragma(sqlite, databaseTarget, "journal_mode", "PRAGMA journal_mode = WAL");

  const actualJournalMode = readJournalMode(sqlite);

  if (actualJournalMode.toLowerCase() !== "wal") {
    lifecycleLogger.warn(
      "Database journal mode fallback for {database}: requested {requestedJournalMode}, actual {actualJournalMode}.",
      {
        event: "database.journal_mode_fallback",
        database: "primary",
        requestedJournalMode: "wal",
        actualJournalMode,
        storage: databaseTarget.storage,
      },
    );
  }
}

function runConfigurationPragma(
  sqlite: Database,
  databaseTarget: ResolvedDatabaseTarget,
  pragma: string,
  statement: string,
): void {
  try {
    sqlite.run(statement);
  } catch (error) {
    lifecycleLogger.error("Database configuration failed for {database}: {error}", {
      event: "database.configuration_failed",
      database: "primary",
      databaseUrlKind: databaseTarget.databaseUrlKind,
      storage: databaseTarget.storage,
      pragma,
      error,
    });

    throw error;
  }
}

function optimizeDatabase(
  sqlite: Database,
  databaseTarget: ResolvedDatabaseTarget,
  mode: "open" | "close",
): void {
  if (!databaseTarget.isFileBacked) {
    lifecycleLogger.warn("Database optimization skipped for {database}: {reason}.", {
      event: "database.optimization_skipped",
      database: "primary",
      reason: "in-memory database",
      storage: databaseTarget.storage,
    });

    return;
  }

  try {
    if (mode === "open") {
      sqlite.run("PRAGMA optimize=0x10002");
    } else {
      sqlite.run("PRAGMA optimize");
    }

    lifecycleLogger.info("Database optimization completed for {database}.", {
      event: "database.optimization_completed",
      database: "primary",
      mode,
    });
  } catch (error) {
    lifecycleLogger.error("Database optimization failed for {database}: {error}", {
      event: "database.optimization_failed",
      database: "primary",
      mode,
      error,
    });

    throw error;
  }
}

function readJournalMode(sqlite: Database): string {
  return (
    sqlite.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get()?.journal_mode ??
    "unknown"
  );
}

function createCloseConnection(
  sqlite: Database,
  databaseTarget: ResolvedDatabaseTarget,
): () => void {
  let closed = false;

  return () => {
    if (closed) {
      return;
    }

    closed = true;

    let optimizationError: unknown;

    try {
      optimizeDatabase(sqlite, databaseTarget, "close");
    } catch (error) {
      optimizationError = error;
    }

    try {
      sqlite.close();
    } catch (error) {
      lifecycleLogger.error("Database connection close failed for {database}: {error}", {
        event: "database.close_failed",
        database: "primary",
        storage: databaseTarget.storage,
        error,
      });

      if (!optimizationError) {
        throw error;
      }
    }

    if (optimizationError) {
      throw optimizationError;
    }
  };
}

function closeAfterConfigurationFailure(
  sqlite: Database,
  databaseTarget: ResolvedDatabaseTarget,
): void {
  try {
    sqlite.close();
  } catch (error) {
    lifecycleLogger.error("Database connection close failed for {database}: {error}", {
      event: "database.close_failed",
      database: "primary",
      storage: databaseTarget.storage,
      error,
    });
  }
}

function ensureDatabaseDirectory(databaseTarget: ResolvedDatabaseTarget): void {
  if (!databaseTarget.isFileBacked) {
    return;
  }

  const directory = dirname(databaseTarget.databaseUrl);

  if (directory !== ".") {
    mkdirSync(directory, { recursive: true });
  }
}
