# Rule: rt-console

## Rationale

Bun extends the standard `console` object with configurable inspection depth, write without newline, and async iteration over stdin.

## Extensions

### Configurable Inspection Depth

Default depth: `2`. Configurable via:

```bash
bun --console-depth 5 script.ts
```

Or in `bunfig.toml`:

```toml
console.depth = 5
```

```typescript
const nested = { a: { b: { c: { d: "deep" } } } };
console.log(nested);
// Default (depth 2): { a: { b: [Object] } }
// With depth 5: full output
```

### `console.write()` — Write Without Newline

```typescript
console.write(`Count: ${count}\n> `);
```

Useful for prompts and progress indicators.

### `console` as `AsyncIterable` — Read from stdin

```typescript
for await (const line of console) {
  console.log(line);
}
```

## Guidelines

- **DEPTH FOR DEBUGGING**: Increase `console.depth` when debugging deeply nested objects
- **WRITE FOR PROMPTS**: Use `console.write()` instead of `process.stdout.write()` for prompts
- **ASYNC ITERATION**: Use `for await (const line of console)` for interactive CLI input
