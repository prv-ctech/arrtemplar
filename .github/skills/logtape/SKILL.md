---
name: logtape
description: |
  LogTape is the logging library for this repo (server + libraries). Use whenever
  writing, configuring, testing, or reviewing logging code. Covers hierarchical
  categories, six severity levels, structured logging, implicit/lazy contexts,
  sinks (console/stream/file/rotating/OTel/Sentry/Syslog), filters, text
  formatters, data redaction, framework integrations (Elysia, Drizzle, Express,
  Fastify, Hono, Koa), adapters (winston/Pino/bunyan/log4js), lint rules,
  testing, and debugging. Repo runs on Bun + Elysia + Drizzle, so prefer
  `bun add`/`bunx` over `npm`/`npx`.

  USE THIS SKILL WHEN THE USER:
  - Adds, edits, or reviews any logging call (getLogger, logger.info, etc.)
  - Configures LogTape (configure / configureSync / reset / configureFromObject)
  - Designs the hierarchical category tree or sets per-category lowestLevel
  - Writes structured log messages with {placeholders} and properties
  - Uses implicit contexts (withContext), explicit contexts (logger.with), or lazy()
  - Adds or tunes a sink, filter, or text formatter
  - Needs data redaction (secrets, PII, tokens, pseudonymization)
  - Integrates LogTape with Elysia, Drizzle ORM, or another framework
  - Forwards LogTape logs to an existing logger (winston/Pino/bunyan/log4js)
  - Sets up LogTape lint rules (@logtape/lint)
  - Writes tests that assert on emitted logs (createLogRecorder)
  - Debugges why logs are missing or a sink errors out (meta logger)

  CORE PATTERNS:
  - Library-first contract: libraries only getLogger(); the APPLICATION calls configure()
  - No configuration means no logs — logger calls are no-ops until the app opts in
  - Structured logging uses named placeholders ("User {userId} logged in.", { userId }), NEVER template-literal ${userId}
  - Categories are hierarchical arrays (["app", "http"]); sinks/levels flow parent → child
  - The meta logger category is ["logtape", "meta"] — always give it a dedicated sink
  - Implicit contexts need contextLocalStorage (new AsyncLocalStorage()) set in configure()
  - Use lazy() / async callbacks / isEnabledFor() to avoid expensive work when a level is off
  - Replace npm → bun add, npx → bunx everywhere (repo runs on Bun)
compatibility:
  - github-copilot
  - claude-code
  - openai-codex
license: MIT
metadata:
  author: arrbit
  version: "2.2.1"
  logtape_core: "@logtape/logtape@^2.2.0"
---

# LogTape — Agent Instruction Set

> **This file is a map, not the territory.** All detailed API signatures, option
> tables, code examples, and rule rationale live exclusively in the `references/`
> directory. This file tells you WHICH reference to read for which task.
> **Do not write LogTape code until you have read the relevant reference file(s).**

> **Doc version captured:** LogTape 2.2.1 (manual + sinks + lint + JSR packages).
> Sources: <https://logtape.org/manual/>, <https://logtape.org/sinks/>, <https://logtape.org/lint/>, <https://jsr.io/@logtape>.

---

## How to Use This Skill

1. **Identify the task** from the `USE THIS SKILL WHEN` list above.
2. **Read the matching reference file** from the index below. Each covers one LogTape concern.
3. **Always start with `core-preflight.md`** before making changes — it has the repo-specific checklist.
4. **Read `core-prohibited.md` first** to avoid the most common LogTape mistakes.
5. **Cross-reference** when needed. For example: adding a redacted file sink → `sinks-file.md` + `core-redaction.md` + `core-formatters.md`.

---

## Reference File Index

### 🧠 Start Here

