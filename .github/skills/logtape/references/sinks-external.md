# Rule: sinks-external (LogTape)

> Sources: <https://logtape.org/sinks/otel>, <https://logtape.org/sinks/sentry>,
> <https://logtape.org/sinks/syslog>, <https://logtape.org/sinks/cloudwatch-logs>,
> <https://logtape.org/sinks/windows-eventlog>.

Beyond the built-in console/stream sinks, LogTape ships official sink packages
for cloud and ops destinations. Each returns a `Sink` you register by name in
`configure({ sinks })`. Install with `bun add` (not `npm`).

## OpenTelemetry — `@logtape/otel`

Forwards LogTape records as OTel logs (so they flow into OTLP collectors,
Jaeger, Honeycomb, Grafana, etc.). Keeps structured properties intact.

```bash
bun add @logtape/otel
```

Best paired with the Drizzle/HTTP integrations whose structured fields (`query`,
`params`, `method`, `status`, `responseTime`) become OTel attributes.

## Sentry — `@logtape/sentry`

Forwards records to Sentry. `error`/`fatal` records become Sentry events
(capturing the `{ error }` object and its stack when present).

```bash
bun add @logtape/sentry
```

> To get stack traces into Sentry, log errors with the Error-object overload
> (`logger.error(err)` or include `{error}` in the template) — see `core-levels.md`.

## Syslog — `@logtape/syslog`

Sends records to a syslog server (RFC 3164/5424). Configurable facility,
severity mapping, and transport (UDP/TCP/local socket).

```bash
bun add @logtape/syslog
```

## AWS CloudWatch Logs — `@logtape/cloudwatch-logs`

Pushes records to a CloudWatch Logs log group/stream. Requires AWS credentials
in the environment.

```bash
bun add @logtape/cloudwatch-logs
```

> This sink writes to AWS — use async disposal (`configure()`, not
> `configureSync()`) and `await dispose()` on shutdown so the batch flushes.

## Windows Event Log — `@logtape/windows-eventlog`

Writes to the Windows Event Log (Windows only). Map LogTape categories/levels
to event source and event types.

```bash
bun add @logtape/windows-eventlog
```

## Wiring pattern

```typescript
import { configure, getConsoleSink } from "@logtape/logtape";
import { getOTelSink } from "@logtape/otel"; // example

await configure({
  sinks: {
    console: getConsoleSink(),
    otel: getOTelSink({ /* OTLP exporter options */ }),
  },
  loggers: [
    { category: ["logtape", "meta"], sinks: ["console"] },
    { category: ["app"], sinks: ["console", "otel"], lowestLevel: "info" },
  ],
});
```

## Notes

- These sinks are **server-side**; none run in the browser.
- Prefer the JSON Lines formatter (`getJsonLinesFormatter()`) or OTel for
  structured data; the ANSI/text formatters are for human-readable console/file.
- Always give the meta logger its own sink so transport failures stay visible.
