# Rule: library (LogTape)

> Source: <https://logtape.org/manual/library>.

LogTape is library-first: a library records freely; the **application** decides
if/where/how logs play back.

## For library authors

### Best practices

1. **Use namespaced categories** — start with your library name to avoid collisions:

```typescript
import { getLogger } from "@logtape/logtape";
const logger = getLogger(["my-awesome-lib", "database"]);
```

- **Do not call `configure()` in your library** — leave that to the app developer.
- **Use levels judiciously** — `error` for real failures, `info` for notable normal ops, `debug` for dev detail.
- **Provide context** with structured logging:

```typescript
logger.info("Database connection established", { host: dbHost, port: dbPort, username: dbUser });
```

### Example: logging in a library

```typescript
// my-awesome-lib/database.ts
import { getLogger } from "@logtape/logtape";

export class Database {
  private logger = getLogger(["my-awesome-lib", "database"]);

  constructor(private host: string, private port: number, private user: string) {}

  connect() {
    this.logger.info("Attempting to connect to database", { host: this.host, port: this.port, user: this.user });
    if (Math.random() > 0.5) {
      this.logger.error("Failed to connect to database", { host: this.host, port: this.port, user: this.user });
      throw new Error("Connection failed");
    }
    this.logger.info("Successfully connected to database");
  }

  query(sql: string) {
    this.logger.debug("Executing query", { sql });
    // query logic
  }
}
```

### Testing library logs (`@logtape/testing`, since 2.2.0)

```bash
bun add @logtape/testing
```

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

## For application developers

You fully control how a library's logs are handled.

1. **Set up sinks** (console, file, etc.).
2. **Configure per-library levels** under the library's category subtree.
3. **Add filters** to fine-tune.

```typescript
import { getFileSink } from "@logtape/file";
import { configure, getConsoleSink } from "@logtape/logtape";
import { Database } from "my-awesome-lib";

await configure({
  sinks: { console: getConsoleSink(), file: getFileSink("app.log") },
  filters: { excludeDebug: (record) => record.level !== "debug" },
  loggers: [
    { category: ["my-awesome-lib"], lowestLevel: "info", sinks: ["console", "file"] },
    { category: ["my-awesome-lib", "database"], lowestLevel: "debug", sinks: ["file"], filters: ["excludeDebug"] },
  ],
});

const db = new Database("localhost", 5432, "user");
db.connect();
db.query("SELECT * FROM users");
```

Here `["my-awesome-lib"]` at `info`+ goes to console+file; the database subtree
logs at `debug`+ to file, but `debug` is filtered out.

## Wrapping internal library logs (`withCategoryPrefix()`, since 1.3.0)

If your SDK uses internal LogTape libraries, surface their logs under your SDK's
category so app devs configure one namespace. Requires `contextLocalStorage`:

```typescript
// my-sdk/index.ts
import { getLogger, withCategoryPrefix } from "@logtape/logtape";

const internalDbLib = {
  query(sql: string) { getLogger(["internal-db-lib"]).debug("Executing query", { sql }); return { rows: [] }; },
};

export class MySDK {
  private logger = getLogger(["my-sdk"]);

  async query(sql: string) {
    return withCategoryPrefix(["my-sdk"], () => {
      this.logger.debug("Starting query", { sql });
      return internalDbLib.query(sql); // appears as ["my-sdk", "internal-db-lib"]
    });
  }
}
```

App config (note `contextLocalStorage` is required):

```typescript
import { AsyncLocalStorage } from "node:async_hooks";
import { configure, getConsoleSink } from "@logtape/logtape";

await configure({
  sinks: { console: getConsoleSink() },
  loggers: [{ category: ["my-sdk"], lowestLevel: "info", sinks: ["console"] }],
  contextLocalStorage: new AsyncLocalStorage(), // required for withCategoryPrefix()
});
```

> In this repo, the monorepo's internal packages (e.g. `@arrtemplar/shared`) and
> server modules should log under the `["app", …]` tree and rely on
> `configureServerLogging()` for all routing — do not configure LogTape inside
> shared/server modules.