| File | Purpose |
|------|---------|
| **[core-preflight.md](references/core-preflight.md)** | Preflight checklist + repo logging conventions. **READ FIRST.** |
| **[core-prohibited.md](references/core-prohibited.md)** | Prohibited patterns: `console.log`, `${}` interpolation, `configure()` in libraries, mixing sync/async config. |
| **[core-install.md](references/core-install.md)** | Package family, `bun add` install, versions, repo packages in use. |
| **[core-quickstart.md](references/core-quickstart.md)** | End-to-end: `configure()` + `getLogger()` + log levels in 2 minutes. |

### ⚙️ Core Configuration

| File | Purpose |
|------|---------|
| **[core-config.md](references/core-config.md)** | `configure()` / `configureSync()` / `reset()` / `resetSync()` / `dispose()`, sinks+filters+loggers, reconfiguration, env-driven config, browser/SPA rules. |
| **[core-config-from-object.md](references/core-config-from-object.md)** | `@logtape/config`: `configureFromObject()`, module-reference syntax, built-in shorthands, env-var expansion, custom shorthands. |
| **[core-categories.md](references/core-categories.md)** | Hierarchical category tree, sink inheritance & `parentSinks`, root logger `[]`, child loggers, meta logger, `withCategoryPrefix()`. |
| **[core-levels.md](references/core-levels.md)** | Six levels (trace→fatal), `lowestLevel`, Error-object overloads, `getLogLevels()`, `compareLogLevel()`, `LogMethod`. |
| **[core-logging-api.md](references/core-logging-api.md)** | `getLogger()`, tagged-template + method-call forms, named placeholders, nested/`{*}` access, structured properties. |
| **[core-contexts.md](references/core-contexts.md)** | Explicit `.with()`, lazy contexts, implicit `withContext()`, AsyncLocalStorage, HTTP request contexts, priority rules. |
| **[core-lazy.md](references/core-lazy.md)** | `lazy()`, async lazy callbacks, `isEnabledFor()`, decision tree, anti-patterns. |
| **[core-filters.md](references/core-filters.md)** | Filter functions, inheritance, level filter, throttling filter, sink-scoped `withFilter()`. |
| **[core-formatters.md](references/core-formatters.md)** | `defaultTextFormatter`, `ansiColorFormatter`, `jsonLinesFormatter`, `logfmtFormatter`, `prettyFormatter`, full option tables. |
| **[core-redaction.md](references/core-redaction.md)** | Pattern-based (`redactByPattern`) vs field-based (`redactByField`) redaction, HMAC pseudonymizer, repo redaction setup. |
| **[core-disposal.md](references/core-disposal.md)** | `Disposal`/`AsyncDisposable` sinks, `dispose()`, Cloudflare Workers `waitUntil`. |

### 🚰 Sinks

| File | Purpose |
|------|---------|
| **[sinks-console-stream.md](references/sinks-console-stream.md)** | `getConsoleSink()`, `getStreamSink()`, non-blocking mode, console formatter signature. |
| **[sinks-file.md](references/sinks-file.md)** | `getFileSink()`, `getStreamFileSink()`, `getRotatingFileSink()`, `getTimeRotatingFileSink()` from `@logtape/file`. |
| **[sinks-fingers-crossed.md](references/sinks-fingers-crossed.md)** | `fingersCrossed()` buffer-until-error, category/context isolation, TTL/LRU buffer management. |
| **[sinks-custom-async.md](references/sinks-custom-async.md)** | Writing a custom `Sink`, `AsyncSink` + `fromAsyncSink()` adapter for DB/webhook logging. |
| **[sinks-external.md](references/sinks-external.md)** | OpenTelemetry, Sentry, Syslog, CloudWatch Logs, Windows Event Log sink packages. |

### 🔌 Integrations & Adapters

