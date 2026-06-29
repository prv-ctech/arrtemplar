# Rule: core-categories (LogTape)

> Source: <https://logtape.org/manual/categories>.

LogTape uses a **hierarchical category system**. A category is a list of
strings, e.g. `["my-app", "my-module"]`. When you log a message, it is
dispatched to every logger whose category is a **prefix** of the emitting
category. Configuration (sinks, levels) flows from parent to child.

```typescript
await configure({
  sinks: {
    console: getConsoleSink(),
    file: getFileSink("app.log"),
  },
  loggers: [
    { category: ["my-app"], lowestLevel: "info", sinks: ["file"] },
    { category: ["my-app", "my-module"], lowestLevel: "debug", sinks: ["console"] },
  ],
});
```

## Sink inheritance and overriding

A logger inherits the sinks of its **parent** loggers and sends to all of them.
To replace inherited sinks with the logger's own set, use
`parentSinks: "override"`:

```typescript
await configure({
  sinks: { a: aSink, b: bSink },
  loggers: [
    { category: ["my-app"], sinks: ["a"] },
    { category: ["my-app", "my-module"], sinks: ["b"], parentSinks: "override" },
  ],
});

getLogger(["my-app"]).info("foo");          // → only sink a
getLogger(["my-app", "my-module"]).info("bar"); // → only sink b (overridden)
```

Without `parentSinks: "override"`, the child would send to **both** `a` and `b`.

## Root logger `[]`

The root logger has category `[]` and is the parent of all loggers. It is the
catch-all for logs from any category (including libraries you don't know about
in advance):

```typescript
await configure({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: [], sinks: ["console"], lowestLevel: "info" },          // catch-all
    { category: ["my-app"], sinks: ["console"], lowestLevel: "debug" }, // app subtree louder
  ],
});
```

## Child loggers

`getChild()` derives a child logger from a parent:

```typescript
const logger = getLogger(["my-app"]);
const child = logger.getChild("my-module");          // == getLogger(["my-app", "my-module"])
const deep = logger.getChild(["my-module", "foo"]);  // == getLogger(["my-app", "my-module", "foo"])
```

## Meta logger `["logtape", "meta"]`

LogTape reports its own operational issues (sink errors, config problems) under
`["logtape", "meta"]`. It is **auto-enabled** when you call `configure()`
without specifying it. To silence the startup notice, set its `lowestLevel` to
`"warning"` or higher; to disable entirely, give it an empty `sinks` array.

> **Sink-error safety:** on a sink error, the meta logger logs the error but
> never to the same sink that failed (prevents infinite recursion).

**Give the meta logger a separate sink** so logging failures stay visible:

```typescript
await configure({
  sinks: { console: getConsoleSink(), main: getYourMainSink() },
  loggers: [
    { category: ["logtape", "meta"], sinks: ["console"] },
    { category: ["your-app"], sinks: ["main"] },
  ],
});
```

In this repo, the meta logger is `["app", "meta"]` routed to a dedicated
`"meta"` console sink, gated by the `metaWarnings` (`"warning"`) filter.

## Category prefix `withCategoryPrefix()` (since 1.3.0)

For layered architectures (core lib → SDK → app), prepend a category prefix to
all records within a callback context. Requires `contextLocalStorage` (see
`core-contexts.md`):

```typescript
import { AsyncLocalStorage } from "node:async_hooks";
import { configure } from "@logtape/logtape";

await configure({ /* … */, contextLocalStorage: new AsyncLocalStorage() });
```

```typescript
import { getLogger, withCategoryPrefix } from "@logtape/logtape";

export function sdkFunction() {
  return withCategoryPrefix(["my-sdk"], () => {
    // logs from coreLibraryFunction() under ["core-library"]
    // now appear as ["my-sdk", "core-library"]
    return coreLibraryFunction();
  });
}
```

Prefixes **nest and accumulate**:

```typescript
withCategoryPrefix(["app"], () => {
  withCategoryPrefix(["sdk-1"], () => {
    getLogger(["core-lib"]).info("Hi"); // category: ["app", "sdk-1", "core-lib"]
  });
});
```

It composes with `withContext()` (see `core-contexts.md`).

> Without `contextLocalStorage`, `withCategoryPrefix()` no-ops and warns the meta logger. Node.js, Deno, and Bun support it; browsers do not (yet).
