# Rule: net-elysia

## Rationale

Elysia already gives this repo the right HTTP abstraction on top of Bun. Bun-native guidance should strengthen the code that sits under Elysia, not replace the framework.

## Guidelines

- **MANDATORY**: Use **ElysiaJS** for all API routes and server logic.
- **FRAMEWORK BOUNDARY**: Do not replace the app server with `Bun.serve()`. This includes HTTP routes, WebSocket server routes, and static file serving. Elysia handles ALL of this.
- **WEBSOCKET BOUNDARY**: Do not use `Bun.serve({ websocket })` for app WebSocket routes. Elysia handles all WebSocket server concerns. Only use the WebSocket client (`new WebSocket()`) for outbound connections.
- **SCHEDULING BOUNDARY**: Prefer `@elysiajs/cron` for app-owned recurring jobs. `Bun.cron()` now has an in-process callback variant (`Bun.cron(schedule, callback)`) with `Disposable` support (`using job = Bun.cron(...)`), `ref`/`unref`, `--hot` safety, no-overlap execution, and UTC scheduling — use it only for standalone machine-level jobs that intentionally live outside the API runtime.
- **SECURITY**: Keep using `elysiajs-helmet`, `cors`, JWT, and bearer plugins in the server stack.
- **STATIC AND FILE RESPONSES**: Use `Bun.file()` or file-backed `Response` objects inside Elysia handlers where appropriate.
- **COMPRESSION AND TIMING**: Bun-native helpers such as `Bun.gzipSync()` and `Bun.nanoseconds()` belong underneath Elysia plugins and middleware.
- **FETCH AND WEB APIS**: Prefer standard `fetch`, `Response`, `URL`, and `Headers` APIs in route and integration code before reaching for Node-style HTTP modules.
- **HTTP PROXY**: Bun now reuses CONNECT tunnels for HTTPS-through-proxy requests — automatic, no code changes needed.
- **UNIX SOCKETS**: Bun now matches Node.js semantics for unix domain sockets (`EADDRINUSE` on existing file, auto-cleanup on close). Applies to `Bun.listen`, `Bun.serve`, and `net.Server`.
- **TCP_DEFER_ACCEPT**: `Bun.serve()` on Linux now defers accept until client data arrives (automatic). Does not affect Elysia policy.

## Examples

### Correct (Elysia Server)

```typescript
import { Elysia } from "elysia";

const app = new Elysia()
  .get("/", () => ({ status: "ok" }))
  .listen(Number(Bun.env.PORT ?? 3000));
```
