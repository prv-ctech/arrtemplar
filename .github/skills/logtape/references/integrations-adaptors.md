# Rule: integrations-adaptors (LogTape)

> Source: <https://logtape.org/manual/adaptors>.

Adapters **forward LogTape records into an existing logger** (winston, Pino,
bunyan, log4js), so you can use LogTape-enabled libraries without migrating your
app's logging stack. Each adapter offers a sink function and a convenience
`install()`.

> This repo uses LogTape **natively**, so adapters are **not** used here. They
> are documented for completeness. Prefer native LogTape for new code.

## When to use adapters

- Your app already runs winston/Pino/log4js and you consume a LogTape-enabled library.
- You need all logs to flow through an existing pipeline (formatting, routing, alerting).
- Gradual migration to LogTape.

## When NOT to use adapters

- New projects — choose LogTape directly.
- Your current logger has real limitations you want to escape.
- You want full structured-logging capability.

## winston — `@logtape/adaptor-winston` (since 1.0.0)

```bash
bun add @logtape/adaptor-winston
```

Quick setup (routes to winston's default logger):

```typescript
import "@logtape/adaptor-winston/install";
import { getLogger } from "@logtape/logtape";
getLogger("my-app").info("Logged through winston");
```

Manual sink:

```typescript
import { getWinstonSink } from "@logtape/adaptor-winston";
import winston from "winston";

await configure({
  sinks: { winston: getWinstonSink(winstonLogger, { category: { position: "start", decorator: "[]", separator: "." } }) },
  loggers: [{ category: "my-library", sinks: ["winston"] }],
});
```

`install()` middle ground with a level map:

```typescript
install(customLogger, {
  category: { position: "start", decorator: "[]" },
  levelsMap: { trace: "silly", debug: "debug", info: "verbose", warning: "info", error: "warn", fatal: "error" },
});
```

## Pino — `@logtape/adaptor-pino` (since 1.0.0)

```bash
bun add @logtape/adaptor-pino
```

```typescript
import { getPinoSink, install } from "@logtape/adaptor-pino";
import { pino } from "pino";

const pinoLogger = pino({ level: "info", transport: { target: "pino-pretty" } });
install(pinoLogger, { category: { position: "start", decorator: "[]", separator: "." } });
```

## bunyan — `@logtape/adaptor-bunyan` (since 2.1.0)

Bunyan has no global default logger — create one with `bunyan.createLogger()`
and pass it in. Properties go to Bunyan as the merge-object (so Bunyan
`serializers` apply); the merge-object `time` is set from `record.timestamp`.
Avoid Bunyan reserved keys (`name`, `hostname`, `pid`, `level`, `msg`, `src`, `v`).

```bash
bun add @logtape/adaptor-bunyan
```

```typescript
import bunyan from "bunyan";
import { getBunyanSink, install } from "@logtape/adaptor-bunyan";

const bunyanLogger = bunyan.createLogger({ name: "my-app", level: "info" });
install(bunyanLogger, { category: { position: "start", decorator: "[]", separator: "." } });

// custom value formatting for interpolated values:
const sink = getBunyanSink(bunyanLogger, { valueFormatter: (value) => JSON.stringify(value) });
```

## log4js — `@logtape/adaptor-log4js` (since 2.0.0)

```bash
bun add @logtape/adaptor-log4js
```

```typescript
import log4js from "log4js";
import { install, getLog4jsSink } from "@logtape/adaptor-log4js";

log4js.configure({ appenders: { out: { type: "stdout" } }, categories: { default: { appenders: ["out"], level: "info" } } });
install(log4js); // category-based loggers

// manual, with category mapping + context strategy:
const sink = getLog4jsSink(log4js, undefined, {
  categoryMapper: (cat) => cat.join("."),  // ["app","db"] -> "app.db"
  contextStrategy: "mdc",                   // "mdc" (default) | "args"
  contextPreservation: "preserve",          // "preserve" | "merge" | "replace"
});
```

## Creating a custom adapter

Implement the `Sink` interface, mapping LogTape levels and formatting the
template message parts (`record.message` is `[str, value, str, value, …]`):

```typescript
import type { LogLevel, LogRecord, Sink } from "@logtape/logtape";

export function getCustomLoggerSink(customLogger): Sink {
  return (record: LogRecord) => {
    const level = mapLogLevel(record.level);
    const message = formatMessage(record.message);
    customLogger[level](message, record.properties);
  };
}

function formatMessage(parts: readonly (string | unknown)[]): string {
  let result = "";
  for (let i = 0; i < parts.length; i += 2) {
    result += parts[i];
    if (i + 1 < parts.length) result += JSON.stringify(parts[i + 1]);
  }
  return result;
}
```
