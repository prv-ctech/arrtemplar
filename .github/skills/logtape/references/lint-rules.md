# Rule: lint-rules (`@logtape/lint`)

> Sources: <https://logtape.org/lint/>, plus each rule's detail page.

`@logtape/lint` provides lint rules for **ESLint** (v8 & v9), **Oxlint**, and
**Deno Lint** that catch common LogTape mistakes at dev time.

## Available rules

- **`no-message-interpolation`** — severity `error`, not fixable.
- **`prefer-lazy-evaluation`** — severity `warn`, auto-fixable.
- **`no-unawaited-log`** — severity `error`, auto-fixable (when enclosing fn is async).
- **`require-meta-sink`** — severity `warn`, not fixable.

## Install

```bash
bun add @logtape/lint
```

## ESLint configuration (flat config, v9)

Ready-made `recommended` preset (activates all four with default severities):

```javascript
import logtape from "@logtape/lint/eslint";

export default [
  // ...other configs
  logtape.configs.recommended,
];
```

Manual:

```javascript
import logtape from "@logtape/lint/eslint";

export default [
  {
    plugins: { "@logtape": logtape },
    rules: {
      "@logtape/no-message-interpolation": "error",
      "@logtape/prefer-lazy-evaluation": "warn",
      "@logtape/no-unawaited-log": "error",
      "@logtape/require-meta-sink": "warn",
    },
  },
];
```

## Oxlint configuration

`.oxlintrc.json`:

```json
{
  "jsPlugins": [{ "name": "@logtape", "specifier": "@logtape/lint/eslint" }],
  "rules": {
    "@logtape/no-message-interpolation": "error",
    "@logtape/prefer-lazy-evaluation": "warn",
    "@logtape/no-unawaited-log": "error",
    "@logtape/require-meta-sink": "warn"
  }
}
```

## Deno Lint configuration

> The Deno Lint plugin API is experimental; requires Deno 2.2.0+ with
> `"unstable": ["lint"]`.

`deno.json`:

```json
{
  "unstable": ["lint"],
  "lint": {
    "plugins": ["jsr:@logtape/lint/deno"],
    "rules": {
      "include": [
        "logtape/no-message-interpolation",
        "logtape/prefer-lazy-evaluation",
        "logtape/no-unawaited-log",
        "logtape/require-meta-sink"
      ]
    }
  }
}
```

Then `deno lint`.

---

## `no-message-interpolation` (error, not fixable)

Disallow template-literal `${}` in message arguments. Interpolation bakes
values into the string, destroying structured fields (sinks can't filter/index
them). Use named placeholders instead.

Incorrect:

```typescript
logger.info(`User ${userId} logged in.`);       // { message: "User 42 logged in." }
logger.error(`Request ${reqId} failed.`);
```

Correct:

```typescript
logger.info("User {userId} logged in.", { userId });  // userId stays a structured field
logger.error("Request {reqId} failed.", { reqId });
// Plain backticks without ${} and LogTape tagged templates are allowed:
logger.info(`User logged in.`);
logger.info`User ${userId} logged in.`;
```

## `prefer-lazy-evaluation` (warn, auto-fixable)

Prefer a lazy callback over an eager object when a property value contains a
function call. Eager objects run the call even when the level is disabled; lazy
callbacks skip it. Auto-fix wraps the object: `{ key: fn() }` → `() => ({ key: fn() })`.

Incorrect:

```typescript
logger.debug("Fetched data: {data}.", { data: fetchData() });
logger.info("Result: {r}.", { r: a.method() });
```

Correct:

```typescript
logger.debug("Fetched data: {data}.", () => ({ data: fetchData() }));
logger.info("Hello {name}.", { name: "world" }); // no call — fine
```

## `no-unawaited-log` (error, auto-fixable when enclosing fn is async)

Require `await` on log calls that use an `async` lazy callback — the method
returns `Promise<void>` and the record isn't guaranteed processed otherwise.
Silent for sync callbacks, `await`-prefixed calls, returned calls,
`.then()/.catch()/.finally()` chains, and concise arrow bodies.

Incorrect:

```typescript
async function handler() {
  logger.debug("Data {d}.", async () => ({ d: await fetchData() })); // ← error
}
```

Correct:

```typescript
async function handler() {
  await logger.debug("Data {d}.", async () => ({ d: await fetchData() }));
  return logger.debug("Data {d}.", async () => ({ d: await fetchData() })); // propagated
}
const logData = async () => logger.debug("Data {d}.", async () => ({ d: await fetchData() }));
```

## `require-meta-sink` (warn, not fixable)

Require a dedicated sink for the meta logger in `configure()`/`configureSync()`.
Without an explicit `["logtape"]` or `["logtape", "meta"]` entry (array form)
with a non-empty `sinks`, LogTape diagnostics get mixed into a catch-all, get
swallowed, or fall back to a built-in console sink. The category **must** be in
array form — a bare string `"logtape"` does not configure the meta logger.

Incorrect:

```typescript
await configure({
  sinks: { console: consoleSink },
  loggers: [{ category: ["my-app"], sinks: ["console"] }], // no meta logger
});
```

Correct:

```typescript
await configure({
  sinks: { console: consoleSink },
  loggers: [
    { category: ["my-app"], sinks: ["console"] },
    { category: ["logtape", "meta"], sinks: ["console"] }, // array form + sink
  ],
});
```

> The repo's meta logger is `["app", "meta"]` routed to the `"meta"` sink —
> always preserve a dedicated meta entry when editing `logging/config.ts`.
