# Rule: rt-workers

## Rationale

Bun's `Worker` API (Web Workers with Bun extensions) provides multithreading for CPU-intensive work, parallel processing, and isolating heavy computations from the main event loop.

## API

### Creating a Worker

```typescript
const worker = new Worker("./worker.ts", {
  preload: ["./load-sentry.js"],
  smol: true,
  ref: false,
});

worker.postMessage("hello");
worker.onmessage = (event) => console.log(event.data);
```

### Worker Thread

```typescript
declare var self: Worker;
self.onmessage = (event: MessageEvent) => {
  console.log(event.data);
  postMessage("world");
};
```

- No `{ type: "module" }` needed — ESM, CJS, TypeScript, JSX all supported natively

### Options

| Option | Type | Description |
|--------|------|-------------|
| `preload` | `string \| string[]` | Preload modules before worker script |
| `smol` | `boolean` | Reduce memory (sets JSC heap to Small) |
| `ref` | `boolean` | Keep process alive (default: true) |

### Events

- `"open"` — Worker ready (Bun-specific). Messages auto-enqueue until ready.
- `"close"` — Worker terminated. `CloseEvent` contains exit code.
- `"message"` — Standard message event.

### Lifecycle

```typescript
worker.terminate();
worker.unref();
worker.ref();
```

- Worker auto-terminates when event loop has no work
- `process.exit()` in worker terminates only the worker

### Environment Data

```typescript
import { setEnvironmentData, getEnvironmentData } from "worker_threads";

setEnvironmentData("config", { apiUrl: "https://api.example.com" });

const config = getEnvironmentData("config");
```

### `Bun.isMainThread`

```typescript
if (Bun.isMainThread) { /* main thread */ } else { /* worker */ }
```

## Performance

- **String fast path**: Pure strings bypass structured clone entirely
- **Simple object fast path**: Plain objects with only primitives use optimized serialization
- Bun's `postMessage` is **2-241x faster** than Node.js for these cases

## Blob URL Workers

```typescript
const blob = new Blob([`self.onmessage = e => postMessage(e.data)`], {
  type: "application/typescript",
});
const worker = new Worker(URL.createObjectURL(blob));
```

## Guidelines

- **USE WORKERS**: For CPU-intensive work, parallel processing, and isolating heavy computations
- **PRELOAD**: Use `preload` for shared setup (sentry, tracing, etc.)
- **SMOL**: Use `smol: true` for lightweight workers that don't need much memory
- **ENVIRONMENT DATA**: Use `setEnvironmentData`/`getEnvironmentData` for initial config instead of `postMessage`
- **DISPOSABLES**: Use `using` / `await using` for resource cleanup in worker code

## Bugfixes (1.3.13)

- Worker lifecycle crashes (terminate, messaging, natural exit) fixed
- `BroadcastChannel` data races with workers fixed
- Root certificate initialization race with workers fixed
