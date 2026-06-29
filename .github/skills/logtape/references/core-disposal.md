# Rule: core-disposal (LogTape)

> Source: <https://logtape.org/manual/sinks#explicit-disposal>.

Sinks and filters that hold resources (file handles, network connections,
buffers) can implement the ECMAScript Explicit Resource Management interfaces so
LogTape cleans them up on `reset()` / `resetSync()` or application exit.

## Disposable sink

A `Sink & Disposable` defines `[Symbol.dispose]`:

```typescript
import { type Sink, type LogRecord } from "@logtape/logtape";

const disposableSink: Sink & Disposable = (record: LogRecord) => {
  console.log(record.message);
};
disposableSink[Symbol.dispose] = () => {
  console.log("Disposed!");
};
```

## AsyncDisposable sink

A `Sink & AsyncDisposable` defines `[Symbol.asyncDispose]`:

```typescript
const asyncDisposableSink: Sink & AsyncDisposable = (record: LogRecord) => {
  console.log(record.message);
};
asyncDisposableSink[Symbol.asyncDispose] = async () => {
  console.log("Disposed!");
};
```

> Async-disposable sinks (e.g. stream sinks, `fromAsyncSink()`, non-blocking
> stream sinks) **cannot** be used with `configureSync()` — they require
> `configure()`. See `core-config.md`.

## Non-blocking sinks auto-dispose

The non-blocking console/stream/file sinks implement `Disposable` (console) or
`AsyncDisposable` (stream/file) to flush buffered logs on cleanup. They are
usually disposed automatically, but on some platforms (e.g. Cloudflare Workers)
you may need to dispose explicitly.

## Explicit disposal — `dispose()`

Call `dispose()` to flush sinks without blocking a response (e.g. edge
functions). With Cloudflare Workers `ctx.waitUntil()`:

```typescript
import { configure, dispose } from "@logtape/logtape";

export default {
  async fetch(request, env, ctx) {
    await configure({ /* ... */ });
    ctx.waitUntil(dispose());
    return new Response("...");
  },
} satisfies ExportedHandler;
```

> Async sinks created with `fromAsyncSink()` should be disposed so pending
> operations complete; errors inside async sinks are caught to avoid breaking the
> promise chain (handle errors inside the sink if needed).

## Pairs to remember

- `configure()` / `reset()` / `dispose()` — async lifecycle.
- `configureSync()` / `resetSync()` — sync lifecycle (sync-disposable sinks only).
- Never mix the two lifecycles.
