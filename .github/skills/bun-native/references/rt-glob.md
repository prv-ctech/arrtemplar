# Rule: rt-glob

## Rationale

`Bun.Glob` provides fast file pattern matching. Written in Zig, up to 2x faster than npm alternatives. Supports Node.js `fs.glob()` compatibility.

## API

```typescript
import { Glob } from "bun";

const glob = new Glob("**/*.ts");

// Async scan
for await (const file of glob.scan(".")) {
  console.log(file);
}

// Sync scan
for (const file of glob.scanSync(".")) {
  console.log(file);
}

// Match check
glob.match("index.ts"); // true
glob.match("index.js"); // false
```

### ScanOptions

```typescript
interface ScanOptions {
  cwd?: string;                    // default: process.cwd()
  dot?: boolean;                   // match dotfiles, default: false
  absolute?: boolean;              // return absolute paths, default: false
  followSymlinks?: boolean;        // default: false
  throwErrorOnBrokenSymlink?: boolean; // default: false
  onlyFiles?: boolean;             // default: true
}
```

## Supported Patterns

| Pattern | Description |
|---------|-------------|
| `?` | Any single character |
| `*` | Zero or more chars (except `/`) |
| `**` | Zero or more chars including `/` |
| `[ab]` | Character class, ranges, negation `[^ab]` |
| `{a,b,c}` | Match any pattern (nestable, 10 levels) |
| `!` | Negate at start |
| `\` | Escape special chars |

## Node.js Compatibility

```typescript
import { glob, globSync, promises } from "node:fs";

const files = await promises.glob(["**/*.ts", "**/*.js"]);
const filtered = await promises.glob("**/*", {
  exclude: ["node_modules/**", "*.test.*"],
});
```

## Performance (1.3.12+)

- `Bun.Glob.scan()` up to **2x faster** for `**/X/...` boundary patterns (no double directory reads)
- Windows: wildcard filters pushed to kernel via `NtQueryDirectoryFile` — up to **2.4x faster**
- SIMD optimizations for ANSI parsing in `Bun.stripANSI`/`Bun.stringWidth`

## Guidelines

- **REPLACE glob/fast-glob**: Use `new Glob(pattern).scan()` instead of npm packages
- **SCAN FOR FILES**: Use `.scan()` for file discovery, `.match()` for single-path checks
- **NODE.JS COMPAT**: Use `fs.glob()`/`fs.globSync()` when sharing code with Node.js
- **NEGATION**: Use `!pattern` at the start to exclude paths
