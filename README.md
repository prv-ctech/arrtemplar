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

Start backend and frontend together:

```sh
bun run dev
```

Development starts through a Bun-native lifecycle supervisor:

- Backend: Bun runs Elysia with `bun --hot` on `http://localhost:3000`.
- Frontend: Vite is launched through Bun with `bunx --bun vite` on `http://localhost:5173`.
- Tests that need a server port default to `3001`, separate from development port `3000`.
- Frontend API calls use the browser's current origin by default, and Vite proxies `/health` and `/api` to the backend.
- TypeScript runs in watch mode alongside both servers, so backend/frontend contract changes are reported even though Vite intentionally only transpiles during development.
- Before startup, the supervisor checks ports `3000` and `5173` and stops only stale repo-owned backend/frontend dev listeners from this workspace.
- If another process owns either port, startup fails with a diagnostic instead of killing it.
- Dev startup never deletes, resets, or migrates SQLite databases.

The previous raw parallel command remains available for debugging the supervisor itself:

```sh
bun run dev:raw
```

`portless` is intentionally not part of this dev workflow: there is no proxy, TLS/local CA setup, `portless.json`, or `portless prune` dependency.

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

- Backend: `http://localhost:3000`
- Health: `http://localhost:3000/health`
- OpenAPI UI: `http://localhost:3000/openapi`
- Frontend: `http://localhost:5173`

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
