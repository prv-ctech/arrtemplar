# Rule: sinks-custom-async (LogTape)

> Source: <https://logtape.org/manual/sinks#async-sink-adapter>.

LogTape sinks are **synchronous by design** (`Sink = (record) => void`). When
you need `await` (database insert, HTTP webhook), use `fromAsyncSink()` (since
1.0.0) to bridge an `AsyncSink` into a synchronous sink.

## `AsyncSink` type

```typescript
export type AsyncSink = (record: LogRecord) => Promise<void>;
```

## Creating an async sink

```typescript
import { type AsyncSink, fromAsyncSink } from "@logtape/logtape";

const webhookSink: AsyncSink = async (record) => {
  await fetch("https://example.com/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      timestamp: record.timestamp,
      level: record.level,
      message: record.message,
      properties: record.properties,
    }),
  });
};

const sink = fromAsyncSink(webhookSink);
```

## How `fromAsyncSink()` works

1. **Chains async ops** — each log call is chained to the previous via Promise chaining, preserving order.
2. **Handles errors** — an async failure is caught so it can't break the chain for later logs.
3. **Implements `AsyncDisposable`** — disposal waits for pending operations.

## Example: database logging

```typescript
import { type AsyncSink, configure, fromAsyncSink } from "@logtape/logtape";

const databaseSink: AsyncSink = async (record) => {
  await db.logs.insert({
    timestamp: record.timestamp,
    level: record.level,
    category: record.category.join("."),
    message: record.message.join(""),
    properties: JSON.stringify(record.properties),
  });
};

await configure({
  sinks: { database: fromAsyncSink(databaseSink) },
  loggers: [{ category: [], sinks: ["database"], lowestLevel: "info" }],
});
```

## Important considerations

- **Configuration** — async sinks require **async disposal**, so they work only with `configure()`, **not** `configureSync()`.
- **Error handling** — errors are swallowed to protect the chain; handle errors inside the sink if you need to.
- **Disposal** — ensure pending ops complete on shutdown:

```typescript
import { dispose } from "@logtape/logtape";
await dispose(); // in your shutdown handler
```

> In this repo, server-side DB logging should go through Drizzle + the existing
> `["app", …]` LogTape categories; an async DB sink is an option only if you
> need logs persisted as rows separate from app data.

## Custom synchronous sink

If you don't need `await`, a sink is just a function:

```typescript
import { type LogRecord, type Sink } from "@logtape/logtape";

const mySink: Sink = (record: LogRecord) => {
  // push to a ring buffer, increment a counter, etc.
};
```
