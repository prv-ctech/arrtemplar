# Rule: core-contexts (LogTape)

> Source: <https://logtape.org/manual/contexts>.

Contexts attach reusable properties to log records. LogTape has three kinds:
**explicit** (`.with()`), **lazy** (`lazy()` values in `.with()`), and
**implicit** (`withContext()` via context-local storage).

## Explicit contexts (since 0.5.0)

`logger.with(props)` returns a new logger that always includes `props`. Context
is inherited by child loggers.

```typescript
const logger = getLogger(["my-app", "my-module"]);
const ctx = logger.with({ userId: 1234, requestId: "abc" });

ctx.info`This record includes userId & requestId.`;
ctx.warn("Template can reference them: {userId}, {requestId}.");

// inherited by children:
const parentCtx = getLogger(["my-app"]).with({ userId: 1234, requestId: "abc" });
const childCtx = parentCtx.getChild(["my-module"]);
childCtx.debug("Inherits context: {userId} {requestId}.");
```

## Lazy contexts (since 2.0.0)

`.with()` captures values at call time. To re-evaluate at **logging time**, wrap
with `lazy()`:

```typescript
import { getLogger, lazy } from "@logtape/logtape";

let currentUser: string | null = null;
const logger = getLogger(["my-app"]).with({ user: lazy(() => currentUser) });

logger.info("Action");   // user: null
currentUser = "alice";
logger.info("Action");   // user: "alice"
```

Lazy properties are inherited by child loggers and re-evaluated on each emit.
Mix lazy and regular properties freely. See `core-lazy.md`.

## Implicit contexts (since 0.7.0)

Implicit contexts are like environment variables for the call stack: set once,
they apply to **every** log record in a subroutine and all its
subroutines/async continuations. Ideal for tracing a request or session across
modules.

### Settings (require context-local storage)

Implicit contexts need a `contextLocalStorage`. In Node.js/Deno/Bun use
`AsyncLocalStorage` from `node:async_hooks`:

```typescript
import { AsyncLocalStorage } from "node:async_hooks";
import { configure } from "@logtape/logtape";

await configure({ /* … */, contextLocalStorage: new AsyncLocalStorage() });
```

> Without `contextLocalStorage`, `withContext()` no-ops and `getLogger()` won't
> inherit the implicit context; a warning is logged to `["logtape", "meta"]`.
> Browsers do not support context-local states yet. (This repo sets it in
> `configureServerLogging()`.)

### Basic usage

```typescript
import { getLogger, withContext } from "@logtape/logtape";

function functionA() {
  getLogger("a").info("Has implicit context: {requestId}.");
}

function handleRequest(requestId: string) {
  withContext({ requestId }, () => functionA());
}
```

Even with interleaved async operations, implicit contexts are correctly
inherited — they are more than a global variable.

### Nesting

```typescript
withContext({ requestId, signed: false }, () => {
  functionB();                       // sees requestId, signed=false
  withContext({ userId, signed: true }, () => {
    functionA();                     // sees requestId, userId, signed=true (overridden)
  });
});
```

### HTTP request contexts

The Express, Elysia, Hono, and Koa integrations establish an implicit
`requestId` context per request when you set `context: true`. They read the
`x-request-id` header (generate one if absent), echo it on the response, and add
`requestId` to records. The context is established **even when `skip` suppresses
the request log**, so app logs inside a skipped request stay correlated. See
`integrations-elysia.md`.

Customize via the `context` object (`headerNames`, `responseHeader`, `include`,
`enrich`). Requires `contextLocalStorage`.

## Priorities

When the same key is set at multiple layers, the winner is (most specific → least):

1. **Per-call property** (`logger.info("…", { baz: 6 })`)
2. **Explicit context** (`logger.with({ baz: 5 })`)
3. **Implicit context** (`withContext({ baz: 1 })`) — innermost wins

```typescript
withContext({ foo: 1, bar: 2, baz: 3 }, () => {
  const context = getLogger("my-app").with({ bar: 4, baz: 5 });
  context.info("context: {foo}, {bar}, {baz}", { baz: 6 });
  // → "context: 1, 4, 6."
});
```
