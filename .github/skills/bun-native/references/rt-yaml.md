# Rule: rt-yaml

## Rationale

Bun provides first-class YAML support — parse, import, require, and hot-reload YAML files without external packages. 90%+ of official YAML test suite.

## API

### `Bun.YAML.parse(text)` → `object | object[]`

```typescript
import { YAML } from "bun";
const data = YAML.parse(text);
```

Multi-document YAML (separated by `---`) returns an array. Supports full YAML 1.2 spec: scalars, collections, anchors/aliases (`&`/`*`), tags (`!!str`, `!!int`), multi-line strings (literal `|`, folded `>`), comments, directives.

### Module Import

```typescript
import config from "./config.yaml";             // default
import { database, redis } from "./config.yaml"; // named (top-level properties)
```

### CommonJS

```typescript
const config = require("./config.yaml");
```

### Dynamic Import

```typescript
const { default: config } = await import("./config.yaml");
```

## Guidelines

- **PREFER IMPORT**: Use ES module imports — enables tree-shaking and hot reload
- **HOT RELOAD**: Works with `bun --hot`
- **BUNDLER**: YAML parsed at build time, zero runtime overhead
- **NO EXTERNAL PACKAGES**: Replace `yaml`, `js-yaml`, and similar packages
- **MULTI-DOCUMENT**: `---` separated documents return as array
