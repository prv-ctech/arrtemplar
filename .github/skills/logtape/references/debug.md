# Rule: debug (LogTape)

> Source: <https://logtape.org/manual/debug>.

## LogTape's error handling

LogTape is resilient and non-intrusive: errors in the logging system itself are
handled so they never crash your app.

### Meta logger

The meta logger (category `["logtape", "meta"]`) reports LogTape's own issues:
sink errors/exceptions, configuration problems, internal errors.

```typescript
await configure({
  sinks: { console: getConsoleSink() },
  loggers: [
    // surface LogTape's internal messages on a dedicated sink
    { category: ["logtape", "meta"], sinks: ["console"], lowestLevel: "warning" },
    { category: ["app"], sinks: ["console"], lowestLevel: "info" },
  ],
});
```

> Give the meta logger a **separate** sink so a logging failure is still visible.

### Sink error handling

When a sink throws, LogTape:

1. Suppresses the exception (no app crash).
2. Logs the error to the meta logger.
3. Continues processing other sinks.
4. Bypasses the failing sink for meta logs (prevents infinite recursion).

```typescript
import { configure, getConsoleSink, type LogRecord, type Sink } from "@logtape/logtape";

const unreliableSink: Sink = (record: LogRecord) => {
  if (Math.random() < 0.1) throw new Error("Sink temporarily unavailable"); // 10% fail
  console.log("Reliable log:", record.message);
};

await configure({
  sinks: { unreliable: unreliableSink, meta: getConsoleSink() },
  loggers: [
    { category: ["logtape", "meta"], sinks: ["meta"], lowestLevel: "error" },
    { category: ["app"], sinks: ["unreliable"], lowestLevel: "info" },
  ],
});
```

## Configuration errors — `ConfigError`

`ConfigError` (from `@logtape/config`) signals a bad config, not app logic.

```typescript
import { configure, ConfigError, getConsoleSink } from "@logtape/logtape";

try {
  await configure({ sinks: { console: getConsoleSink() }, loggers: [{ category: ["app"], sinks: ["console"], lowestLevel: "info" }] });
  // a second configure() without reset throws "Already configured"
  await configure({ sinks: { console: getConsoleSink() }, loggers: [{ category: ["app"], sinks: ["console"], lowestLevel: "debug" }] });
} catch (error) {
  if (error instanceof ConfigError) console.error("Configuration error:", error.message);
}
```

### Duplicate configuration

Two loggers with the same `category` throw:
`"Duplicate logger configuration for category: [\"app\"]"`. Each category must be unique.

### Missing `reset` flag

A second `configure()` throws `"Already configured; if you want to reset, turn on the reset flag."` unless you pass `reset: true` (or call `reset()` first):

```typescript
await configure({ reset: true, sinks: { console: getConsoleSink() }, loggers: [{ category: ["app"], sinks: ["console"] }] });
```

### Async/sync configuration mismatch

You cannot use `configureSync()` while async disposables (e.g. an
`fromAsyncSink()` sink) from a prior `configure()` are still active:

```typescript
await configure({ sinks: { async: fromAsyncSink(async (record) => { await fetch("/logs", { method: "POST", body: JSON.stringify(record) }); }) }, loggers: [{ category: ["app"], sinks: ["async"] }] });

configureSync({ /* … */ }); // throws "Previously configured async disposables are still active..."
```

Call `await reset()` (or `await dispose()`) first, or keep using `configure()`.

## Debugging playbook

1. **Logs missing?** Confirm the app called `configure()` (libraries alone produce nothing) and that the emitting category's logger has sinks and a permissive `lowestLevel`/filter.
2. **"Already configured"?** Use `reset: true` or `reset()`; don't call `configure()` twice.
3. **Sync config throws about async disposables?** Switch to `configure()` or dispose async sinks first.
4. **Sink silently dropping logs?** Check the meta logger on a separate sink — sink errors are swallowed there.
5. **`withContext()`/`withCategoryPrefix()` not working?** Ensure `contextLocalStorage: new AsyncLocalStorage()` is set (they no-op + warn the meta logger otherwise).
6. **No structured fields downstream?** You used `${}` interpolation — switch to named `{placeholders}` + a properties object.
