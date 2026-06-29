# Arrtemplar

Arrtemplar is a production-ready Bun monorepo template for Arrbit projects. It provides a clean, extensible foundation with auth, admin, and observability built in — ready to be cloned and specialized for any domain.

- Bun monorepo workspace
- Elysia backend with `GET /health`
- OpenAPI docs at `/openapi`
- Drizzle ORM schema for the core SQLite tables (users, sessions, audit_logs)
- Drizzle Kit generated SQL migrations
- Bun-native `bun:sqlite` migration runner
- First-boot admin account setup using Argon2id password hashing
- Auth API routes for login, logout, current user, and admin role checks
- Server-side sessions with hashed session tokens stored in SQLite
- HttpOnly SameSite session cookies with a production-secure cookie setting
- Failed-login rate limiting and auth/admin audit log entries
- Backend LogTape operational logging with redacted rotating JSONL output and local terminal mirroring
- React + Vite + TypeScript frontend
- Tailwind CSS v4 and shadcn/ui-compatible structure
- TanStack Query and TanStack Router frontend foundation
- Eden-based internal API client typing
- Shared TypeScript contracts

## Usage as a template

```sh
# Clone the template
git clone <arrtemplar-repo> my-new-project
cd my-new-project

# Customize for your project
# - Update APP_NAME in packages/shared/src/constants/app.ts
# - Extend the DB schema in apps/server/src/db/schema.ts
# - Change the project name in package.json files
# - Update the web app title in apps/web/index.html

# Install and run
bun install
bun run dev
```

## Development

Install dependencies:

```sh
bun install
```

### Start the app

Start the backend and frontend dev servers together:

```sh
bun run dev
```

This uses a small Bun-native dev runner instead of Bun workspace `--parallel` mode, so the terminal is not prefixed with package runner labels. Routine Vite output is silenced; backend operational output in the shared dev terminal should come from LogTape. Fatal Vite startup diagnostics are still allowed through stderr so broken frontend startup is not hidden.

| App | URL | Runtime | Hot reload |
| --- | --- | --- | --- |
| Backend | `http://localhost:3000` | `bun --hot apps/server` | Bun `--hot` (file watcher) |
| Frontend | `http://localhost:5173` | `bunx --bun vite --logLevel error` | Vite HMR / React Fast Refresh |
| Typecheck | `bun run dev:typecheck` (manual) | `tsc --noEmit --watch` | TypeScript watch mode |

- **Backend changes** — Bun's `--hot` reloads Elysia automatically. No app restart needed.

## Quality checks

```sh
bun run check
```

Runs the focused code review suite in this order: Fallow audit, React Doctor diff scan for
`apps/web`, TypeScript typecheck, Bun tests, then Biome lint/format as the final cleanup
surface.

Use the full suite before handoff or review:

```sh
bun run check:quality:code:full
```

`bun run check:code:quality:full` is kept as an alias for the same full code-review suite.
Fallow owns repo-wide code intelligence (dead code, dependency health, duplication,
complexity, boundaries). React Doctor owns React-specific diagnostics only and has its own
`apps/web/doctor.config.json` with React Doctor dead-code analysis disabled so it does not
overlap with Fallow. Biome runs last for formatting and linting. See
`docs/architecture/code-quality-suite.md` for the detailed tool split, ignore policy, and
official source links.

- **Frontend changes** — Vite HMR updates the browser instantly. No page reload needed.
- **TypeScript contract changes** — Run `bun run dev:typecheck` in a separate terminal for live type-checking across the workspace.
- **API calls** — The frontend client uses the browser's current origin. Vite proxies `/health` and `/api` to the backend via `http://localhost:3000`.

### Run services separately

Run each dev server manually:

```sh
bun run dev:server     # Backend on http://localhost:3000
bun run dev:web        # Frontend on http://localhost:5173
bun run dev:typecheck  # TypeScript watch
```

Tests that need a server port default to `3001`, separate from development port `3000`.

Useful checks:

```sh
bun test
bun run typecheck
bun run build
bun run check
bun run check:quality:code:full
```

Database commands:

```sh
bun run db:generate
bun run db:migrate
```

`db:generate` uses Drizzle Kit to generate SQL migrations. `db:migrate` follows Bun's Drizzle guide by applying those generated migrations from a Bun script with Drizzle's Bun SQLite migrator, so the app keeps using native `bun:sqlite`.

SQLite database paths are fixed by environment:

- Development database: `data/db/arrtemplar-dev.sqlite`.
- Test database: `data/db/arrtemplar-test.sqlite`.

