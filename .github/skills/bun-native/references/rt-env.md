# Rule: rt-env

## Rationale

Bun automatically loads `.env` files and provides multiple env access APIs. `Bun.env` is the preferred way to access environment variables in server code.

## Automatic .env Loading

Files loaded in order of increasing precedence:
1. `.env`
2. `.env.production` / `.env.development` / `.env.test` (based on `NODE_ENV`)
3. `.env.local`

## Access APIs

```typescript
Bun.env.API_TOKEN;         // preferred in server code
process.env.API_TOKEN;     // alias (Node.js compat)
import.meta.env.API_TOKEN; // alias
```

## Setting Variables

```typescript
Bun.env.FOO = "hello";
```

Command line: `FOO=helloworld bun run dev`

## Manual .env File

```bash
bun --env-file=.env.1 src/index.ts
bun --env-file=.env.abc --env-file=.env.def run build
```

## Disable .env Loading

```bash
bun run --no-env-file index.ts
```

Or in `bunfig.toml`:

```toml
env = false
```

## Variable Expansion

```ini
FOO='hello'
BAR=hello$FOO        # expanded to "helloworld"
BAR=hello\$FOO       # escaped, literal "hello$FOO"
```

No `dotenv` or `dotenv-expand` packages needed.

## TypeScript Typed Variables

```typescript
declare module "bun" {
  interface Env {
    DATABASE_URL: string;
    API_TOKEN: string;
  }
}
// Now: Bun.env.DATABASE_URL is string (not string | undefined)
```

## Configuration Variables

| Variable | Description |
|----------|-------------|
| `BUN_CONFIG_DNS_TIME_TO_LIVE_SECONDS` | DNS cache TTL (default: 30) |
| `BUN_CONFIG_MAX_HTTP_REQUESTS` | Max concurrent fetch requests (default: 256) |
| `BUN_CONFIG_VERBOSE_FETCH` | `=curl` logs fetch headers |
| `BUN_RUNTIME_TRANSPILER_CACHE_PATH` | Transpiler cache dir. `=0` disables |
| `BUN_CONFIG_NO_CLEAR_TERMINAL_ON_RELOAD` | Prevents `bun --watch` from clearing console |
| `NODE_TLS_REJECT_UNAUTHORIZED` | `=0` disables SSL validation |
| `TMPDIR` | Temp directory |
| `NO_COLOR` / `FORCE_COLOR` | Color control |
| `DO_NOT_TRACK` | `=1` disables crash reports |

## Runtime Transpiler Cache

- Caches transpiled output for files >50 KB
- Content-addressable, global, shared across projects
- Safe to delete anytime (even while Bun is running)
- Cached files use `.pile` extension
- Disabled automatically in Bun's Docker images

## Guidelines

- **PREFER Bun.env**: Use `Bun.env` over `process.env` in server code
- **TYPE YOUR ENV**: Use module augmentation for type-safe env access
- **NO DOTENV PACKAGE**: Bun handles `.env` loading natively
- **MULTI-FILE**: Use `--env-file` for multiple env files in different environments
