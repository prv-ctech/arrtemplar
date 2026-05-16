# Rule: rt-jsonl

## Rationale

Bun provides built-in JSONL (JSON Lines) parsing with both batch and streaming modes. Implemented in C++ using JavaScriptCore's optimized JSON parser with SIMD-accelerated UTF-8 conversion.

## API

### `Bun.JSONL.parse(input: string | Uint8Array)` → `any[]`

```typescript
import { JSONL } from "bun";

const results = Bun.JSONL.parse('{"name":"Alice"}\n{"name":"Bob"}\n');
// [{ name: "Alice" }, { name: "Bob" }]

const buffer = new TextEncoder().encode('{"a":1}\n{"b":2}\n');
const results2 = Bun.JSONL.parse(buffer);
```

### `Bun.JSONL.parseChunk(input, start?, end?)` → `{ values, read, done, error }`

Streaming parser for incremental data.

```typescript
const chunk = '{"id":1}\n{"id":2}\n{"id":3';
const result = Bun.JSONL.parseChunk(chunk);
console.log(result.values); // [{ id: 1 }, { id: 2 }]
console.log(result.read);   // 17 (bytes/chars consumed)
console.log(result.done);   // false
console.log(result.error);  // null

// Byte offsets with Uint8Array
const buf = new TextEncoder().encode('{"a":1}\n{"b":2}\n{"c":3}\n');
const result2 = Bun.JSONL.parseChunk(buf, 8);       // parse from byte 8
const partial = Bun.JSONL.parseChunk(buf, 0, 8);    // parse range
```

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `values` | `any[]` | Successfully parsed values |
| `read` | `number` | Bytes (Uint8Array) or characters (string) consumed |
| `done` | `boolean` | `true` if entire input consumed |
| `error` | `SyntaxError \| null` | Parse error (does not throw) |

## Guidelines

- **BATCH MODE**: Use `parse()` for complete JSONL input
- **STREAMING MODE**: Use `parseChunk()` for incremental/streaming data
- **BYTE OFFSETS**: Use `Uint8Array` with `start`/`end` for efficient byte-level parsing
- **ERROR HANDLING**: `parseChunk()` returns errors in `.error` (does not throw). `parse()` throws on invalid JSON.
- **UTF-8 BOM**: Automatically skipped on `Uint8Array` input
