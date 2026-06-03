# Rule: io-file-ops

## Rationale

`Bun.file()` and `Bun.write()` are the default file primitives for this repo's server and tooling code. They fit static file serving, log writes, generated assets, and script-level filesystem work without pulling in `node:fs` for common cases.

## Guidelines

- **READS**: Use `Bun.file(path)` for lazy reads and for returning file-backed responses.
- **WRITES**: Use `Bun.write(dest, content, options)` for logs, generated files, and file copies.
- **MODULE-RELATIVE PATHS**: Prefer `new URL(..., import.meta.url)` plus `Bun.fileURLToPath()` when you need a filesystem path relative to the current module.
- **INCREMENTAL WRITES**: Use `file.writer()` for append-heavy or streaming write workloads.
- **IMAGE PROCESSING**: Use `Bun.Image` for server-side image transforms (resize, rotate, convert, generate thumbnails). Zero native module installs. See `rt-image.md`.
- **ONLY FALL BACK TO `node:fs` WHEN NECESSARY**: if a required capability is missing, leave a short reason or `verify-ignore` comment.

## Examples

### Incorrect

```typescript
import { readFile, writeFile } from "node:fs/promises";
const data = await readFile("large.bin");
await writeFile("copy.bin", data);
```

### Correct

```typescript
const file = Bun.file("large.bin");
await Bun.write("copy.bin", file); // Zero-copy implementation

const text = await Bun.file("./config/app.json").text();

const assetDir = Bun.fileURLToPath(new URL("../../app/assets/avatars/", import.meta.url));

// Incremental
const writer = Bun.file("log.txt").writer();
writer.write("new line\n");
writer.end();
```
