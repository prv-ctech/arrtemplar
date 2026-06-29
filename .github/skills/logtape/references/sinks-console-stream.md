# Rule: sinks-console-stream (LogTape)

> Source: <https://logtape.org/manual/sinks>.

A sink is `(record: LogRecord) => void` — the destination of a log record.
LogTape's core ships console and stream sinks; more live in `@logtape/file` and
other packages.

```typescript
import { configure } from "@logtape/logtape";

await configure({
  sinks: {
    console(record) { console.log(record.message); }, // hand-rolled example
  },
});
```

## Console sink — `getConsoleSink()`

Writes to the console using the level-appropriate `console.*` method. Accepts a
`formatter` (`ConsoleFormatter = (record) => readonly unknown[]` — the returned
array is spread into the console call) and a `nonBlocking` option.

```typescript
import { configure, getConsoleSink, type LogRecord } from "@logtape/logtape";

await configure({
  sinks: {
    console: getConsoleSink({
      formatter(record: LogRecord): readonly unknown[] {
        let msg = "";
        const values: unknown[] = [];
        for (let i = 0; i < record.message.length; i++) {
          if (i % 2 === 0) msg += record.message[i];
          else { msg += "%o"; values.push(record.message[i]); }
        }
        return [
          `${record.level.toUpperCase()} %c${record.category.join("\xb7")} %c${msg}`,
          "color: gray;",
          "color: default;",
          ...values,
        ];
      },
    }),
  },
});
```

> CSS styles (`color: red;`, `font-weight: bold;`) in the 2nd/3rd array args
> work in browsers and Deno; ignored in Node.js/Bun.

This repo uses the ANSI color formatter:

```typescript
getConsoleSink({ formatter: getAnsiColorFormatter({ timestamp: "date-time-tz" }) });
```

## Stream sink — `getStreamSink()`

Writes to a Web `WritableStream`. In Node.js/Bun, convert a Node stream with
`Writable.toWeb()` (you cannot pass `process.stderr` directly):

```typescript
import { Writable } from "node:stream";
import { configure, getStreamSink } from "@logtape/logtape";

await configure({
  sinks: { stream: getStreamSink(Writable.toWeb(process.stderr)) },
});
```

> The stream sink requires **async disposal**, so it works only with
> `configure()`, not `configureSync()`.

## Non-blocking mode (since 1.0.0)

For high-throughput/production, both sinks accept `nonBlocking` to buffer and
flush in the background, avoiding main-thread stalls:

```typescript
// simple toggle
getConsoleSink({ nonBlocking: true });

// tuned
getConsoleSink({ nonBlocking: { bufferSize: 1000, flushInterval: 50 } });
getStreamSink(stream, { nonBlocking: { bufferSize: 500, flushInterval: 100 } });
```

Behavior:

- **Disposal** — console = `Disposable`, stream = `AsyncDisposable`; auto-flushed on reset/exit. On Cloudflare Workers, dispose explicitly.
- **Error handling** — background-flush errors are silently ignored (keep the destination reliable).
- **Buffer-overflow protection** — when the buffer exceeds **2×** `bufferSize`, the oldest records are dropped.
- **Latency** — visibility may lag by up to `flushInterval`.

Best for high-throughput apps tolerating slight delays / occasional loss. Avoid
when you need immediate visibility (debugging) or strict memory/delivery guarantees.

## Text formatter

Both sinks render plain text by default; supply a `TextFormatter` (see
`core-formatters.md`) to colorize/JSON-ify output.

```typescript
import { ansiColorFormatter, getConsoleSink } from "@logtape/logtape";

getConsoleSink({ formatter: ansiColorFormatter });
```
