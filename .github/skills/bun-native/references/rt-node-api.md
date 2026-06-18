# Rule: rt-node-api

## Rationale

Bun implements 95% of the Node-API (N-API) interface from scratch, allowing most existing Node-API native extensions to work out of the box.

## Loading Native Modules

```typescript
const napi = require("./my-node-module.node");
```

Or via `process.dlopen`:

```typescript
let mod = { exports: {} };
process.dlopen(mod, "./my-node-module.node");
```

## Compatibility

- Most Node-API extensions work without changes
- Track completion status via [GitHub issue #158](https://github.com/oven-sh/bun/issues/158)

## Bugfixes (1.3.13)

- Fixed crash during process exit when native N-API modules wrap parent objects before children — finalizers now run in LIFO order matching Node.js
- Fixed crash in `StringDecoder.prototype.write()`

## Guidelines

- **USE Node-API OVER FFI**: For stable native interop, prefer Node-API modules over `bun:ffi`
- **NATIVE MODULES**: Load `.node` files with `require()` — no special configuration needed
- **CHECK COMPATIBILITY**: Most modules work; check the tracking issue for edge cases
