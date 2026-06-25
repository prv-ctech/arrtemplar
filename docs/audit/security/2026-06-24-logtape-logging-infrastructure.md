# Security Audit: LogTape Logging Infrastructure

Date: 2026-06-24
Trigger: user
Scope: LogTape logging infrastructure, request correlation, redaction policy, safe error diagnostics, and tests for logging-data leakage risk.

## Trust Boundaries

- HTTP request metadata can include headers, cookies, request IDs, URLs, and query values from clients.
- Auth, OAuth, CSRF, session, and API-key flows can place sensitive values in structured log fields or free-form error text.
- Drizzle query logging can include SQL text and bound params from database calls.
- Thrown errors can include paths, tokens, stack frames, and third-party message text.
- Log sinks and formatters persist records to terminal/file outputs after field and pattern redaction.

## Affected Areas

- `apps/server/src/logging/redaction.ts` — central LogTape sink/formatter redaction policy.
- `apps/server/src/app.ts` — Elysia request logging and request ID context propagation.
- `apps/server/src/db/client.ts` — Drizzle query logging category, level, and SQLite dialect.
- `apps/server/src/security/errors.ts` — API error response and unexpected-error diagnostics policy.
- `test/helpers/logging.ts` — shared LogTape test recorder and redacted capture setup.
- `test/apps/server/src/logging/config.test.ts` — structured and formatted redaction proof.
- `test/apps/server/src/app.test.ts` — HTTP request ID and request-log leakage proof.
- `test/apps/server/src/db/client.test.ts` — Drizzle query logging and redaction proof.
- `test/apps/server/src/security/errors.test.ts` — generic 500 response and safe log proof.

## Findings

- `LOG-RED-001` — high — fixed — `apps/server/src/logging/redaction.ts` — Field redaction now covers auth headers, cookies, API/session/OAuth/CSRF tokens, email, Drizzle `query`/`formattedQuery`/`params`, and error text fields.
- `LOG-RED-002` — high — fixed — `apps/server/src/logging/redaction.ts` — Pattern redaction now covers bearer/basic auth, cookie headers, URL query secrets, key-value token text, JWTs, cards, and emails.
- `LOG-URL-001` — medium — fixed — `apps/server/src/logging/redaction.ts` — URL-like fields now redact query values while preserving path and hash; localhost startup URLs without sensitive query values stay visible.
- `LOG-ERR-001` — high — fixed — `apps/server/src/security/errors.ts` — Unexpected errors keep generic 500 responses and log only structured diagnostics: `event`, `eventId`, `code`, `errorType`, `status`, and request method/path/request ID when available.
- `LOG-CTX-001` — medium — fixed — `apps/server/src/app.ts` — Elysia request logs now attach and echo normalized `requestId` values while preserving `/health` log suppression.
- `LOG-DB-001` — medium — fixed — `apps/server/src/db/client.ts` — Drizzle query logging uses the app database query category, debug level, and SQLite dialect; query fields are redacted by sinks.
- `LOG-LIFE-001` — medium — fixed — `apps/server/src/logging/config.ts`, `apps/server/src/main.ts`, `apps/server/src/db/migrate.ts` — Logging configuration is reset-safe and shutdown/startup/migration paths dispose LogTape sinks on success or failure.
- `LOG-LINT-001` — low — fixed — `test/helpers/logging.ts` — Shared test logging configuration now uses a dedicated LogTape meta sink and official `@logtape/testing` recorder.
- `DEP-AUDIT-001` — low — documented — `package.json` / `bun.lock` — `bun audit --prod` reports `esbuild >=0.27.3 <0.28.1` via `drizzle-kit` and `vite`, advisory GHSA-g7r4-m6w7-qqqr. The reported impact is Windows development-server arbitrary file read; this logging refactor does not add esbuild usage. Track separately if dependency policy requires all low advisories to be remediated.

## Verification

- `DATABASE_URL=data/db/arrtemplar-test.sqlite bun test test/apps/server/src/logging/config.test.ts test/apps/server/src/app.test.ts test/apps/server/src/db/client.test.ts test/apps/server/src/security/errors.test.ts test/apps/server/src/main.test.ts` — passed: 26 tests, 141 assertions.
- `DATABASE_URL=data/db/arrtemplar-test.sqlite bun test test` — passed inside `bun run check:quality:code`: 313 tests, 2326 assertions.
- `bun run check:code:logtape` — passed with all LogTape lint rules configured as errors.
- `bun run typecheck` — passed.
- `bun run check:quality:code` — passed.
- `bun run --cwd apps/server typecheck` — passed.
- `bun audit --prod` — completed with one low esbuild advisory documented as `DEP-AUDIT-001`.

## Next Actions

- Track `DEP-AUDIT-001` separately from the logging refactor if the team wants a zero-advisory dependency baseline.
