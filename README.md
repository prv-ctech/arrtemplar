# Arrweeb-anime

Arrweeb-anime is a self-hosted anime-native media request, automation, and watching app.

- Bun monorepo workspace
- Elysia backend with `GET /health`
- OpenAPI docs at `/openapi`
- Drizzle ORM schema for the Phase 1 SQLite tables
- Drizzle Kit generated SQL migrations
- Bun-native `bun:sqlite` migration runner
- Idempotent first-admin seed script using Argon2id password hashing
- Auth API routes for login, logout, current user, and admin role checks
- Server-side sessions with hashed session tokens stored in SQLite
- HttpOnly SameSite session cookies with a production-secure cookie setting
- Failed-login rate limiting and auth/admin audit log entries
- React + Vite + TypeScript frontend
- Tailwind CSS v4 and shadcn/ui-compatible structure
- TanStack Query and TanStack Router frontend foundation
- Eden-based internal API client typing
- Shared TypeScript contracts
- Anime parser package skeleton

Later phases will add the frontend auth shell, metadata imports, request workflows, search providers, download clients, jobs, and playback.

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

This uses Bun's native workspace script runner to run the app dev scripts in parallel:

| App      | URL                              | Runtime                | Hot reload            |
| -------- | -------------------------------- | ---------------------- | --------------------- |
| Backend  | `http://localhost:3000`          | `bun --hot apps/server` | Bun `--hot` (file watcher) |
| Frontend | `http://localhost:5173`          | `bunx --bun vite`      | Vite HMR / React Fast Refresh |
| Typecheck | `bun run dev:typecheck` (manual) | `tsc --noEmit --watch` | TypeScript watch mode |

- **Backend changes** — Bun's `--hot` reloads Elysia automatically. No app restart needed.
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
```

Database commands:

```sh
bun run db:generate
bun run db:migrate
bun run db:seed
```

`db:generate` uses Drizzle Kit to generate SQL migrations. `db:migrate` follows Bun's Drizzle guide by applying those generated migrations from a Bun script with Drizzle's Bun SQLite migrator, so the app keeps using native `bun:sqlite`.

SQLite database paths are fixed by environment:

- Development database: `data/db/arrweeb-dev.sqlite`.
- Test database: `data/db/arrweeb-test.sqlite`.

Tests always set and validate the canonical test database path before app code loads. They reset `data/db/arrweeb-test.sqlite` and its SQLite sidecars deliberately, run the real migrations, and never fall back to the development database.
SQLite does not start a separate database listener, so test isolation is enforced with the canonical test database file plus the isolated test server port.

Auth endpoints:

```txt
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
GET  /api/admin/auth/check
```

## Services

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health: `http://localhost:5173/health` via Vite proxy, or `http://localhost:3000/health` directly
- OpenAPI UI: `http://localhost:3000/openapi`

## Environment

Copy `.env.example` to `.env` for local development.

- `DATABASE_URL` defaults to `data/db/arrweeb-dev.sqlite` outside tests.
- In `NODE_ENV=test`, `DATABASE_URL` must be `data/db/arrweeb-test.sqlite`; unsafe test settings fail loudly instead of falling back to the dev database.
- `BACKEND_ORIGIN` is the backend target Vite proxies to during development.
- `VITE_API_BASE_URL` is blank by default so the frontend uses the Vite dev proxy; set it only when serving the frontend separately from the API.
- `USE_POLLING=true` enables polling file watchers for environments where native file watching is unreliable.
- `SESSION_COOKIE_SECURE` is `false` in local HTTP development; set it to `true` behind HTTPS in production.
- `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` are required for `bun run db:seed`.
- Replace the placeholder admin password before running the seed command; the seed script rejects placeholder or short passwords.
