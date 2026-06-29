# Rule: integrations-elysia (`@logtape/elysia`)

> Sources: <https://logtape.org/manual/integrations#elysia>, <https://jsr.io/@logtape/elysia/doc>.

**This is the repo's HTTP request-logging layer.** `@logtape/elysia` provides an
Elysia plugin (`elysiaLogger()`) that logs every request through LogTape.
Elysia is Bun-first and end-to-end type-safe.

```bash
bun add @logtape/elysia   # already a server dep (^2.1.4)
```

## Basic usage

```typescript
import { Elysia } from "elysia";
import { configure, getConsoleSink } from "@logtape/logtape";
import { elysiaLogger } from "@logtape/elysia";

await configure({
  sinks: { console: getConsoleSink() },
  loggers: [{ category: ["elysia"], sinks: ["console"], lowestLevel: "info" }],
});

const app = new Elysia()
  .use(elysiaLogger())
  .get("/", () => ({ hello: "world" }))
  .listen(3000);
```

## Options

- **`category`** — default `["elysia"]`.
- **`level`** — default `"info"`.
- **`format`** — default `"combined"`; see predefined formats below.
- **`skip(ctx)`** — skip matching requests.
- **`logRequest`** — default `false` (log after response).
- **`scope`** — `"global"` (default) | `"scoped"` | `"local"`.
- **`context`** — `true` or a `RequestContextOptions` for request-scoped correlation.

## This repo's usage (`apps/server/src/app.ts`)

The repo logs HTTP requests under `["app", "http"]`, at `info`, **after** the
response (`logRequest: false`), with **global** scope, **skipping `/health`**,
and a **custom structured format**:

```typescript
import { elysiaLogger } from "@logtape/elysia";
import { APP_LOG_CATEGORY } from "@arrtemplar/shared";

elysiaLogger({
  category: [APP_LOG_CATEGORY, "http"],
  level: "info",
  logRequest: false,
  scope: "global",
  skip: ({ path }) => path === "/health",
  format: (context, responseTime) => ({
    method: context.request.method,
    url: context.path,
    path: context.path,
    status: normalizeStatusCode(context.set.status, readResponseValue(context)),
    responseTime,
    contentLength: context.set.headers["content-length"],
  }),
});
```

These records are captured by the `["app"]` logger (parent of `["app","http"]`)
and routed to the redacted file/console sinks.

## Request context (per-request `requestId`)

Set `context: true` to read `x-request-id` (generate one if missing), echo it on
the response, and add `requestId` to request/error records. For app logs inside
handlers to **inherit** the same `requestId`, configure `contextLocalStorage`
(see `core-contexts.md` — the repo sets it in `configureServerLogging()`):

```typescript
import { AsyncLocalStorage } from "node:async_hooks";
import { configure } from "@logtape/logtape";
import { elysiaLogger } from "@logtape/elysia";

await configure({ sinks: {}, loggers: [], contextLocalStorage: new AsyncLocalStorage() });

const plugin = elysiaLogger({ context: true });
```

The context is established **even when `skip` suppresses the request log**, so
handler logs inside a skipped request still carry the same ID. Customize:

```typescript
elysiaLogger({
  context: {
    requestId: { headerNames: ["x-correlation-id", "x-request-id"], responseHeader: "x-request-id" },
    include: ["requestId", "method", "path", "userAgent"],
    enrich: (ctx) => ({ route: ctx.path }),
  },
});
```

## Plugin scope

- `"global"` — hooks apply to all routes (default).
- `"scoped"` — hooks apply to the parent instance where the plugin is used.
- `"local"` — hooks apply only within the plugin itself.

## Predefined formats

Structured presets: `"structured-combined"` (default), `"structured-common"`
(no `referrer`/`userAgent`), `"combined"`/`"common"` (deprecated aliases).
Text presets (Morgan-compatible): `"morgan-combined"`, `"morgan-common"`,
`"dev"` (`GET /path 200 1.234 ms - 123`), `"short"`, `"tiny"`.

> Elysia doesn't expose socket-level fields consistently across runtimes; the
> Morgan text formats use `X-Forwarded-For` for the remote address and render
> unavailable fields (e.g. HTTP version) as `-`.

## Error logging

The plugin auto-logs errors at the `error` level via Elysia's `onError` hook,
including the error message and code alongside standard request properties.

## Structured output (`structured-combined`)

`method`, `url`, `path`, `status`, `responseTime`, `contentLength`, `remoteAddr`
(from `X-Forwarded-For`), `userAgent`, `referrer`.

## Custom format function

Return either a string or a structured object:

```typescript
elysiaLogger({
  format: (ctx, responseTime) => ({
    method: ctx.request.method,
    path: ctx.path,
    status: ctx.set.status,
    duration: responseTime,
  }),
});
```
