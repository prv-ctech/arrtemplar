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

Development runs two hot-reloading servers together:

- Backend: Bun runs Elysia with `bun --hot` on `http://localhost:3000`.
- Frontend: Vite is launched through Bun with `bunx --bun vite` on `http://localhost:5173`.
- Frontend API calls use the browser's current origin by default, and Vite proxies `/health` and `/api` to the backend.
- TypeScript runs in watch mode alongside both servers, so backend/frontend contract changes are reported even though Vite intentionally only transpiles during development.

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

- `DATABASE_URL` defaults to `data/arrweeb-anime.sqlite`.
- `BACKEND_ORIGIN` is the backend target Vite proxies to during development.
- `VITE_API_BASE_URL` is blank by default so the frontend uses the Vite dev proxy; set it only when serving the frontend separately from the API.
- `USE_POLLING=true` enables polling file watchers for environments where native file watching is unreliable.
- `SESSION_COOKIE_SECURE` is `false` in local HTTP development; set it to `true` behind HTTPS in production.
- `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` are required for `bun run db:seed`.
- Replace the placeholder admin password before running the seed command; the seed script rejects placeholder or short passwords.
