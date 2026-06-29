# Rule: testing (LogTape)

> Source: <https://logtape.org/manual/testing>.

## Reset configuration between tests

Reset LogTape to its initial (unconfigured) state between tests so configs
don't leak across cases. This repo uses Bun's test runner (`bun test`); the same
`reset()`/`resetSync()` calls apply.

```typescript
import { configure, reset } from "@logtape/logtape";
import { afterEach, test } from "bun:test";

afterEach(async () => { await reset(); });

test("my feature", async () => {
  await configure({ /* … */ });
  // run the test
});
```

> Pair `configure()` with `reset()`, `configureSync()` with `resetSync()`. For
> async sinks also `await dispose()` so pending work finishes.

## Log recorder — `createLogRecorder()` (`@logtape/testing`, since 2.2.0)

Collect records in memory and assert on them.

```bash
bun add @logtape/testing
```

```typescript
import { configure, getLogger, reset } from "@logtape/logtape";
import { createLogRecorder } from "@logtape/testing";

const recorder = createLogRecorder();

try {
  await configure({
    sinks: { recorder: recorder.sink },
    loggers: [
      { category: ["my-lib"], lowestLevel: "debug", sinks: ["recorder"] },
      { category: ["logtape", "meta"], sinks: [] }, // silence meta in tests
    ],
  });

  getLogger(["my-lib"]).info("User {userId} logged in.", { userId: 123 });

  recorder.assertLogged({
    category: ["my-lib"],
    level: "info",
    message: "User 123 logged in.",
    properties: { userId: 123 },
  });
} finally {
  await reset();
}
```

The recorder stores records in sink call order and snapshots lazy-callback
messages at emit time (assertions see what a real sink would). API:

- **`records`** — snapshot array.
- **`clear()`**, **`take()`** (drain), **`find(matcher)`**, **`filter(matcher)`**.
- **`assertLogged(matcher)`**, **`assertNotLogged(matcher)`**.

Matchers can check category, category **prefix**, level, rendered message, raw
message, and a shallow partial set of structured properties. Most values use
`Object.is()`; `Date` compares by timestamp; regex values match string
properties; rendered-message matching uses the default text formatter's value
rendering. Use a property predicate for absence checks or deep matching.

> `createLogRecorder()` is a **synchronous** sink. If a log call uses **async
> lazy** properties, `await` the log call before asserting. If the test also
> uses async sinks, still `await dispose()` / `await reset()`.

## Library log testing example

```typescript
import { configure, reset } from "@logtape/logtape";
import { createLogRecorder } from "@logtape/testing";
import { Database } from "my-awesome-lib";

const recorder = createLogRecorder();

try {
  await configure({
    sinks: { recorder: recorder.sink },
    loggers: [
      { category: ["my-awesome-lib"], lowestLevel: "debug", sinks: ["recorder"] },
      { category: ["logtape", "meta"], sinks: [] },
    ],
  });

  const db = new Database("localhost", 5432, "user");
  db.query("SELECT * FROM users");

  recorder.assertLogged({
    categoryPrefix: ["my-awesome-lib"],
    level: "debug",
    message: /Executing query/,
    properties: { sql: "SELECT * FROM users" },
  });
} finally {
  await reset();
}
```

## Buffer sink (tiny tests)

For tests that only need raw `LogRecord` objects, push into an array directly:

```typescript
import { type LogRecord, configure } from "@logtape/logtape";

const buffer: LogRecord[] = [];

await configure({ sinks: { buffer: buffer.push.bind(buffer) } });
```

## This repo's logging tests

`test/apps/server/src/logging/config.test.ts` covers `configureServerLogging()`.
When extending logging behavior, add assertions there using `createLogRecorder()` and `reset()` between cases, and disable the meta logger (`sinks: []`) to keep test output clean.
