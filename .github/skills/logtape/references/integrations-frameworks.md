# Rule: integrations-frameworks (LogTape)

> Source: <https://logtape.org/manual/integrations>.

LogTape integrates with popular web frameworks for unified request logging. The
HTTP integrations (Express, Fastify, Hono, Koa) share a common options shape:
`category`, `level`, `format`, `skip`, request-logging timing (`immediate`/
`logRequest`), and `context` for per-request correlation. Install each with
`bun add`. This repo uses Elysia natively (see `integrations-elysia.md`); these
are documented for completeness and for libraries you may consume.

## Shared options (Express/Hono/Koa)

- **`category`** — default `["express"]` / `["hono"]` / `["koa"]`.
- **`level`** — default `"info"`.
- **`format`** — default `"combined"`; structured + Morgan-compatible presets (see below).
- **`skip(req/res|ctx)`** — suppress the request log.
- **`immediate` / `logRequest`** — default `false` (log after response).
- **`context`** — `true` or `RequestContextOptions` for request-scoped `requestId`.

## Express — `@logtape/express`

```bash
bun add @logtape/express
```

```typescript
import { expressLogger } from "@logtape/express";
app.use(expressLogger());

// custom:
app.use(expressLogger({
  category: ["myapp", "http"],
  level: "debug",
  format: "dev",
  skip: (req, res) => res.statusCode < 400,
  immediate: false,
  context: true,
}));
```

## Fastify — `@logtape/fastify` (Pino-compatible)

```bash
bun add @logtape/fastify
```

Provides `getLogTapeFastifyLogger()` as a Pino-compatible `loggerInstance`.
Fastify auto-creates child loggers with request bindings (e.g. `reqId`), passed
through as structured properties. Supports all Pino signatures:

```typescript
import { getLogTapeFastifyLogger } from "@logtape/fastify";
import Fastify from "fastify";

const fastify = Fastify({ loggerInstance: getLogTapeFastifyLogger() });
fastify.get("/users/:id", async (request) => {
  request.log.info({ userId: request.params }, "Fetching user"); // reqId + bindings included
  return { user: "data" };
});

// Pino-style calls all work:
// logger.info("Hello world");
// logger.info("User %s logged in %d times", "alice", 3);
// logger.info({ userId: 123, action: "login" }, "User logged in");
// logger.info({ msg: "User logged in", userId: 123 });
// logger.info({ data: { key: "value" } });
```

## Hono — `@logtape/hono`

```bash
bun add @logtape/hono
```

```typescript
import { Hono } from "hono";
import { honoLogger } from "@logtape/hono";

const app = new Hono();
app.use(honoLogger());
app.get("/", (c) => c.json({ hello: "world" }));
export default app; // Deno, Node, Bun, Cloudflare Workers, ...
```

## Koa — `@logtape/koa`

```bash
bun add @logtape/koa
```

```typescript
import Koa from "koa";
import { koaLogger } from "@logtape/koa";
const app = new Koa();
app.use(koaLogger());
app.use((ctx) => { ctx.body = { hello: "world" }; });
app.listen(3000);
```

> Behind a reverse proxy, set `app.proxy = true` so `remoteAddr` reflects the
> client IP from `X-Forwarded-For`.

## Predefined formats (Express/Hono/Koa)

Structured: `"structured-combined"` (default), `"structured-common"` (no
`referrer`/`userAgent`); `"combined"`/`"common"` are deprecated aliases.
Morgan-compatible text: `"morgan-combined"`, `"morgan-common"`, `"dev"`,
`"short"`, `"tiny"`.

## Request context (`context: true`)

All HTTP integrations establish an implicit `requestId` context per request
when `context: true` is set (read `x-request-id`, generate if missing, echo on
response, add `requestId` to records). App logs inside handlers inherit the ID
only if `contextLocalStorage` is configured. Customize via:

```typescript
expressLogger({
  context: {
    requestId: { headerNames: ["x-correlation-id", "x-request-id"], responseHeader: "x-request-id" },
    include: ["requestId", "method", "url", "httpVersion"],
    enrich: (req) => ({ route: req.path }),
  },
});
```

The context is established **even when `skip` suppresses the request log**.

## Custom format function

Return a string or a structured object:

```typescript
expressLogger({ format: (req, res, responseTime) => ({ method: req.method, path: req.path, status: res.statusCode, duration: responseTime }) });
```

## SvelteKit (no dedicated adapter)

Use server hooks with `withContext()`:

```typescript
// src/hooks.server.ts
import { configure, getLogger, withContext } from "@logtape/logtape";
import { AsyncLocalStorage } from "node:async_hooks";

await configure({ sinks: { console: getConsoleSink() }, loggers: [{ category: ["sveltekit"], sinks: ["console"], lowestLevel: "info" }], contextLocalStorage: new AsyncLocalStorage() });

const logger = getLogger(["sveltekit"]);

export const handle = async ({ event, resolve }) => {
  const requestId = crypto.randomUUID();
  return await withContext({ requestId, method: event.request.method, url: event.url.pathname }, async () => {
    logger.info("Request started", { requestId });
    const response = await resolve(event);
    logger.info("Request completed", { status: response.status, requestId });
    return response;
  });
};
```

## Third-party log integration — `Logger.emit()` (since 1.1.0)

Forward external-system logs with their original timestamp/metadata:

```typescript
const logger = getLogger(["my-app", "external"]);
logger.emit({
  timestamp: externalLog.timestamp,
  level: "info",
  message: ["External system event"],
  rawMessage: "External system event",
  properties: { source: "external-service", eventId: externalLog.id },
});
```

## Best practices

- Always generate/use request IDs to correlate logs (`crypto.randomUUID()`).
- Use `withContext()` for request-scoped metadata.
- Log errors with the Error object + request context.
- Log duration/sizes for performance monitoring.
- Don't log secrets — use `@logtape/redaction`.
- Differentiate dev vs prod configs.
