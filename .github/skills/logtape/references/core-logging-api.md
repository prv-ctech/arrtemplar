# Rule: core-logging-api (LogTape)

> Sources: <https://logtape.org/manual/start>, <https://logtape.org/manual/struct>.

## Get a logger

`getLogger(category)` returns a logger. The category is an array (or a single
string) of hierarchical names. Call it once per module.

```typescript
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["my-app", "auth"]);
const rootLogger = getLogger([]); // root logger
```

## Two forms of a log call

### Tagged-template form (terse)

Values are interpolated into the rendered message, but they are **not** kept as
structured properties. Good for quick lines.

```typescript
logger.info`Hello, ${name}!`;
logger.error`Request ${reqId} failed.`;
```

> Template literals do **not** support structured properties. For queryable
> fields use the method-call form.

### Method-call form (structured — preferred)

Pass a message template with named `{placeholders}` plus a properties object.
Values stay first-class for downstream sinks (JSON Lines, OTel, …).

```typescript
logger.info("User {username} (id: {userId}) logged in.", {
  username: "johndoe",
  userId: 123456,
  loginTime: new Date(),
});
```

> Escaping: to log a literal `{` use `{{`. Placeholders tolerate surrounding
> spaces: `{ username }` matches property `"username"` (unless an exact
> `" username "` key exists, which then wins).

## Logging structured data only (no message)

Pass an object as the first argument (or use the `{*}` placeholder) to emit a
record whose properties are the object, with no message text (since 0.11.0):

```typescript
logger.info({ userId: 123456, username: "johndoe", loginTime: new Date() });
// equivalent to:
logger.info("{*}", { userId: 123456, username: "johndoe", loginTime: new Date() });
```

## Accessing nested properties in placeholders (since 1.2.0)

- **Dot notation:** `{user.name}`, `{order.customer.profile.tier}`.
- **Array indexing:** `{users[0]}`, `{users[0].name}`.
- **Bracket notation** for special chars: `{user["full-name"]}`; escaped quotes via `String.raw`.
- **Optional chaining:** `{user?.profile?.email}`, `{data?.items?.[0]?.name}`.
- **Combined:** `{users[0]?.profile?.["contact-info"]?.email}`.

```typescript
logger.info("Contact: {users[0]?.profile?.["contact-info"]?.email}", {
  users: [{ profile: { "contact-info": { email: "alice@example.com" } } }],
});
```

> A path that doesn't resolve (without optional chaining) renders as `undefined`.

## Lazy properties

Wrap an expensive value in a callback (sync) or `lazy()`; or pass an `async`
callback (since 2.0.0, returns `Promise<void>` — `await` it):

```typescript
import { lazy } from "@logtape/logtape";

logger.debug("Result {r}", () => ({ r: expensive() }));
logger.debug("Data {d}", { d: lazy(() => JSON.stringify(big)) });
await logger.debug("Fetched {user}", async () => ({ user: await fetchUser(id) }));
```

See `core-lazy.md`.

## Filtering by structured data

Filters can read `record.properties`:

```typescript
await configure({
  filters: {
    highPriorityOnly: (record) => record.properties.priority === "high" || record.level === "error",
  },
  loggers: [{ category: ["my-app"], sinks: ["console"], filters: ["highPriorityOnly"] }],
});
```

## Sinks for structured logging

Pair structured logging with a formatter that preserves fields:

```typescript
import { getFileSink } from "@logtape/file";
import { configure, getJsonLinesFormatter } from "@logtape/logtape";

await configure({
  sinks: { jsonl: getFileSink("log.jsonl", { formatter: getJsonLinesFormatter() }) },
});
```

Tail it live with `jq`:

```bash
tail -f log.jsonl | jq .
```

See `core-formatters.md`.

## Best practices

- **Consistent field names** for the same kind of data across the app.
- **Correct types** (numbers for counts, booleans for flags).
- **Don't overload** — log what's needed for debugging, not everything.
- **Nest when it helps** (e.g. `{ user: { … } }`).
- **Mind performance** at high volume.
