# Rule: rt-toml

## Rationale

Bun provides first-class TOML support — parse, import, require, and hot-reload TOML files without external packages.

## API

### `Bun.TOML.parse(text)` → `object`

```typescript
import { TOML } from "bun";
const data = TOML.parse(text);
```

Supports full TOML v1.0 spec: strings (basic/literal/multi-line), integers (decimal/hex/octal/binary), floats (including `inf`/`nan`), booleans, arrays, tables (standard/inline), array of tables (`[[array]]`), dotted keys, comments (`#`).

### Module Import

```typescript
import config from "./config.toml";             // default import
import { database, redis } from "./config.toml"; // named imports (top-level tables)
import cfg from "./my.config" with { type: "toml" }; // import attributes
```

### CommonJS

```typescript
const config = require("./config.toml");
```

### Dynamic Import

```typescript
const config = await import("./config.toml");
```

## Guidelines

- **PREFER IMPORT**: Use ES module imports for config files — enables tree-shaking and hot reload
- **HOT RELOAD**: Works with `bun --hot` — changes to TOML files auto-detected
- **BUNDLER**: TOML parsed at build time, zero runtime overhead
- **NO EXTERNAL PACKAGES**: Replace `toml`, `smol-toml`, and similar packages
