# Rule: sinks-file (`@logtape/file`)

> Source: <https://logtape.org/sinks/file>.

File sinks are **unavailable in the browser**. Install the package:

```bash
bun add @logtape/file
```

> On Deno you need `--allow-write` and `--unstable-fs`. On Bun/Node, no special flags.

## Standard file sink — `getFileSink()`

Full control over buffering, plus blocking/non-blocking modes:

```typescript
import { getFileSink } from "@logtape/file";
import { configure } from "@logtape/logtape";

await configure({
  sinks: {
    file: getFileSink("my-app.log", {
      lazy: true,
      bufferSize: 8192,    // chars (default)
      flushInterval: 5000, // ms (default); 0 disables time-based flush
      nonBlocking: true,
    }),
  },
});
```

- `bufferSize: 0` disables buffering for immediate writes.
- `nonBlocking: true` makes flushes async; the sink becomes `Sink & AsyncDisposable` (errors during background flush are swallowed).

## High-performance stream file sink — `getStreamFileSink()` (since 1.0.0)

Uses Node.js `PassThrough` streams for high-volume logging. Non-blocking,
backpressure-aware, minimal config:

```typescript
import { getStreamFileSink } from "@logtape/file";
import { configure } from "@logtape/logtape";

await configure({
  sinks: { file: getStreamFileSink("my-app.log", { highWaterMark: 32768 }) }, // 32 KB
});
```

Use it for production high-volume logging where you don't need fine-grained
buffer tuning. For lazy loading / custom flush intervals / non-blocking toggles,
use `getFileSink()` instead.

## Size-based rotating file sink — `getRotatingFileSink()`

Rotates when the current file reaches `maxSize`, keeping up to `maxFiles` old
copies named with `.1`, `.2`, …. **This is what the repo uses** for `appFile`:

```typescript
import { getRotatingFileSink } from "@logtape/file";
import { configure } from "@logtape/logtape";

await configure({
  sinks: {
    file: getRotatingFileSink("my-app.log", {
      maxSize: 0x400 * 0x400, // 1 MiB
      maxFiles: 5,
    }),
  },
});
```

Supports the same `bufferSize` / `flushInterval` / `nonBlocking` options as the
standard file sink.

## Time-based rotating file sink — `getTimeRotatingFileSink()` (since 2.0.0)

Rotates by time interval; names files by the period. Takes a `{ directory,
interval, … }` options object:

```typescript
import { getTimeRotatingFileSink } from "@logtape/file";
import { configure } from "@logtape/logtape";

await configure({
  sinks: {
    file: getTimeRotatingFileSink({
      directory: "./logs",
      interval: "daily",        // "daily" (default) | "hourly" | "weekly"
      maxAgeMs: 60 * 24 * 60 * 60 * 1000, // delete files older than 60 days
      filename: (date: Date) => `app-${date.toISOString().slice(0, 10)}.txt`, // optional
    }),
  },
});
```

- `"daily"` → `YYYY-MM-DD.log`; `"hourly"` → `YYYY-MM-DD-HH.log`; `"weekly"` → `YYYY-WNN.log` (ISO week).
- `filename(date)` overrides the naming pattern.
- `maxAgeMs` enables automatic cleanup of old files.
- Same buffering/non-blocking options as the standard sink.

## This repo's file sink

`logging/config.ts` builds `appFile` from `getRotatingFileSink(logFilePath, {
maxSize, maxFiles, formatter })` where `maxSize`/`maxFiles` come from
`env.logFileMaxSizeBytes` / `env.logFileMaxFiles`, and the formatter is a
**redacted JSON Lines** formatter (`createRedactedTextFormatter(getJsonLinesFormatter({ categorySeparator: ".", message: "rendered", properties: "nest:properties" }))`).
Always keep the formatter wrapped through `createRedactedTextFormatter`.
