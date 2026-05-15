# AnimeHub

AnimeHub is a self-hosted anime-native media request, automation, and watching app.

This repository currently implements **Phase 0** from `docs/plan/arrweeb-anime.md`:

- Bun monorepo workspace
- Elysia backend with `GET /health`
- OpenAPI docs at `/openapi`
- React + Vite + TypeScript frontend
- Tailwind CSS v4 and shadcn/ui-compatible structure
- TanStack Query and TanStack Router frontend foundation
- Eden-based internal API client typing
- Shared TypeScript contracts
- Anime parser package skeleton

Later phases will add Drizzle + Bun SQLite migrations, auth, sessions, metadata imports, request workflows, search providers, download clients, jobs, and playback.

## Development

Install dependencies:

```sh
bun install
```

Start backend and frontend together:

```sh
bun run dev
```

Useful checks:

```sh
bun test
bun run typecheck
bun run build
bun run check
```

## Services

- Backend: `http://localhost:3000`
- Health: `http://localhost:3000/health`
- OpenAPI UI: `http://localhost:3000/openapi`
- Frontend: `http://localhost:5173`

## Environment

Copy `.env.example` to `.env` for local development. Phase 0 only needs non-secret local port/origin values.
