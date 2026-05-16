# Rule: rt-binary-data

## Rationale

Bun supports all standard binary data types with additional optimizations for `Uint8Array` (base64/hex conversion) and `BunFile` (lazy file loading).

## Core Types

| Type | Description |
|------|-------------|
| `ArrayBuffer` | Raw byte sequence, no direct access |
| `TypedArray` | Views over ArrayBuffer (Uint8Array, Int32Array, Float64Array, etc.) |
| `Buffer` | Node.js API, subclass of Uint8Array |
| `DataView` | Low-level get/set at byte offsets |
| `Blob` | Readonly binary data with type |
| `File` | Blob with name and lastModified |
| `BunFile` | Bun-only: lazy file via `Bun.file(path)` |

## Uint8Array Extensions

```typescript
new Uint8Array([1, 2, 3, 4, 5]).toBase64();     // "AQIDBA=="
Uint8Array.fromBase64("AQIDBA==");                // Uint8Array [1, 2, 3, 4, 5]
new Uint8Array([255, 254, 253]).toHex();          // "fffefd"
Uint8Array.fromHex("fffefd");                     // Uint8Array [255, 254, 253]
```

## TypedArray Classes

| Class | Bytes | Range |
|-------|-------|-------|
| `Uint8Array` | 1 | 0-255 |
| `Uint16Array` | 2 | 0-65535 |
| `Uint32Array` | 4 | 0-4294967295 |
| `Int8Array` | 1 | -128 to 127 |
| `Int16Array` | 2 | -32768 to 32767 |
| `Int32Array` | 4 | -2147483648 to 2147483647 |
| `Float16Array` | 2 | half-precision |
| `Float32Array` | 4 | -3.4e38 to 3.4e38 |
| `Float64Array` | 8 | -1.7e308 to 1.7e308 |
| `BigInt64Array` | 8 | signed BigInt |
| `BigUint64Array` | 8 | unsigned BigInt |

## TextEncoder / TextDecoder

```typescript
const encoder = new TextEncoder();
const bytes = encoder.encode("hello world");

const decoder = new TextDecoder();
decoder.decode(bytes); // "hello world"
```

## Guidelines

- **Uint8Array HEX/BASE64**: Use `.toHex()`/`.fromHex()`/`.toBase64()`/`.fromBase64()` — no Buffer needed
- **BunFile FOR FILES**: Use `Bun.file()` for lazy file access (zero-copy where possible)
- **DataView FOR PROTOCOLS**: Use `DataView` for reading/writing binary protocols at specific offsets
