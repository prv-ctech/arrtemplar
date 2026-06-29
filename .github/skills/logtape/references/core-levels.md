# Rule: core-levels (LogTape)

> Source: <https://logtape.org/manual/levels>.

## Six severity levels (low → high severity)

1. **Trace** (since 0.12.0) — very detailed execution-flow info, used during dev/debugging.
2. **Debug** — diagnostic detail (state, variables, business-logic decisions).
3. **Information** — general operation info.
4. **Warning** — unexpected but recoverable; close to causing errors.
5. **Error** — an operation failed; needs attention but app continues.
6. **Fatal error** — unrecoverable; app aborts.

> LogTape currently does **not** support custom severity levels.

## Method names

Each logger has `trace`, `debug`, `info`, `warn` (alias of `warning`),
`error`, and `fatal` methods. Each accepts a tagged template, a message string +
properties, or an object.

```typescript
logger.trace("Entering with {userId}.", { userId });
logger.debug("Query returned {count} rows with {queryParams}.", { count: results.length, queryParams });
logger.info("User {username} logged in.", { username });
logger.warn("Rate limit near, {pct}% reached.", { pct: 95 });
logger.error("Save failed: {error}", { userId: "12345", error: err });
logger.fatal("Unrecoverable: {error}", { error: err });
```

## Error-object overloads (since 2.0.0)

`warn`/`warning`/`error`/`fatal` accept an `Error` directly as a shorthand for
logging it as a structured `{ error }` property. The bare-error form uses
`{error.message}` as the default template.

```typescript
logger.warn(err);
logger.warn("Something happened", err);

logger.error(err);
logger.error("Failed to save user", err);
```

**Extra properties** (since 2.1.0):

```typescript
logger.error(err, { requestId: "abc-123", userId: "user-456" });
// equivalent to:
logger.error("{error.message}", { error: err, requestId: "abc-123", userId: "user-456" });

// expensive diagnostics can be lazy:
logger.error(err, () => gatherDiagnostics());
```

> To include the stack trace in text output, put `{error}` in the message template.

## Configuring severity levels

`lowestLevel` is set **per logger** and does **not** inherit from parents
(defaults to `"trace"`). It controls which records the logger emits at all:

```typescript
await configure({
  loggers: [
    { category: ["app"], lowestLevel: "info", sinks: ["console"] },
    { category: ["app", "database"], lowestLevel: "trace", sinks: ["file"] },
  ],
});
```

> `lowestLevel` applies to the logger, not its sinks. If a parent is `"debug"`
> and a child is `"info"`, the child will still not emit `"debug"` to the
> parent's `"console"` sink.

### Making level inherit down the tree

Because `lowestLevel` does **not** inherit, use a **filter** (which does
inherit) when you want children to share a threshold:

```typescript
await configure({
  filters: { infoAndAbove: "info" }, // FilterLike accepts a level string
  loggers: [
    { category: ["app"], filters: ["infoAndAbove"] },                // info+
    { category: ["app", "database"] /* inherits info+ from parent */ },
  ],
});
```

## Listing and comparing levels (since 0.8.0 / 1.0.0)

```typescript
import { getLogLevels, compareLogLevel, type LogLevel } from "@logtape/logtape";

for (const level of getLogLevels()) console.log(level);
// trace, debug, info, warning, error, fatal (low → high)

const levels: LogLevel[] = ["info", "debug", "error", "warning", "fatal", "trace"];
levels.sort(compareLogLevel); // sorts low → high
```

## `LogMethod` type (since 1.0.0)

`LogMethod` is the type of each level method (`logger.info`, etc.) and contains
all overloaded signatures — handy when storing/logging through a dynamic level:

```typescript
import { type LogMethod, getLogger, getLogLevels } from "@logtape/logtape";

const logger = getLogger();
const methods: LogMethod[] = getLogLevels().map((level) => logger[level].bind(logger));
```

## Choosing a level

Consider impact on the app, urgency of response, and audience (devs vs.
admins vs. users). Reserve `error` for real failures; keep `info` for normal
operations; use `debug`/`trace` for dev detail.
