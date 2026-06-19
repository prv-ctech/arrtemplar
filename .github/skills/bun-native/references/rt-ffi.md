# Rule: rt-ffi

## Rationale

`bun:ffi` enables calling native C ABI libraries from JavaScript. Experimental — most stable native interop should use Node-API instead.

## API: `import { dlopen, FFIType, suffix, ptr, read, CString, CFunction, JSCallback, cc } from "bun:ffi"`

### `dlopen(path, symbols)`

```typescript
import { dlopen, FFIType, suffix } from "bun:ffi";

const lib = dlopen(`libsqlite3.${suffix}`, {
  sqlite3_libversion: { args: [], returns: FFIType.cstring },
});

console.log(lib.symbols.sqlite3_libversion());
```

### FFIType Mapping

| FFIType | C Type |
|---------|--------|
| `buffer` | `char*` |
| `cstring` | `char*` (null-terminated) |
| `ptr` | `void*` |
| `i8`–`i64` | `int8_t`–`int64_t` |
| `u8`–`u64` | `uint8_t`–`uint64_t` |
| `f32` / `f64` | `float` / `double` |
| `bool` | `bool` |
| `function` | `void*(*)()` |
| `napi_env` / `napi_value` | N-API types |

### C Compiler: `cc(options)`

```typescript
import { cc } from "bun:ffi";
import source from "./hello.c" with { type: "file" };

const { symbols: { hello } } = cc({
  source,
  symbols: { hello: { args: [], returns: "int" } },
});
```

| Option | Type | Description |
|--------|------|-------------|
| `source` | `string \| URL \| BunFile` | C source file |
| `symbols` | `{ [key]: { args, returns } }` | Functions to expose |
| `library` | `string[]` | Libraries to link |
| `flags` | `string \| string[]` | Compiler flags |
| `define` | `Record<string, string>` | Preprocessor definitions |

### JSCallback

```typescript
const cb = new JSCallback((ptr, length) => { /* ... */ }, {
  returns: "bool", args: ["ptr", "usize"], threadsafe: true,
});
cb.close(); // free when done
```

## Guidelines

- **EXPERIMENTAL**: Not production-ready. Prefer Node-API for stable native interop
- **NO MEMORY MANAGEMENT**: `bun:ffi` does NOT manage memory — you must free it yourself
- **POINTERS ARE NUMBERS**: 64-bit pointers fit in 52-bit addressable space (number, not BigInt)
- **WINDOWS HANDLE**: Use `u64`, not `ptr`
- **~2-6x FASTER**: Than Node.js FFI via Node-API (uses JIT-compiled bindings via TinyCC)
