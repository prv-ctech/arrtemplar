# Rule: rt-utils

## Rationale

Bun provides a comprehensive set of utility functions that replace common npm packages. These are all built into the runtime with zero overhead.

## Core Utilities

### `Bun.version` / `Bun.revision`

```typescript
Bun.version;  // "1.3.13"
Bun.revision; // git commit hash
```

### `Bun.env` — Alias for `process.env`

### `Bun.main` — Absolute path to entrypoint

```typescript
if (import.meta.path === Bun.main) {
  // This is the main module
}
```

## Sleep

```typescript
await Bun.sleep(1000);
await Bun.sleep(new Date(Date.now() + 1000));
Bun.sleepSync(1000); // blocking
```

## UUID

```typescript
Bun.randomUUIDv7();                // hex string
Bun.randomUUIDv7("buffer");        // 16-byte Buffer
Bun.randomUUIDv7("base64");        // base64 string
Bun.randomUUIDv7("base64url");     // base64url string
Bun.randomUUIDv7("hex", Date.now()); // with custom timestamp
```

Monotonic, threadsafe counter, cryptographically secure random portion.

## Which

```typescript
Bun.which("ls"); // "/usr/bin/ls"
Bun.which("ls", { PATH: "/usr/local/bin:/usr/bin:/bin" });
```

## Peek

```typescript
Bun.peek(Promise.resolve("hi"));  // "hi" — reads without await
Bun.peek(new Promise(() => {}));  // returns the promise itself (pending)
Bun.peek.status(promise);         // "fulfilled" | "pending" | "rejected"
```

## Deep Equals

```typescript
Bun.deepEquals({ a: 1 }, { a: 1 });        // true
Bun.deepEquals({}, { a: undefined }, true); // false (strict mode)
```

## String Utilities

```typescript
Bun.escapeHTML('<script>alert("xss")</script>');
// "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"

Bun.stringWidth("hello"); // 5 (~6,756x faster than npm string-width)

Bun.stripANSI("\x1b[31mhello\x1b[0m"); // "hello" (6-57x faster than strip-ansi)

Bun.sliceAnsi("\x1b[31mhello\x1b[0m", 1, 4); // "\x1b[31mell\x1b[0m"
Bun.sliceAnsi("unicorn", 0, 4, "…"); // "uni…"

Bun.wrapAnsi("The quick brown fox...", 20, {
  hard: false, wordWrap: true, trim: true, ambiguousIsNarrow: true,
});
```

## Compression

```typescript
const compressed = Bun.gzipSync(Buffer.from("hello".repeat(100)));
const decompressed = Bun.gunzipSync(compressed);

const zstdCompressed = Bun.zstdCompressSync(buf, { level: 6 }); // 1-22
const zstdDecompressed = await Bun.zstdDecompress(zstdCompressed);
```

## Inspect

```typescript
Bun.inspect({ foo: "bar" });
Bun.inspect.table([{ a: 1, b: 2 }], ["a"], { colors: true });
```

## Timing

```typescript
Bun.nanoseconds(); // nanoseconds since process started
```

## File URL Conversion

```typescript
Bun.fileURLToPath(new URL("file:///foo/bar.txt")); // "/foo/bar.txt"
Bun.pathToFileURL("/foo/bar.txt"); // "file:///foo/bar.txt"
```

## Resolve

```typescript
Bun.resolveSync("./foo.ts", "/path/to/project"); // absolute path
Bun.resolveSync("zod", "/path/to/project");      // resolves node_modules
```

## Open in Editor

```typescript
Bun.openInEditor(import.meta.url);
Bun.openInEditor(import.meta.url, { editor: "vscode", line: 10, column: 5 });
```

## bun:jsc Module

```typescript
import { serialize, deserialize, estimateShallowMemoryUsageOf } from "bun:jsc";

const buf = serialize({ foo: "bar" });
const obj = deserialize(buf);
estimateShallowMemoryUsageOf(obj); // bytes (shallow estimate)
```

## Guidelines

- **REPLACE npm UTILITIES**: `Bun.sleep` → replaces sleep packages, `Bun.stringWidth` → replaces string-width, etc.
- **Bun.randomUUIDv7()**: Preferred over `crypto.randomUUID()` — sortable, monotonic
- **Bun.nanoseconds()**: Use for high-resolution timing in hot paths
- **Bun.escapeHTML()**: Optimized 480 MB/s - 20 GB/s throughput
- **`using` / `await using` native**: Starting in Bun 1.3.14, `using` and `await using` are no longer transpiled when targeting Bun (`bun run`, `Bun.Transpiler({ target: "bun" })`, `bun build --target=bun`, `--compile`, `--bytecode`). JavaScriptCore natively supports TC39 Explicit Resource Management. Other targets (`browser`, `node`) continue to lower as before.
