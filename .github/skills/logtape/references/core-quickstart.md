# Rule: core-quickstart (LogTape)

> Source: <https://logtape.org/manual/start>.

The unobtrusive contract: a library records freely with `getLogger()`, and the
**application** decides if/where/how those logs play back by calling
`configure()`. Until `configure()` runs, every `logger.*()` call is a silent
no-op.

## 1. Set up (application only)

The app entry point configures LogTape once. (In this repo that is
`configureServerLogging()` in `apps/server/src/logging/config.ts`.)

```typescript
import { configure, getConsoleSink } from "@logtape/logtape";

await configure({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: ["my-app"], lowestLevel: "debug", sinks: ["console"] },
  ],
});
```

> **Libraries must not call `configure()`.** It is the application's job. See `library.md`.

## 2. Log from anywhere (libraries and app)

```typescript
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["my-app", "my-module"]);

// Tagged-template form (terse):
logger.debug`Hello, ${value}!`;

// Method-call form (structured — preferred; values stay first-class):
logger.info("User {userId} signed in.", { userId });
```

## 3. Six severity levels

From most to least verbose:

1. `trace` — execution-flow tracing (added in 0.12.0).
2. `debug` — diagnostic detail.
3. `info` — normal operation.
4. `warning` — unexpected but recoverable.
5. `error` — an operation failed.
6. `fatal` — unrecoverable; the app aborts.

```typescript
logger.trace("Entering with {userId}.", { userId });
logger.debug("Query returned {count} rows.", { count: rows.length });
logger.info("User {username} logged in.", { username });
logger.warn("Rate limit near, {pct}% reached.", { pct });
logger.error("Charge failed on order {orderId}.", { orderId });
logger.fatal("Unrecoverable: {error}", { error: err });
```

See `core-levels.md` for `lowestLevel`, Error-object overloads, and level comparison.

## 4. Lazy evaluation

Defer expensive work so it only runs when the level is actually enabled:

```typescript
import { lazy } from "@logtape/logtape";

logger.debug("Processed {details}", { details: lazy(() => computeDetails()) });

// Async lazy returns a Promise — await it:
await logger.debug("Fetched {user}", async () => ({ user: await fetchUser() }));

// Or guard multiple statements:
if (logger.isEnabledFor("debug")) {
  const snap = captureState();
  logger.debug("State {snap}", { snap });
}
```

See `core-lazy.md`.

## 5. Already using another logger?

Adapters forward LogTape records into winston/Pino/bunyan/log4js instead of
configuring LogTape directly:

```typescript
import { install } from "@logtape/adaptor-winston";
import winston from "winston";

const winstonLogger = winston.createLogger({ /* ... */ });
install(winstonLogger); // all LogTape logs now route through winston
```

See `integrations-adaptors.md`. (This repo uses LogTape natively, so adapters are not used.)
