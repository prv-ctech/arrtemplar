# Rule: core-preflight

## Rationale

Ensuring Bun-native compliance before making changes prevents accidental regressions into Node-style utility code and keeps Bun enhancements aligned with this repo's actual stack.

## Protocol

Before proposing or making any code changes, agents MUST:

1. **Classify the change first**:
	- `src/app/**` stays browser-native.
	- `src/**` outside `src/app/**`, `scripts/**`, `.github/scripts/**`, and `dev.ts` are Bun runtime or Bun tooling territory.
2. **Respect the repo boundaries**:
	- Keep Elysia as the HTTP layer.
	- Keep Drizzle + `postgres` as the primary database layer.
	- Keep Valkey integration on Bun's `RedisClient` where caching is needed.
3. **Run the right checks for TS/JS work**:
	- `bun run lint:check:tsjs`
	- `bun run verify` when touching server or tooling code
4. **Only introduce Bun-native changes when they remove a real extra layer**:
	- Good: replace `node:fs` reads with `Bun.file()`.
	- Bad: replace Elysia or Drizzle with lower-level Bun APIs just because they exist.

## Examples

### Incorrect

- Pushing a component to `src/app` that imports `Bun.file`.
- Replacing a Drizzle repository with `bun:sqlite` in an app that already uses PostgreSQL.
- Replacing Elysia routes with `Bun.serve()` in the main server.

### Correct

```typescript
// src/server/logs.ts - Server logic uses native Bun APIs where they fit
const file = Bun.file("./logs/app.jsonl");
await Bun.write("./logs/app.jsonl", "line\n", { append: true, createPath: true });

// src/server/index.ts - Keep Elysia as the HTTP layer
const app = new Elysia();

// src/db/client.ts - Keep Postgres + Drizzle as the database layer
const databaseUrl = Bun.env.DATABASE_URL ?? "";

// src/app/component.tsx - UI stays on standard Web APIs
const data = await fetch("/api/db");
```
