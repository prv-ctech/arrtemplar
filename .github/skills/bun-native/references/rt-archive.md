# Rule: rt-archive

## Rationale

`Bun.Archive` provides built-in tar/tar.gz archive creation, reading, and extraction without external packages.

## Creating Archives

```typescript
const archive = new Bun.Archive({
  "hello.txt": "Hello, World!",
  "data.json": JSON.stringify({ foo: "bar" }),
  "nested/file.txt": "Nested content",
});

await Bun.write("output.tar", archive);

const compressed = new Bun.Archive(
  { "src/index.ts": "console.log('Hello');" },
  { compress: "gzip" },
);
await Bun.write("output.tar.gz", compressed);
```

**Supported content types**: `string`, `Blob`, `ArrayBufferView`, `ArrayBuffer`

## Getting Bytes

```typescript
const bytes = await archive.bytes();      // Uint8Array
const blob = await archive.blob();        // Blob
```

## Reading Archives

```typescript
const tarball = await Bun.file("package.tar.gz").bytes();
const archive = new Bun.Archive(tarball);

const files = await archive.files();
for (const [path, file] of files) {
  console.log(`${path}: ${file.size} bytes`);
  console.log(await file.text());
}
```

### Glob Filtering

```typescript
const tsFiles = await archive.files("**/*.ts");
const codeFiles = await archive.files(["**/*.ts", "**/*.js"]);
```

## Extracting Archives

```typescript
const count = await archive.extract("./output");
const tsCount = await archive.extract("./extracted", { glob: "**/*.ts" });
const distCount = await archive.extract("./extracted", {
  glob: ["**", "!node_modules/**"],
});
```

**Security**: Rejects absolute paths, normalizes `..` traversal. Windows skips symlinks.

## Compression Options

```typescript
new Bun.Archive(data);                                      // uncompressed
new Bun.Archive(data, { compress: "gzip" });                // level 6
new Bun.Archive(data, { compress: "gzip", level: 12 });     // max (1-12)
```

## Guidelines

- **REPLACE tar/tar-fs**: Use `Bun.Archive` instead of npm tar packages
- **GLOB FILTER**: Use glob patterns to selectively extract or read
- **STREAMING**: Archives can be created from `fetch()` responses
- **SECURITY**: Path traversal protection built-in