Tests always set and validate the canonical test database path before app code loads. They reset `data/db/arrtemplar-test.sqlite` and its SQLite sidecars deliberately, run the real migrations, and never fall back to the development database.
SQLite does not start a separate database listener, so test isolation is enforced with the canonical test database file plus the isolated test server port.

### Backend logging

The backend configures LogTape once at startup before migrations and request handling. Application, request, security, and Drizzle query logs always share one operational JSONL file sink. In local development they are also mirrored to the terminal with LogTape's ANSI console formatter, so `bun dev` shows backend startup and request logs without Bun workspace prefixes or routine Vite output.

- Default path: `data/logs/arrtemplar.jsonl`.
- Default rotation: 10 MiB per file, keeping 5 rotated files.
- Default levels: `debug` in local development, `fatal` in tests, and `info` in production.
- Terminal app logs: enabled in local development, disabled by default in tests and production, override with `LOG_CONSOLE=true|false`.
- LogTape meta warnings/errors use a separate console sink so logging-system issues stay visible.

Optional overrides:

```txt
LOG_LEVEL=info
LOG_FILE_PATH=data/logs/arrtemplar.jsonl
LOG_FILE_MAX_SIZE_BYTES=10485760
LOG_FILE_MAX_FILES=5
LOG_CONSOLE=true
```

Log output is redacted with both structured-field and formatted-message redaction. Do not intentionally log passwords, raw session tokens, cookies, authorization headers, CSRF tokens, or password hashes. The SQLite `auditLogs` table remains the durable security audit trail for auth/admin events; LogTape is for operational diagnostics. Frontend/browser LogTape logging is not included in this slice.

Auth endpoints:

```txt
GET  /api/auth/setup
POST /api/auth/setup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
GET  /api/admin/auth/check
```

On a fresh database, open the app and create the first account from the login page. That first account is created as the admin account and signed in automatically. After any user exists, the setup endpoint is disabled.

## Services

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000` returns an API landing response with links to the frontend, health check, and OpenAPI UI
- Health: `http://localhost:5173/health` via Vite proxy, or `http://localhost:3000/health` directly
- OpenAPI UI: `http://localhost:3000/openapi`

## Environment

Copy `.env.example` to `.env` for local development.

- `DATABASE_URL` defaults to `data/db/arrtemplar-dev.sqlite` outside tests.
- In `NODE_ENV=test`, `DATABASE_URL` must be `data/db/arrtemplar-test.sqlite`; unsafe test settings fail loudly instead of falling back to the dev database.
- `BACKEND_ORIGIN` is the backend target Vite proxies to during development.
- `VITE_API_BASE_URL` is blank by default so the frontend uses the Vite dev proxy; set it only when serving the frontend separately from the API.
- `USE_POLLING=true` enables polling file watchers for environments where native file watching is unreliable.
- `SESSION_COOKIE_SECURE` is `false` in local HTTP development; set it to `true` behind HTTPS in production.
- `LOG_LEVEL` controls backend operational log verbosity. Valid values are `trace`, `debug`, `info`, `warning`, `error`, and `fatal`.
- `LOG_FILE_PATH` defaults to `data/logs/arrtemplar.jsonl` for the backend rotating JSONL log file.
- `LOG_FILE_MAX_SIZE_BYTES` defaults to `10485760` bytes before rotation.
- `LOG_FILE_MAX_FILES` defaults to `5` retained log files.
- `LOG_CONSOLE` mirrors backend app logs to the terminal. It defaults to `true` in local development and `false` in tests and production.

## Docker image

Pushes to `main` now publish `prvctech/arrtemplar:latest` from `.github/workflows/docker-publish.yml`. Semver tag pushes such as `v1.2.3` also publish matching version tags.

Add this GitHub repository secret before enabling the workflow:

- `DOCKERHUB_TOKEN` — a Docker Hub access token that can push to the `prvctech` namespace.

The published image serves the built frontend and the Bun API together on port `3000`, so the container behaves like one packaged app instead of separate dev services.

Docker defaults:

- `WEB_ORIGIN=http://localhost:3000`
- `FRONTEND_DIST_ROOT=apps/web/dist`
- `DATABASE_URL=data/db/arrtemplar-dev.sqlite`
- `SESSION_COOKIE_SECURE=false`

For real HTTPS deployments, override `WEB_ORIGIN` with your public URL and set `SESSION_COOKIE_SECURE=true`. SQLite and log data live under `/app/data` inside the container.
