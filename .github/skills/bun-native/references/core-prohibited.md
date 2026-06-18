# Rule: core-prohibited

## Rationale

Using generic Node.js utility layers where Bun already gives this repo a better primitive adds overhead and inconsistency. At the same time, not every lower-level Bun API belongs in this app, so the prohibitions are repo-specific.

## Prohibited Actions

- **NO `node:fs` or `fs/promises` in server/tooling code** when `Bun.file()` or `Bun.write()` handles the job.
- **NO `child_process` in server/tooling code**. Use `Bun.spawn()` or Bun Shell.
- **NO External Managers**: Never use `npm`, `yarn`, or `pnpm`. Use `bun`.
- **NO ad-hoc env access in server/runtime code**: Do NOT use `process.env`. Use `Bun.env`. Tests may still mutate `process.env` when needed for setup.
- **NO generic UUID or wait helpers in backend code**: Prefer `Bun.randomUUIDv7()` and `await Bun.sleep(ms)` where they fit.
- **NO `bun:sqlite` or `Bun.sql` for the app's primary database**. This repo is standardized on PostgreSQL + Drizzle.
- **NO `Bun.serve()` in app runtime code**. Keep Elysia as the repo's server abstraction. Test probes and narrow low-level experiments are separate cases.
- **NO Bun WebSocket server in app runtime code**. Elysia handles all WebSocket routes. Use the WebSocket client (`new WebSocket()`) for outbound connections only.
- **NO Bun APIs in Browser Code**: Do NOT use `Bun.*` or `bun:*` modules inside `src/app/`. Use standard Web APIs (e.g., `setTimeout`, `fetch`) for frontend compatibility.
- **NO `bun:sqlite` or `Bun.SQL` for the app's primary database**. This repo is standardized on PostgreSQL + Drizzle. These are for tooling/testing only.
- **NO automatic rewrites of `path` utilities**: `node:path` is not banned by default. Use `URL`, `import.meta.url`, and `Bun.fileURLToPath()` when they clearly improve module-relative path handling; otherwise, `path.join()` or `path.resolve()` can remain the clearer choice.

## Examples

### Incorrect

```typescript
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

process.env.API_KEY;
await new Promise((resolve) => setTimeout(resolve, 1000));
await bcrypt.hash(password, 10);
const db = new Database("app.db");
```

### Correct

```typescript
const file = Bun.file("config.json");
const proc = Bun.spawn(["bun", "run", "build"]);

const apiKey = Bun.env.API_KEY;
await Bun.sleep(1000);
await Bun.password.hash(password);
```
