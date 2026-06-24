# Rule: core-install (LogTape)

> Sources: <https://logtape.org/manual/install>, <https://jsr.io/@logtape>.

## Package family

LogTape is a small core plus opt-in official packages. All ship dual ESM +
CommonJS to npm and JSR, with bundled `.d.ts` (no `@types` side-package) and
zero runtime dependencies.

### Core

- `@logtape/logtape` — `configure`, `configureSync`, `reset`, `getLogger`, built-in console/stream sinks, filters, and text formatters.

### Sinks (where logs go)

- `@logtape/file` — file, stream-file, size-rotating, time-rotating sinks.
- `@logtape/otel` — OpenTelemetry sink.
- `@logtape/sentry` — Sentry sink.
- `@logtape/syslog` — Syslog sink.
- `@logtape/cloudwatch-logs` — AWS CloudWatch Logs sink.
- `@logtape/windows-eventlog` — Windows Event Log sink.
- `@logtape/pretty` — `prettyFormatter` (dev console).

### Integrations (route framework events into LogTape)

- `@logtape/elysia`, `@logtape/express`, `@logtape/fastify`, `@logtape/hono`, `@logtape/koa`, `@logtape/drizzle-orm`.

### Adapters (forward LogTape into an existing logger)

- `@logtape/adaptor-winston`, `@logtape/adaptor-pino`, `@logtape/adaptor-bunyan`, `@logtape/adaptor-log4js`.

### Toolkit

- `@logtape/redaction` — pattern + field redaction, HMAC pseudonymizer.
- `@logtape/config` — `configureFromObject` (load JSON/YAML/TOML config).
- `@logtape/lint` — ESLint/Oxlint/Deno lint rules.
- `@logtape/testing` — `createLogRecorder` for log assertions.

## Installation (this repo runs on Bun)

The official docs recommend **npm** for Node.js/Bun and **JSR** only for Deno.
This repo uses Bun, so install everything with `bun add` (never `npm`/`yarn`/`pnpm`):

```bash
# Core
bun add @logtape/logtape

# Sinks / integrations / toolkit as needed
bun add @logtape/file @logtape/redaction @logtape/elysia @logtape/drizzle-orm
```

For an unstable/dev release:

```bash
bun add @logtape/logtape@dev
```

> **Deno-only projects** may use `deno add jsr:@logtape/logtape`. Not applicable to this repo. **JSR in Node/Bun:** although JSR supports Node.js and Bun, the LogTape authors recommend npm for those runtimes — use `bun add` (npm registry) here.

## Packages already in this repo

From `package.json` / `apps/server/package.json`:

- `@logtape/logtape` — root pins `^2.2.0`, server pins `^2.1.4` (core).
- `@logtape/file` (`^2.1.4`) — rotating file sink in `logging/config.ts`.
- `@logtape/redaction` (`^2.1.4`) — `logging/redaction.ts`.
- `@logtape/elysia` (`^2.1.4`) — `elysiaLogger()` in `apps/server/src/app.ts`.
- `@logtape/drizzle-orm` (`^2.1.4`) — Drizzle query logging.

## AI-coding-assistant skill (optional)

LogTape bundles an Agent Skills skill inside the npm package. Tools that
discover skills (skills-npm, npm-agentskills) can auto-expose it. With Bun you
can also run discovery via `bunx`:

```bash
bunx agents export --target claude
bunx agents list
```

This skill (`logtape`) is the repo's hand-maintained, repo-specific equivalent
and is the source of truth here — it encodes this repo's conventions on top of
the official docs.