| File | Purpose |
|------|---------|
| **[integrations-elysia.md](references/integrations-elysia.md)** | `@logtape/elysia` `elysiaLogger()` — **repo's HTTP layer**. Options, scope, request context, formats, repo usage. |
| **[integrations-drizzle.md](references/integrations-drizzle.md)** | `@logtape/drizzle-orm` — **repo's DB query logging**. Custom category/level/dialect, structured output. |
| **[integrations-frameworks.md](references/integrations-frameworks.md)** | Express, Fastify, Hono, Koa, SvelteKit integrations + `Logger.emit()` for third-party logs. |
| **[integrations-adaptors.md](references/integrations-adaptors.md)** | `@logtape/adaptor-{winston,pino,bunyan,log4js}` — forward LogTape to an existing logger. |

### ✅ Quality Gates

| File | Purpose |
|------|---------|
| **[lint-rules.md](references/lint-rules.md)** | `@logtape/lint` rules: `no-message-interpolation`, `prefer-lazy-evaluation`, `no-unawaited-log`, `require-meta-sink`. ESLint/Oxlint/Deno config. |
| **[testing.md](references/testing.md)** | `@logtape/testing` `createLogRecorder()`, `assertLogged`/`assertNotLogged`, buffer sink, `reset()` between tests. |
| **[debug.md](references/debug.md)** | Meta logger, sink error handling, `ConfigError` causes (duplicate, missing reset, sync/async mismatch). |
| **[library.md](references/library.md)** | Authoring libraries with LogTape (namespaced categories, never `configure()`), and configuring a library as an app dev. |

---

## Agent Behavioral Rules

1. **Never write LogTape code from memory.** Always read the relevant reference file(s) first. Read `core-prohibited.md` to avoid banned patterns.

2. **The app owns configuration.** Libraries call only `getLogger()`. Never call `configure()`/`configureSync()` in library code — that is the application's job (see `library.md`).

3. **No configuration = no logs.** Until the app calls `configure()`, every `logger.*()` call is a silent no-op. Do not "fix" missing logs by sprinkling `console.log`; configure the app instead.

4. **Structured logging is mandatory.** Use named placeholders (`"User {userId} logged in."`) with a properties object. **Never** use template-literal interpolation (`\`User ${userId} logged in.\``) — it bakes values into the string and destroys structured fields. The `@logtape/no-message-interpolation` lint rule enforces this.

5. **Always configure the meta logger.** Include a logger entry with `category: ["logtape", "meta"]` (array form) and a non-empty `sinks`. The `require-meta-sink` lint rule warns otherwise. Give it a **separate** sink so logging failures are visible.

6. **Implicit contexts require `contextLocalStorage`.** Set `contextLocalStorage: new AsyncLocalStorage()` in `configure()` before using `withContext()` or `withCategoryPrefix()`. Without it, both silently no-op and log a warning to the meta logger.

7. **Prefer Bun-native tooling.** Install with `bun add` (not `npm install`/`yarn`/`pnpm`). Run commands with `bunx` (not `npx`). The repo runs on the Bun runtime. Read env via `Bun.env`, not `process.env`, in server code.

8. **Use the repo's existing logging setup.** Logging is configured once in `apps/server/src/logging/config.ts` (`configureServerLogging`) and redaction in `apps/server/src/logging/redaction.ts`. Reuse `createRedactedSink()` / `createRedactedTextFormatter()` instead of re-wiring redaction. The root category constant is `APP_LOG_CATEGORY` (`"app"`) from `@arrtemplar/shared`.

9. **Lazy-evaluate expensive values.** When a logged value is costly to compute, wrap it in `lazy(() => …)` or pass a callback/async callback. Use `isEnabledFor(level)` only for multiple statements or setup work. The `prefer-lazy-evaluation` lint rule flags eager function calls in properties.

10. **Await async lazy logs.** When a log method takes an `async () => ({…})` callback it returns `Promise<void>` — always `await` it. The `no-unawaited-log` lint rule enforces this.

---

### Repo-Approved LogTape Patterns

