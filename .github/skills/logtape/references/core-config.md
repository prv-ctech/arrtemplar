# Rule: core-config (LogTape)

> Source: <https://logtape.org/manual/config>.

`configure()` is the application's single tool for setting up logging. It takes
three components — **sinks** (where), **filters** (which), and **loggers**
(who) — and is async (always `await` it).

## Core shape

```typescript
import { getFileSink } from "@logtape/file";
import { configure, getConsoleSink } from "@logtape/logtape";

await configure({
  sinks: {
    console: getConsoleSink(),
    file: getFileSink("app.log"),
    errorFile: getFileSink("error.log"),
  },
  filters: {
    noDebug: (record) => record.level !== "debug",
    onlyErrors: (record) => record.level === "error" || record.level === "fatal",
    containsUserData: (record) =>
      record.message.some((part) => typeof part === "string" && part.includes("user")),
  },
  loggers: [
    { category: ["my-app"], lowestLevel: "info", sinks: ["console", "file"] },
    { category: ["my-app", "database"], lowestLevel: "debug", sinks: ["file"], filters: ["noDebug"] },
  ],
});
```

## Configuring loggers

- Each logger entry has `category` (array), optional `lowestLevel`, `sinks`, and `filters`.
- **Duplicate categories throw `ConfigError`.** Each category must be configured at most once.
- Loggers **inherit parent sinks** by default. Use `parentSinks: "override"` on a child to replace the inherited sinks with its own:

```typescript
{
  category: ["my-app", "my-module"],
  sinks: ["b"],
  parentSinks: "override", // do NOT also inherit ["my-app"]'s sinks
}
```

## Disposal

If a sink or filter implements `Disposal` (`[Symbol.dispose]`) or
`AsyncDisposable` (`[Symbol.asyncDispose]`), LogTape disposes it on `reset()`
or application exit. See `core-disposal.md`.

## Environment-driven configuration

Use runtime env to switch levels/sinks. **Prefer `Bun.env`** over `process.env` in server code:

```typescript
const isDev = Bun.env.NODE_ENV === "development";

await configure({
  sinks: {
    console: getConsoleSink(),
    file: getFileSink(isDev ? "dev.log" : "prod.log"),
  },
  loggers: [
    {
      category: ["my-app"],
      lowestLevel: isDev ? "trace" : "info",
      sinks: isDev ? ["console", "file"] : ["file"],
    },
  ],
});
```

## Reconfiguration

Calling `configure()` a second time **throws `ConfigError`** unless you opt into
a reset. Two options:

```typescript
// Option A: reset: true on the new call
await configure({ reset: true, ...newConfig });

// Option B: explicitly reset first
import { configure, reset } from "@logtape/logtape";
await configure(initialConfig);
// later:
reset();
await configure(newConfig);
```

## Synchronous configuration (since 0.9.0)

`configureSync()` / `resetSync()` avoid `await` — ideal for browser entry
points. **Limitation:** you cannot use sinks/filters that require
`AsyncDisposable` (e.g. stream sinks). `Disposable` (sync) sinks are fine.

```typescript
import { configureSync, getConsoleSink } from "@logtape/logtape";

configureSync({
  sinks: { console: getConsoleSink() },
  loggers: [{ category: ["my-app"], lowestLevel: "info", sinks: ["console"] }],
});
```

> **Never mix the two lifecycles.** Pair `configure()`↔`reset()` and `configureSync()`↔`resetSync()`. Async sinks created via `fromAsyncSink()` require `configure()`, never `configureSync()`.

## Browser / SPA pattern

Configure **once, synchronously, before render** — no top-level `await`:

- **React** — call `configureSync()` before `createRoot().render(...)`.
- **Vue** — call `configureSync()` before `app.mount("#app")`.
- **Next.js** — put it in `instrumentation-client.ts` (client) and `instrumentation.ts` `register()` (server).

```typescript
// setup.ts — imported first by main.ts
import { configureSync, getConsoleSink } from "@logtape/logtape";

configureSync({
  sinks: { console: getConsoleSink() },
  loggers: [{ category: ["my-app"], lowestLevel: "debug", sinks: ["console"] }],
});
```

Common mistakes:

- Configuring inside libraries (forbidden — app owns config).
- Configuring inside React components / Vue setup functions (runs repeatedly; errors).
- Forgetting the meta logger (see `require-meta-sink` lint rule / `core-categories.md`).

## Best practices

1. **Configure early** — before any logging calls.
2. **Use categories wisely** — build a logical hierarchy (see `core-categories.md`).
3. **Differentiate environments** — dev/test/prod configs.
4. **Don't overuse filters** — too many make routing hard to reason about.
5. **Mind performance** — lower levels can be hot in production.

## Declarative config (JSON/YAML/TOML)

For loading config from files, use `@logtape/config`'s `configureFromObject()` —
see `core-config-from-object.md`.
