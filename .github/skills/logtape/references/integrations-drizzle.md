# Rule: integrations-drizzle (`@logtape/drizzle-orm`)

> Sources: <https://logtape.org/manual/integrations#drizzle-orm>, <https://jsr.io/@logtape/drizzle-orm/doc>.

**This is the repo's DB query-logging layer.** `@logtape/drizzle-orm` provides a
Drizzle logger factory (`getLogger()`) that uses LogTape as Drizzle's logging
backend. Drizzle is a lightweight TypeScript-first ORM for PostgreSQL, MySQL,
and SQLite.

```bash
bun add @logtape/drizzle-orm   # already a server dep (^2.1.4)
```

## Basic usage

```typescript
import { configure, getConsoleSink } from "@logtape/logtape";
import { getLogger } from "@logtape/drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

await configure({
  sinks: { console: getConsoleSink() },
  loggers: [{ category: ["drizzle-orm"], sinks: ["console"], lowestLevel: "debug" }],
});

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { logger: getLogger() });

// all DB queries now flow through LogTape
```

## Options

- **`category`** — default `["drizzle-orm"]`. Set a custom one to fit your tree:

```typescript
const logger = getLogger({ category: ["app", "database"] });
```

- **`level`** — default `"debug"`. Change it:

```typescript
const logger = getLogger({ level: "info" });
```

- **`dialect`** — default `"pg"` (PostgreSQL). Also `"sqlite"`:

```typescript
const logger = getLogger({ dialect: "sqlite" });
```

## Structured output

Each query record includes:

- **`formattedQuery`** — the query with placeholders (`$1`, `$2`) replaced by actual values (human-readable).
- **`query`** — the original query string with placeholders.
- **`params`** — the original parameters array.

This lets text formatters show readable output, JSON Lines / OTel / Sentry carry
the full query+params, and you can filter on `record.properties` (see
`core-filters.md`).

## This repo's wiring

The server uses PostgreSQL + Drizzle as its primary database (never `bun:sqlite`
for app data — see the `bun-native` skill). Wire the Drizzle logger under the
`["app", "database"]` subtree so it inherits the redacted file/console sinks and
the `runtimeLevel` filter. The repo's redaction also scrubs `formattedQuery` and
`params` fields, so query text/values are sanitized before reaching sinks.

```typescript
import { getLogger as getDrizzleLogger } from "@logtape/drizzle-orm";
import { APP_LOG_CATEGORY } from "@arrtemplar/shared";

const db = drizzle(client, {
  logger: getDrizzleLogger({ category: [APP_LOG_CATEGORY, "database"], level: "debug" }),
});
```

> **Sensitive params:** Drizzle query parameters may contain user input. Always
> route Drizzle logs through `createRedactedSink()` (the repo's `appFile`/`appConsole`
> already do) so `params`/`formattedQuery` are redacted.