| Anti-pattern | Correct LogTape pattern |
|---|---|
| `console.log("…")` / `console.error(err)` | `getLogger(["app", …]).info("…")` / `.error(err)` |
| `` logger.info(`User ${id} logged in`) `` | `logger.info("User {userId} logged in.", { userId: id })` |
| `configure()` inside a library | `getLogger(["my-lib"])` only; app calls `configure()` |
| Missing meta logger | Add `{ category: ["logtape", "meta"], sinks: ["meta"] }` |
| `withContext({ requestId })` with no storage | Set `contextLocalStorage: new AsyncLocalStorage()` in `configure()` |
| Eager expensive value: `.debug("{d}", { d: compute() })` | `.debug("{d}", { d: lazy(() => compute()) })` |
| Un-awaited async log: `.debug("…", async () => ({…}))` | `await logger.debug("…", async () => ({…}))` |
| `process.env.X` for env-driven config | `Bun.env.X` (server) — see `core-config.md` |
| Raw secret in a log property | Wrap sink via `redactByField` / formatter via `redactByPattern` (see repo `redaction.ts`) |
| Installing packages with `npm`/`yarn`/`pnpm` | `bun add @logtape/<pkg>` |
| Running a one-off with `npx` | `bunx <cmd>` |

### Packages In Use (repo)

| Package | Purpose |
|---|---|
| `@logtape/logtape` | Core (`configure`, `getLogger`, sinks, filters, formatters) — root pins `^2.2.0`, server `^2.1.4` |
| `@logtape/file` | Rotating/file sinks (`getRotatingFileSink`) — used by `logging/config.ts` |
| `@logtape/redaction` | `redactByField` / `redactByPattern` + built-in patterns — used by `logging/redaction.ts` |
| `@logtape/elysia` | `elysiaLogger()` HTTP plugin — used by `apps/server/src/app.ts` |
| `@logtape/drizzle-orm` | Drizzle query logging `getLogger()` — server dep |

### LogTape 2.2.x Highlights (relevant to this repo)

- **2.2.0** — `createLogRecorder()` + `assertLogged`/`assertNotLogged` in `@logtape/testing`; `configureFromObject` implicit-context support; `contextLocalStorage` propagation from adaptors.
- **2.1.x** — Error-object overloads (`logger.error(err)`, `logger.error(msg, err)`, `logger.error(err, props)`); `logfmtFormatter`; `timeZone` formatter option; throttling filter; HMAC pseudonymizer; Bunyan adaptor.
- **2.0.x** — `configureFromObject` / `@logtape/config`; async lazy evaluation; `lazy()` context values; `isEnabledFor()`; `log4js` adaptor; `parentSinks: "override"`.
- **1.x** — `fingersCrossed()` sink; `prettyFormatter` (`@logtape/pretty`); non-blocking console/stream sinks; `time-based rotating file sink`; `Logger.emit()`; `withCategoryPrefix()`.

### Browser Boundary

```typescript
// apps/server/src/feature.ts — server: full LogTape + Bun APIs
import { getLogger } from "@logtape/logtape";
const logger = getLogger(["app", "feature"]);
logger.info("Server-side log");

// apps/web/src/feature.tsx — UI: configureSync() at entry, getLogger() only
import { configureSync, getConsoleSink, getLogger } from "@logtape/logtape";
configureSync({ sinks: { console: getConsoleSink() }, loggers: [ { category: ["app"], sinks: ["console"] } ] });
getLogger(["app", "ui"]).info("Browser log");
```

---

## File Organization

```text
.github/skills/logtape/
├── SKILL.md
└── references/
    ├── core-*.md           # Preflight, prohibited, install, config, categories, levels, API, contexts, lazy, filters, formatters, redaction, disposal
    ├── sinks-*.md          # Console/stream, file, fingers-crossed, custom/async, external sinks
    ├── integrations-*.md   # Elysia, Drizzle, other frameworks, adaptors
    ├── lint-rules.md       # @logtape/lint rules + ESLint/Oxlint/Deno config
    ├── testing.md          # createLogRecorder, buffer sink, reset between tests
    ├── debug.md            # Meta logger, sink errors, ConfigError
    └── library.md          # Authoring/configuring libraries
```
