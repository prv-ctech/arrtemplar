# Rule: core-filters (LogTape)

> Source: <https://logtape.org/manual/filters>.

A filter is `(record: LogRecord) => boolean` — `true` passes the record to
sinks, `false` discards it. Register filters by name in `configure({ filters })`
and attach them to loggers via `filters: ["name"]`.

```typescript
await configure({
  filters: {
    tooSlow(record) {
      return "elapsed" in record.properties
        && typeof record.properties.elapsed === "number"
        && record.properties.elapsed >= 100;
    },
  },
  loggers: [{ category: ["my-app", "database"], sinks: ["console"], filters: ["tooSlow"] }],
});
```

## Inheritance

Child loggers **inherit** their parent's filters. A child's own filters apply
**in addition to** inherited ones. In the example below, `["my-app", "database"]`
records reach the console only if they have `userInfo` (inherited from parent)
**and** `elapsed >= 100` (own filter):

```typescript
await configure({
  filters: {
    hasUserInfo(record) { return "userInfo" in record.properties; },
    tooSlow(record) { /* elapsed >= 100 */ },
  },
  loggers: [
    { category: ["my-app"], sinks: ["console"], filters: ["hasUserInfo"] },
    { category: ["my-app", "database"], sinks: [], filters: ["tooSlow"] },
  ],
});
```

## Level filter

`getLevelFilter(level)` returns a filter that keeps `level` and above. Even
shorter: `filters` accepts a **level string** directly (`FilterLike`), which
makes the threshold inherit down the tree (unlike `lowestLevel`, which does not
inherit):

```typescript
import { configure, getLevelFilter } from "@logtape/logtape";

await configure({ filters: { infoAndAbove: getLevelFilter("info") } });
// or the shorthand:
await configure({ filters: { infoAndAbove: "info" } });
```

## Throttling filter (since 2.1.0)

Suppress repeated records during bursts. By default it keys on
(category, level, raw message template) so differing substitution values count
as the same pattern:

```typescript
import { configure, getThrottlingFilter } from "@logtape/logtape";

await configure({
  filters: {
    throttle: getThrottlingFilter({ limit: 5, windowMs: 10_000 }),
  },
  loggers: [{ category: ["my-app"], sinks: ["console"], filters: ["throttle"] }],
});
```

Options:

- `mode`: `"fixed"` (default — window starts at first record) or `"sliding"` (count records in the last `windowMs`).
- `timeSource`: `"now"` (default, `Date.now()`) or `"record"` (each record's timestamp), or a custom `clock`.
- `key(record)`: what counts as "the same record" (e.g. per tenant).
- `maxKeys`: LRU cap on tracked keys (default 1,000; `null` disables).

Emit a summary when suppression ends / a key is evicted / the filter is
disposed (use a dedicated summary logger so it routes separately):

```typescript
import { getLogger, getThrottlingFilter } from "@logtape/logtape";

getThrottlingFilter({
  limit: 5,
  windowMs: 10_000,
  summary: {
    logger: getLogger(["my-app", "log-throttle"]),
    level: "warning",
    message: "Last log message was suppressed {suppressed} times.",
  },
});
```

Summary records carry `key`, `suppressed`, `allowed`, `reason`, `startTime`,
`endTime`, `firstRecord`, `lastRecord`.

## Sink-scoped filter `withFilter()`

Apply a filter to **one sink** regardless of logger. `withFilter()` accepts a
`Filter` function or a level string:

```typescript
import { configure, getConsoleSink, withFilter } from "@logtape/logtape";

await configure({
  sinks: {
    filteredConsole: withFilter(getConsoleSink(), (log) =>
      "elapsed" in log.properties && typeof log.properties.elapsed === "number" && log.properties.elapsed >= 100,
    ),
    // or by level:
    errorsOnly: withFilter(getConsoleSink(), "error"),
  },
});
```
