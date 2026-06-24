# Rule: core-config-from-object (`@logtape/config`)

> Sources: <https://logtape.org/manual/config#configuration-from-objects>, <https://jsr.io/@logtape/config/doc>.

When you want to load logging config from JSON/YAML/TOML/env, the
`@logtape/config` package provides `configureFromObject()` (since 2.0.0).

## Install

```bash
bun add @logtape/config
```

## Basic usage

```typescript
import { configureFromObject } from "@logtape/config";
import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile("./logtape.json", "utf-8"));
await configureFromObject(config);
```

> In server code prefer `Bun.file("./logtape.json").json()` over `node:fs/promises`.

## Module-reference syntax (`type` field)

The `type` field references a module/export. The `()` suffix marks a factory
function called with the remaining options as its argument.

- `#shorthand()` — built-in shorthand, factory function.
- `#shorthand` — built-in shorthand, direct value.
- `module#export()` — named export, factory function.
- `module#export` — named export, direct value.
- `module()` — default export, factory function.
- `module` — default export, direct value.

## Built-in shorthands

- `#console` → `@logtape/logtape#getConsoleSink`
- `#stream` → `@logtape/logtape#getStreamSink`
- `#text` → `@logtape/logtape#getTextFormatter`
- `#ansiColor` → `@logtape/logtape#getAnsiColorFormatter`
- `#jsonLines` → `@logtape/logtape#getJsonLinesFormatter`
- `#logfmt` → `@logtape/logtape#getLogfmtFormatter`

## Sinks

```json
{
  "sinks": {
    "console": { "type": "#console()" },
    "file": { "type": "@logtape/file#getFileSink()", "path": "/var/log/app.log" }
  }
}
```

## Formatters

```json
{
  "sinks": {
    "console": {
      "type": "#console()",
      "formatter": { "type": "#ansiColor()", "timestamp": "date-time-tz" }
    },
    "file": {
      "type": "@logtape/file#getFileSink()",
      "path": "/var/log/app.log",
      "formatter": "#jsonLines()"
    }
  }
}
```

## Loggers

```json
{
  "loggers": [
    { "category": ["myapp"], "sinks": ["console", "file"], "lowestLevel": "info" },
    { "category": ["myapp", "database"], "lowestLevel": "debug" }
  ]
}
```

## Error handling

By default, `configureFromObject()` throws `ConfigError` on invalid config. Use
`onInvalidConfig: "warn"` to keep the valid parts and log warnings to the meta
logger (`["logtape", "meta"]`):

```typescript
await configureFromObject(config, { onInvalidConfig: "warn" });
```

## Implicit context support (since 2.2.0)

Pass `contextLocalStorage` to enable implicit contexts (see `core-contexts.md`):

```typescript
await configureFromObject(config, { contextLocalStorage: new AsyncLocalStorage() });
```

## Reset / reconfiguration

Add `"reset": true` at the top level to reset before applying (equivalent to
`configure({ reset: true, ... })`).

## Environment-variable expansion

`expandEnvVars()` expands `${VAR}` and `${VAR:default}` before configuring:

```typescript
import { configureFromObject, expandEnvVars } from "@logtape/config";

const expanded = expandEnvVars(config);
await configureFromObject(expanded);
```

```json
{
  "sinks": {
    "file": { "type": "@logtape/file#getFileSink()", "path": "${LOG_PATH:/var/log/app.log}" }
  }
}
```

## Custom shorthands

Register your own shorthand names:

```typescript
await configureFromObject(config, {
  shorthands: {
    sinks: {
      file: "@logtape/file#getFileSink",
      rotating: "@logtape/file#getRotatingFileSink",
      custom: "./my-sinks#getCustomSink",
    },
    formatters: { pretty: "@logtape/pretty#getPrettyFormatter" },
  },
});
```

Then `{ "type": "#file()", "path": "…" }` resolves to your registered factory.

## Module resolution notes

- **Package names** (`@logtape/file`) work if installed in `node_modules`.
- **Absolute paths** / `file://` URLs work.
- **Relative paths** (`./my-sink.ts`) resolve relative to the `@logtape/config`
  package file — usually not what you want. Prefer absolute paths, package
  names, or custom shorthands.
