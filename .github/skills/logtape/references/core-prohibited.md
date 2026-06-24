# Rule: core-prohibited (LogTape)

## Rationale

LogTape's value comes from its structured, hierarchical, library-first model.
The patterns below break that model (or the repo's secrets posture) and are
banned by the `@logtape/lint` rules or the repo's own conventions.

## Prohibited Actions

- **NO `console.log` / `console.error` for application logging.** Use `getLogger([...])`. `console.*` bypasses categories, levels, redaction, and sinks. (Reserve `console.*` for genuine CLI tooling output.)
- **NO template-literal interpolation in messages:** `` logger.info(`User ${id} logged in`) `` → use `logger.info("User {userId} logged in.", { userId: id })`. Enforced by `@logtape/no-message-interpolation` (`error`).
- **NO `configure()` / `configureSync()` / `reset()` in library or route code.** Only the application entry may configure LogTape. Libraries must stay silent until the app opts in.
- **NO missing meta logger.** Every `configure()`/`configureSync()` must include `{ category: ["logtape", "meta"], sinks: [...] }` (array form, non-empty sinks). Enforced by `@logtape/require-meta-sink` (`warn`).
- **NO un-awaited async lazy logs.** `logger.debug("…", async () => ({…}))` returns `Promise<void>` — `await` it. Enforced by `@logtape/no-unawaited-log` (`error`, auto-fixable when enclosing fn is async).
- **NO eager expensive calls in properties.** `.debug("{d}", { d: compute() })` runs `compute()` even when debug is off. Use `lazy(() => compute())`. Flagged by `@logtape/prefer-lazy-evaluation` (`warn`, auto-fixable).
- **NO mixing sync and async config lifecycles.** Pair `configure()`↔`reset()`, `configureSync()`↔`resetSync()`. Do not cross them. Async sinks (`fromAsyncSink`) require `configure()`, never `configureSync()`.
- **NO reconfiguration without `reset: true`.** Calling `configure()` twice throws `ConfigError` unless the second call passes `reset: true` (or you call `reset()` first).
- **NO duplicate logger categories.** Two loggers with the same `category` array throw `ConfigError` at `configure()` time.
- **NO `withContext()` / `withCategoryPrefix()` without `contextLocalStorage`.** Without `contextLocalStorage: new AsyncLocalStorage()` in `configure()`, both silently no-op and warn the meta logger.
- **NO raw secrets in log properties.** `password`, `token`, `sessionToken`, `passwordHash`, cookies, `Authorization` headers, etc. must pass through `createRedactedSink()` / `createRedactedTextFormatter()`. Never log them directly.
- **NO `npm`, `yarn`, or `pnpm`.** Use `bun add`. Use `bunx` instead of `npx`. No `@types` side-packages (LogTape ships bundled `.d.ts`).
- **NO browser code importing Bun or server-only sinks.** `apps/web/src/**` uses `configureSync()` + standard Web APIs; file sinks are unavailable in the browser.

## Examples

### Incorrect

```typescript
// String interpolation destroys structured fields:
logger.info(`User ${user.id} logged in from ${ip}`);

// Library configures itself (forbidden — app owns config):
// inside packages/shared or a route handler
await configure({ sinks: { console: getConsoleSink() }, loggers: [/*…*/] });

// Missing meta logger + bare-string category:
configureSync({
  sinks: { console: getConsoleSink() },
  loggers: [{ category: "app", sinks: ["console"] }],   // no ["logtape","meta"]
});

// Eager + un-awaited async:
logger.debug("Result {r}", { r: heavy() });
logger.debug("Data {d}", async () => ({ d: await fetch() }));

// Raw secret leaked:
logger.info("Auth header {header}", { header: req.headers.authorization });
```

### Correct

```typescript
logger.info("User {userId} logged in from {ip}", { userId: user.id, ip });

// Library: getLogger only; app calls configureServerLogging() once.
configureSync({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: ["app"], sinks: ["console"] },
    { category: ["logtape", "meta"], sinks: ["console"] },   // array form + sink
  ],
});

logger.debug("Result {r}", { r: lazy(() => heavy()) });
await logger.debug("Data {d}", async () => ({ d: await fetch() }));

// Secrets redacted by the wrapped sink (see core-redaction.md):
logger.info("Issued cookie");   // value never logged; redaction handled by sink layer
```
