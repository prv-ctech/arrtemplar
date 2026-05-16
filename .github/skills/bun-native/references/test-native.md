# Rule: test-native

## Rationale

Bun's built-in test runner is the default test runtime for this repo. Bun 1.3.9–1.3.13 added significant features: disposable mocks, retry control, async stack traces, parallel execution, isolation, sharding, and changed-file detection.

## Guidelines

- **API**: Use `import { describe, test, expect, mock, spyOn } from "bun:test"`.
- **RUNNER**: Use `bun test` for execution. Use `--grep` for targeted tests.
- **PARALLEL**: Use `bun test --parallel[=N]` to distribute test files across N worker processes (defaults to CPU count). Files are partitioned for cache locality, idle workers steal work.
- **ISOLATE**: Use `bun test --isolate` to run each test file in a fresh global environment within the same process. Between files, Bun drains microtasks, closes sockets, cancels timers, kills subprocesses, and creates a clean global object.
- **SHARD**: Use `bun test --shard=M/N` to split tests across CI jobs. Test files sorted by path, distributed round-robin. Sharding applied after `--changed` filter.
- **CHANGED**: Use `bun test --changed[=REF]` to only run tests affected by git changes. Builds full import graph, filters to transitively dependent files. Combine with `--watch` for continuous re-filtering.
- **DISCOVERY**: If this repo gains fixture, vendor, or submodule trees with embedded tests, prefer `--path-ignore-patterns` or `[test].pathIgnorePatterns` in `bunfig.toml`.
- **MOCKS**: Prefer `using` with `mock()` and `spyOn()` when the mock should auto-restore after a short scope. JavaScriptCore now natively supports `using` and `await using` declarations (TC39 Explicit Resource Management). No longer transpiled when targeting Bun.
- **RETRIES**: Use `bun test --retry N` only for flaky infra, server boot, or network-dependent test runs. Do not use retries to paper over deterministic failures.
- **TIMERS**: In Bun runtime tests, `Bun.sleep()` is usually cleaner than promise-wrapped `setTimeout()` for fixed waits.
- **ASYNC STACK TRACES**: Native APIs (`node:fs`, `Bun.write`, `node:http`, `node:dns`) now include async stack frames in errors — better debugging without code changes.
- **HEADLESS BROWSER TESTING**: `Bun.WebView` provides native headless browser automation (WebKit on macOS, Chrome cross-platform). Useful for integration/E2E tests. Supports `navigate`, `click`, `evaluate`, `screenshot`, `scroll`, `type`, `press`, and raw CDP access.
- **MARKDOWN SNAPSHOTS**: `Bun.markdown.ansi()` can render Markdown to ANSI-colored strings for snapshot-style CLI output testing.
- **`--no-orphans`**: In CI environments where the runner may be force-killed, run tests with `bun test --no-orphans` to ensure test processes are cleaned up when the parent dies.

## Examples

### Correct

```typescript
import { expect, spyOn, test } from "bun:test";

test("auto-restores a spy", () => {
  const service = { ping: () => "ok" };

  {
    using spy = spyOn(service, "ping").mockReturnValue("mocked");
    expect(service.ping()).toBe("mocked");
  }

  expect(service.ping()).toBe("ok");
});
```

### CI / Infra Example

```bash
bun test --retry 2
bun test --parallel=8
bun test --isolate ./tests
bun test --shard=1/3  # CI matrix: split across 3 jobs
bun test --changed    # only tests affected by uncommitted changes
bun test --changed=main --watch  # continuous changed-file testing
```

### Parallel & Isolate

```bash
# Run tests with isolation (fresh global per file)
bun test --isolate ./tests

# Run tests in parallel across all CPU cores
bun test --parallel ./tests

# Combine with sharding for CI
bun test --parallel --shard=1/3 ./tests
```

### Shard Example (CI Matrix)

```yaml
# .github/workflows/test.yml
strategy:
  matrix:
    shard: [1, 2, 3]
steps:
  - run: bun test --shard=${{ matrix.shard }}/3
```

### Discovery Example

```toml
[test]
pathIgnorePatterns = ["fixtures/**", "vendor/**", "**/test-data/**"]
```

### WebView Headless Browser Test

```typescript
import { test, expect } from "bun:test";

test("page has correct title", async () => {
  await using view = new Bun.WebView({ width: 800, height: 600 });
  await view.navigate("http://localhost:3000");
  const title = await view.evaluate("document.title");
  expect(title).toBe("My App");
});
```

### Markdown ANSI Snapshot

```typescript
import { test, expect } from "bun:test";

test("CLI help output matches snapshot", () => {
  const md = "# Usage\n\n`bun run dev` starts the server.\n";
  const ansi = Bun.markdown.ansi(md, { colors: false });
  expect(ansi).toMatchSnapshot();
});
```
