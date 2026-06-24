# Rule: core-lazy (LogTape)

> Source: <https://logtape.org/manual/lazy>.

Lazy evaluation defers value computation until a record is actually logged. It
serves two purposes: **performance** (skip expensive work when a level is off)
and **dynamic values** (capture the value at logging time, not creation time).

## `lazy()` for dynamic context (since 2.0.0)

`.with()` captures values eagerly. Use `lazy()` so the getter runs at **logging
time**, reflecting the latest state:

```typescript
import { getLogger, lazy } from "@logtape/logtape";

let currentUser: User | null = null;
const logger = getLogger("app").with({
  user: lazy(() => currentUser ? { id: currentUser.id, isAdmin: currentUser.isAdmin } : null),
});
const featureLogger = logger.getChild("feature");

featureLogger.info("Init");        // user: null
currentUser = await loadUser();
featureLogger.info("User action"); // user: { id: 1, isAdmin: true }
```

Child loggers inherit the `lazy()` wrapper itself (not a resolved value), so
they always see the latest value. Real-world uses: request correlation IDs,
`Bun.env.NODE_ENV`, `process.memoryUsage()`.

## `lazy()` for performance

Avoid expensive serialization/calls when the level is disabled:

```typescript
logger.debug("Query result", { data: lazy(() => JSON.stringify(largeObject)) });
logger.debug("Processing batch", {
  itemCount: items.length,                                 // cheap — direct
  itemDetails: lazy(() => items.map(formatItem)),          // expensive — lazy
  metadata: lazy(() => obj.expensiveOperation()),
});
```

Without `lazy()`, `JSON.stringify(largeObject)` runs even when debug is off.

## Async lazy evaluation (since 2.0.0)

Pass an `async` function as a property value. The log method returns
`Promise<void>` — **`await` it** (the `@logtape/no-unawaited-log` lint rule
enforces this). Works only for structured properties, not template literals.

```typescript
await logger.debug("User activity", { userDetails: async () => await fetchUserDetails(userId) });
```

> TypeScript warns on un-awaited promises, helping you remember.

## Conditional logging with `isEnabledFor()` (since 2.0.0)

For multiple log statements or setup work, guard with `isEnabledFor()`. It
checks both the logger's `lowestLevel` and whether any sink would receive the
level:

```typescript
if (logger.isEnabledFor("debug")) {
  const snapshot = captureComplexState();
  const analysis = analyzeState(snapshot);
  logger.debug("State analysis: {report}", { report: generateReport(analysis) });
  logger.debug("Raw snapshot: {snapshot}", { snapshot });
}
```

For async-only work, `isEnabledFor()` is the right tool (lazy callbacks must
return synchronously).

## Choosing the right approach

Decision tree:

1. Is the value asynchronous (`await`)? → **async function** as a property value.
2. Multiple log statements / setup? → **`isEnabledFor()`**.
3. Value changes over time or is expensive to compute? → **`lazy()`**.
4. Otherwise → use the value directly.

## Anti-patterns

```typescript
// BAD: computes before passing to lazy()
const serialized = JSON.stringify(obj);
logger.debug("Data", { data: lazy(() => serialized) });

// GOOD: defer the computation itself
logger.debug("Data", { data: lazy(() => JSON.stringify(obj)) });

// BAD: lazy() for cheap values
logger.debug("Count", { count: lazy(() => value) });

// GOOD: direct value for cheap things
logger.debug("Count", { count: value });
```

## Performance notes

- `lazy()` adds negligible overhead (~nanoseconds); the win is avoiding the expensive op.
- Async lazy has slightly higher overhead (promise handling).
- `isEnabledFor()` is more efficient than `lazy()` for multiple statements (no per-value function calls).
