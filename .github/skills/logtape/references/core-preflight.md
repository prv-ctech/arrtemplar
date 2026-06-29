# Rule: core-preflight (LogTape)

## Rationale

Logging is the repo's primary observability layer. Checking a few things before
writing logging code keeps categories consistent, secrets redacted, and config
in exactly one place.

## Repo conventions

- **Root app category** — `APP_LOG_CATEGORY` (`"app"`) from `packages/shared/src/constants/app.ts` (`@arrtemplar/shared`).
- **HTTP request logs** — category `["app", "http"]`, emitted by `elysiaLogger()` in `apps/server/src/app.ts`.
- **Meta logger** — category `["app", "meta"]`, routed to a dedicated `"meta"` sink, gated by the `metaWarnings` level filter (`"warning"`).
- **Single config entry point** — `apps/server/src/logging/config.ts` → `configureServerLogging()`. Do not configure LogTape anywhere else.
- **Redaction** — `apps/server/src/logging/redaction.ts` exposes `createRedactedSink()` and `createRedactedTextFormatter()`. Always wrap sinks and formatters through these.
- **Env-driven level** — `env.logLevel` (a severity string) is wired as a `filters` entry named `runtimeLevel`.
- **Implicit contexts** — `contextLocalStorage: new AsyncLocalStorage()` is set in `configureServerLogging()`, so `withContext()` and `withCategoryPrefix()` work.
- **File sink** — `getRotatingFileSink(logFilePath, { maxSize, maxFiles, formatter })` emitting JSON Lines (`getJsonLinesFormatter({ categorySeparator: ".", message: "rendered", properties: "nest:properties" })`).
- **Console sink** — `getConsoleSink({ formatter: getAnsiColorFormatter({ timestamp: "date-time-tz" }) })`, only attached when `env.logConsoleEnabled` is true.

## Protocol

Before writing or changing logging code, confirm:

1. **Where is this code?**
   - `apps/server/src/**` (and libraries) → `getLogger([...])` only. **Never** call `configure()`/`reset()` here.
   - The application entry (`apps/server/src/main.ts` or tests) → may call `configureServerLogging()`.
2. **Does a category already exist?** Reuse `["app", "<area>"]`. Don't invent parallel roots (e.g. `"server"`, `"backend"`). See `core-categories.md`.
3. **Is the value structured?** Use named placeholders + a properties object, not `${}`. See `core-logging-api.md`.
4. **Is any value expensive or secret?** Wrap with `lazy()`; ensure the sink passes through `createRedactedSink()`. See `core-lazy.md` and `core-redaction.md`.
5. **Run the checks after edits:**
   - `bun run lint` (includes `@logtape/lint` rules — see `lint-rules.md`)
   - `bun test` for logging tests under `test/apps/server/src/logging/`
6. **Prefer Bun tooling:** `bun add` for installs, `bunx` for one-off commands. No `npm`/`npx`.

## Examples

### Incorrect

- Calling `configure()` inside a route handler or repository.
- `logger.info(\`Loaded ${count} users\`)` — bakes `count` into the string.
- Adding a new sink in a feature module instead of `logging/config.ts`.
- Logging a raw `sessionToken` / `passwordHash` property.

### Correct

```typescript
// apps/server/src/auth/session.ts — library/route code: getLogger only
import { getLogger } from "@logtape/logtape";
import { APP_LOG_CATEGORY } from "@arrtemplar/shared";

const logger = getLogger([APP_LOG_CATEGORY, "auth", "session"]);

export function issueSession(userId: string) {
  logger.info("Issued session for user {userId}", { userId });
  logger.debug("Session details", { details: lazy(() => buildSessionSummary(userId)) });
}

// apps/server/src/logging/config.ts — single config entry point (already exists)
await configure({
  contextLocalStorage: new AsyncLocalStorage(),
  filters: { runtimeLevel: env.logLevel, metaWarnings: "warning" },
  sinks: { /* console, file, meta — all wrapped in createRedactedSink */ },
  loggers: [
    { category: [APP_LOG_CATEGORY, "meta"], filters: ["metaWarnings"], sinks: ["meta"] },
    { category: [APP_LOG_CATEGORY], filters: ["runtimeLevel"], sinks: ["appFile", "appConsole"] },
  ],
});
```
