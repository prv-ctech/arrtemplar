# Rule: rt-transpiler

## Rationale

`Bun.Transpiler` provides programmatic access to Bun's internal JS/TS transpiler for build tooling, AST scanning, and code transformation.

## API

```typescript
const transpiler = new Bun.Transpiler({ loader: "tsx" });
```

### Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| `loader` | `"js" \| "jsx" \| "ts" \| "tsx"` | Default loader |
| `define` | `Record<string, string>` | Replace keys with JSON values |
| `target` | `"browser" \| "bun" \| "node"` | Target platform |
| `tsconfig` | `string \| TSConfig` | Custom tsconfig for JSX settings |
| `macro` | `MacroMap` | Map import paths to macros |
| `exports` | `{ eliminate?, replace? }` | Eliminate/rename exports |
| `trimUnusedImports` | `boolean` | Remove unused imports |
| `minifyWhitespace` | `boolean` | Experimental whitespace minification |
| `inline` | `boolean` | Inline constant values (default: true) |

### Methods

```typescript
const result = transpiler.transformSync(code);
const result = await transpiler.transform(code, "tsx");

const { exports, imports } = transpiler.scan(code);
const imports = transpiler.scanImports(code);
```

| Method | Returns | Description |
|--------|---------|-------------|
| `.transformSync(code, loader?)` | `string` | Synchronous transpilation |
| `.transform(code, loader?)` | `Promise<string>` | Async (runs in worker threadpool) |
| `.scan(code)` | `{ exports, imports }` | Scan imports/exports (type-only ignored) |
| `.scanImports(code)` | `Import[]` | Faster import scanning |

### Import Kinds

`import-statement`, `require-call`, `require-resolve`, `dynamic-import`, `import-rule`, `url-token`, `internal`, `entry-point-build`, `entry-point-run`

## Guidelines

- **SYNC FOR SINGLE FILES**: Use `.transformSync()` for individual files
- **ASYNC FOR BATCHES**: Use `.transform()` for many large files (runs in worker threadpool)
- **SCAN OVER TRANSFORM**: Use `.scan()`/`.scanImports()` when you only need import/export info
- **DEFINE FOR CONSTANTS**: Use `define` to replace constants at transpile time

## Bugfixes (1.3.11/1.3.12)

- `experimentalDecorators: true` and `emitDecoratorMetadata: true` now respected from tsconfig
- `trimUnusedImports` now works with `.scanImports()` and `.scan()` too
- Memory leak with custom tsconfig and async `transform()` fixed
- `emitDecoratorMetadata: true` without `experimentalDecorators: true` no longer uses wrong decorator semantics
