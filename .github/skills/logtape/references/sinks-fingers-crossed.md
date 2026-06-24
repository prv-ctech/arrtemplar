# Rule: sinks-fingers-crossed (LogTape)

> Source: <https://logtape.org/manual/sinks#fingers-crossed-sink>.

`fingersCrossed()` (since 1.1.0) buffers low-level logs in memory and only
flushes them when a significant event (e.g. `error`) occurs — less noise in
normal operation, full context when something breaks.

## Basic usage

Wrap an existing sink. By default, `debug`/`info`/`warning` buffer; an `error`
or higher flushes the buffer plus the error, then subsequent logs pass through
until the next trigger:

```typescript
import { configure, fingersCrossed, getConsoleSink } from "@logtape/logtape";

await configure({
  sinks: { console: fingersCrossed(getConsoleSink()) },
  loggers: [{ category: [], sinks: ["console"], lowestLevel: "debug" }],
});
```

## Customizing the trigger

```typescript
fingersCrossed(getConsoleSink(), {
  triggerLevel: "warning", // flush on warning or higher
  maxBufferSize: 500,      // keep last 500 records per buffer
});
```

## Custom buffer level (since 2.0.0)

Decide which levels buffer vs pass through immediately:

```typescript
fingersCrossed(getConsoleSink(), {
  bufferLevel: "debug",    // only trace + debug buffer
  triggerLevel: "warning", // warning/error/fatal flush
});
// info passes through immediately; trace/debug buffered
```

## Category isolation

Prevent one component's errors from flushing unrelated components' buffers:

```typescript
fingersCrossed(getConsoleSink(), { isolateByCategory: "descendant" });
```

Modes: `"descendant"` (parent error flushes child buffers), `"ancestor"` (child
error flushes parent buffer), `"both"`, or a custom
`(triggerCategory, bufferedCategory) => boolean`.

## Context isolation (since 1.2.0)

With implicit contexts (requires `contextLocalStorage`), isolate buffers per
context value — e.g. per `requestId`:

```typescript
fingersCrossed(getConsoleSink(), {
  isolateByContext: { keys: ["requestId", "sessionId"] },
});
```

Combine with category isolation; both must match to flush.

## Buffer management (memory bounds)

- **Per-buffer size** — `maxBufferSize` (oldest dropped when exceeded).
- **TTL cleanup** (context-isolated, since 1.2.0) — `bufferTtlMs` + `cleanupIntervalMs` remove stale context buffers.
- **LRU eviction** (since 1.2.0) — `maxContexts` caps the number of context buffers.
- **Hybrid** — stack all three for predictable memory under high traffic:

```typescript
fingersCrossed(getConsoleSink(), {
  isolateByContext: {
    keys: ["requestId", "sessionId"],
    maxContexts: 200,           // LRU
    bufferTtlMs: 600000,        // TTL 10 min
    cleanupIntervalMs: 120000,  // sweep every 2 min
  },
  maxBufferSize: 500,           // per-buffer cap
});
```

## Use cases & performance

Best for production debugging, error investigation, and log-volume management.
Watch: memory scales with buffer size and (under context isolation) unique
context combinations; frequent triggers reduce buffering value; TTL sweeps add
CPU cost. Use a single buffer when isolation isn't needed.
