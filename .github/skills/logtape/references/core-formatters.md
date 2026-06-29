# Rule: core-formatters (LogTape)

> Source: <https://logtape.org/manual/formatters>.

A text formatter is `(record: LogRecord) => string`. The console, stream, file,
and rotating-file sinks all take a `formatter`. LogTape ships five built-in
formatters; `@logtape/pretty` adds a sixth.

```typescript
export type TextFormatter = (record: LogRecord) => string;
```

## Built-in formatters

### `defaultTextFormatter` / `getTextFormatter()`

Plain text. Default output:

```text
2023-11-14 22:13:20.000 +00:00 [INF] category·subcategory: Hello, world!
```

### `ansiColorFormatter` / `getAnsiColorFormatter()` (since 0.5.0)

Same shape, ANSI-colored (timestamp dim, level bold with per-level color,
category dim). This repo uses it for the console sink with
`{ timestamp: "date-time-tz" }`.

### `jsonLinesFormatter` / `getJsonLinesFormatter()` (since 0.11.0)

JSON Lines / NDJSON — the right choice for structured logging and this repo's
file sink. `Error`/`AggregateError` in properties serialize as plain objects so
`message`/`stack` survive.

```json
{"@timestamp":"2023-11-14T22:13:20.000Z","level":"INFO","message":"Hello, world!","logger":"my.logger","properties":{"key":"value"}}
```

### `logfmtFormatter` / `getLogfmtFormatter()` (since 2.1.0)

`time=… level=info logger=my.logger msg="Hello, world!" key=value`. Values with
whitespace/`=`/`"`/`\`/control chars are quoted; problematic keys are
percent-escaped as UTF-8 bytes (e.g. `user id` → `user%20id`).

### `prettyFormatter` / `getPrettyFormatter()` (`@logtape/pretty`, since 1.0.0)

Colorful dev-console output with icons, smart truncation, alignment, word wrap.
Inspired by Signale; needs true-color + Unicode support.

```bash
bun add @logtape/pretty
```

```typescript
import { getConsoleSink, configure } from "@logtape/logtape";
import { prettyFormatter } from "@logtape/pretty";

await configure({
  sinks: { console: getConsoleSink({ formatter: prettyFormatter }) },
  loggers: [{ category: [], sinks: ["console"], lowestLevel: "debug" }],
});
```

## Configuring the default text formatter

`getTextFormatter(options)` — customizable fields:

- **`timestamp`** — `"date-time-timezone"` (default), `"date-time-tz"`, `"date-time"`, `"time-timezone"`, `"time-tz"`, `"time"`, `"date"`, `"rfc3339"`, `"none"`/`"disabled"`, or a `(date) => string`.
- **`timeZone`** (since 2.1.0) — `undefined` (UTC, default), `null` (system local), IANA name (`"Asia/Seoul"`), or fixed offset (`"+09:00"`). Invalid throws `TypeError`.
- **`level`** — `"ABBR"` (default), `"FULL"`, `"L"`, `"abbr"`, `"full"`, `"l"`, or a `(level) => string`.
- **`category`** — separator string (default `"·"`) or `(category) => string`.
- **`value(value, inspect)`** — render embedded values; receives a cross-runtime `inspect` fallback (since 1.2.0).
- **`format(parts)`** — concatenate the formatted parts into the final line (no trailing newline).

```typescript
import { getTextFormatter } from "@logtape/logtape";

const formatter = getTextFormatter({
  timestamp: "date-time-timezone",
  timeZone: "Asia/Seoul",
  level: "ABBR",
  value(value, inspect) {
    return typeof value === "number" ? value.toFixed(2) : inspect(value);
  },
});
```

## Configuring the ANSI color formatter

`getAnsiColorFormatter(options)` shares `timestamp`/`timeZone`/`level`/`category`/`value`/`format`, plus:

- **`timestampStyle`** (`"dim"` default), **`timestampColor`**.
- **`levelStyle`** (`"bold"` default), **`levelColors`** — per-level colors; defaults: trace none, debug blue, info green, warning yellow, error red, fatal magenta.
- **`categoryStyle`** (`"dim"` default), **`categoryColor`**.

Text styles: `"bold" | "dim" | "italic" | "underline" | "strikethrough" | null`.
Colors: `"black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | null`.

## Configuring JSON Lines

`getJsonLinesFormatter(options)`:

- **`categorySeparator`** — default `"."` (or `(category) => string | string[]`).
- **`message`** — `"rendered"` (default) or `"template"`.
- **`properties`** — `"flatten"` | `"prepend:<prefix>"` | `"nest:<key>"` (default `"nest:properties"`).

## Configuring logfmt

`getLogfmtFormatter(options)`: `categorySeparator` (default `"."`), `message`
(`"rendered"` default), `properties` (`"flatten"` default | `"prepend:<prefix>"`),
`timeZone`, `lineEnding` (`"lf"` default | `"crlf"`).

## Configuring pretty (`@logtape/pretty`)

`getPrettyFormatter(options)`: `timestamp` (default `"none"`), `timeZone`,
`timestampColor`, `timestampStyle`, `icons` (`true`/`false`/object), `levelColors`,
`levelStyle` (default `"underline"`), `categorySeparator` (default `"·"`),
`categoryWidth` (default 20), `categoryTruncate` (`"middle"`/`"end"`/`false`),
`categoryColor`, `categoryColorMap` (`Map<[prefix], color>`), `categoryStyle`,
`messageColor`, `messageStyle`, `colors` (global on/off), `align`, `wordWrap`,
`inspectOptions` (`depth`/`colors`/`compact`/`getters`/`showProxy`), `properties`
(default `false`).

## Pattern-based redaction

Wrap any formatter with `redactByPattern()` from `@logtape/redaction` to scrub
secrets (see `core-redaction.md`):

```typescript
import { getTextFormatter } from "@logtape/logtape";
import { EMAIL_ADDRESS_PATTERN, JWT_PATTERN, redactByPattern } from "@logtape/redaction";

const formatter = redactByPattern(getTextFormatter(), [EMAIL_ADDRESS_PATTERN, JWT_PATTERN]);
```

## Fully custom formatter

A formatter is just a function returning a string:

```typescript
function myJsonLines(record: LogRecord): string {
  return JSON.stringify(record) + "\n";
}
```
