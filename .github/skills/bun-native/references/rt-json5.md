# Rule: rt-json5

## Rationale

Bun provides built-in JSON5 parsing and stringification without external packages. Parser written in Zig, passes 100% of official JSON5 test suite.

## API

### `Bun.JSON5.parse(input: string)` → `any`

```typescript
import { JSON5 } from "bun";

const data = JSON5.parse(`{
  // comments
  name: 'my-app',
  version: '1.0.0',
  tags: ['web', 'api',],
}`);
```

### `Bun.JSON5.stringify(value, replacer?, space?)` → `string`

```typescript
JSON5.stringify({ name: "my-app", version: "1.0.0" });
// {name:'my-app',version:'1.0.0'}

JSON5.stringify(data, null, 2);
JSON5.stringify({ inf: Infinity, nan: NaN });
// {inf:Infinity,nan:NaN}
```

### Module Import

```typescript
import config from "./config.json5";             // default
import { name, version } from "./config.json5";  // named
const config = require("./config.json5");         // CJS
```

## JSON5 Features

- Comments: `//` and `/* */`
- Trailing commas
- Unquoted keys (valid ES5.1 identifiers)
- Single-quoted strings
- Multi-line strings (backslash continuations)
- Hex numbers (`0xFF`), leading/trailing decimals (`.5`, `5.`)
- `Infinity`, `-Infinity`, `NaN`

## Guidelines

- **REPLACE json5 PACKAGE**: Use `Bun.JSON5.parse()` / `Bun.JSON5.stringify()`
- **IMPORT SUPPORT**: JSON5 files can be imported directly — hot reload and bundler support
- **BUNDLER**: JSON5 parsed at build time, zero runtime overhead
