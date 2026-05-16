# Rule: perf-native-basics

## Rationale

Bun already covers a number of utility jobs that this repo would otherwise solve with Node built-ins or extra packages. Prefer the Bun-native choice when it directly replaces that utility layer without fighting the rest of the architecture.

## Utility Mapping

| Current Pattern                             | Bun / Repo Alternative              | Why it fits here                             |
| :------------------------------------------ | :---------------------------------- | :------------------------------------------- |
| `process.env.FOO` in server code            | `Bun.env.FOO`                       | Repo standard for Bun runtime env access     |
| `await new Promise(setTimeout...)`          | `await Bun.sleep(ms)`               | Cleaner polling, backoff, and retry loops    |
| `crypto.randomUUID()` for server identifiers | `Bun.randomUUIDv7()`                | Sortable IDs and schedule tokens             |
| `bcrypt` or `argon2` for passwords          | `Bun.password.hash()` / `.verify()` | Repo already uses this for auth              |
| `node:fs` reads and writes                  | `Bun.file()` / `Bun.write()`        | Better fit for static assets and logs        |
| `child_process` utilities                   | `Bun.spawn()` / `import { $ } from "bun"` | Native subprocess control                |
| Hot-path elapsed timing                     | `Bun.nanoseconds()`                 | Higher-resolution latency measurement        |
| Redis libraries for Valkey                  | `RedisClient` from `bun`            | Matches current cache and health-check code  |
| `zlib.gzip()` response compression          | `Bun.gzipSync()` / `Bun.gzip()`     | Matches current server compression plugin    |
| Markdown-to-terminal rendering              | `Bun.markdown.ansi(markdown, opts)` | Built-in ANSI rendering, no extra deps       |
| `marked` / `markdown-it` for CLI output     | `Bun.markdown.ansi()` or `bun ./file.md` | Zero-dependency terminal Markdown      |
| Headless browser testing libraries          | `Bun.WebView` (WebKit / Chrome)     | Native browser automation built into runtime |

## Bun 1.3.14 Notes That Matter Here

- **`Bun.Image`**: Built-in image processing replaces `sharp` / `jimp` for server-side transforms. Zero native module installs. Chainable pipeline with `.resize()`, `.rotate()`, `.flip()`, `.webp()`, `.jpeg()`, `.png()`. See `rt-image.md`.
- **HTTP/3 server**: `Bun.serve({ http3: true, tls: { ... } })` — experimental QUIC support alongside HTTP/1.1 and HTTP/2. Not for production yet.
- **HTTP/2 client**: `fetch(url, { protocol: "http2" })` — experimental multiplexed TLS connections with connection coalescing.
- **HTTP/3 client**: `fetch(url, { protocol: "http3" })` — experimental QUIC-based fetch with Alt-Svc auto-upgrade.
- **Global Virtual Store**: `bun install --linker=isolated` with `install.globalStore = true` in `bunfig.toml`. ~7x faster warm installs via symlinks instead of file clones.
- **`fs.watch()` rewritten**: Direct OS API integration fixes recursive directory tracking, deleted-and-recreated files, and macOS double-thread overhead.
- **`--no-orphans`**: `bun run --no-orphans` or `[run] noOrphans = true` in `bunfig.toml`. Auto-exits when parent dies (even `SIGKILL`), recursively kills descendants.
- **`process.execve()`**: POSIX syscall to replace current process image. Matches Node.js v24 API.
- **`using` / `await using` native**: No longer transpiled when targeting Bun (`bun run`, `--target=bun`, `--compile`). JavaScriptCore natively supports Explicit Resource Management.
- **Shared `SSL_CTX` cache**: All TLS APIs share one native context per identical config. Fixes memory leaks in MongoDB, Mongoose, Postgres pools, Redis, `tls.connect()`.
- **Cross-language LTO** (Linux): Zig ↔ C++ link-time optimization. 3.5% faster HTTP throughput, 6.5% faster `Bun.escapeHTML`.
- **Faster ESM loading**: ~12% faster module loading by eliminating struct copy overhead during transpilation.
- **Reduced GC overhead**: Eliminated redundant re-scanning of ~63 built-in object types during incremental GC.
- **Smaller binary**: -6 to -18 MB across Linux and Windows builds.
- **70+ Bun Shell bug fixes**: `cd`, `[[ -f ]]`, tilde expansion, path handling hardened.
- **`bun publish` README metadata**: Automatically finds and sends README to npm registry API.
- **SQLite 3.53.0**: Updated built-in SQLite.
- **FreeBSD and Android support**: First-party native builds.
- **Framework boundary still stands**: Bun 1.3.14 server improvements do NOT justify replacing Elysia.

## Bun 1.3.13 Notes That Matter Here

- **Test parallelism**: `bun test --parallel[=N]` distributes test files across N worker processes with work-stealing.
- **Test isolation**: `bun test --isolate` runs each test file in a fresh global environment within the same process.
- **Test sharding**: `bun test --shard=M/N` splits tests deterministically across CI jobs.
- **Test changed**: `bun test --changed[=REF]` only runs tests affected by git changes.
- **Streaming install**: `bun install` now streams tarballs to disk (17x less memory).
- **Source maps**: 8x less memory via bit-packed binary format (~2.4 bytes/mapping).
- **Faster gzip**: zlib-ng 2.3.3 provides up to 5.5x faster gzip compression.
- **SHA3 support**: SHA3-224/256/384/512 in WebCrypto and `node:crypto`.
- **X25519 deriveBits**: Full key agreement in SubtleCrypto.
- **5% less runtime memory**: mimalloc v3 + libpas scavenger improvements.
- **1.43x faster array iteration**: Internal JSC butterfly memory access.
- **Isolated linker**: `bun install --linker=isolated` is 8.5x faster in peer-heavy monorepos.
- **Range requests**: `Bun.serve()` auto-handles `Range` headers for file-backed responses.
- **`ws+unix://`**: WebSocket client supports Unix domain sockets.
- **Framework boundary still stands**: Bun 1.3.13 includes server improvements, Range support, etc. — they do NOT justify replacing Elysia.

## Bun 1.3.12 Notes That Matter Here

- **Script orchestration**: use `bun run --parallel` or `bun run --sequential` when a repo task needs multiple scripts in one command.
- **Subprocess reliability**: `Bun.spawn()` pipe handling was hardened in 1.3.10; `bun build --compile` on Linux now embeds via ELF section, no `/proc/self/exe` at startup.
- **Test discovery control**: if vendored fixtures or submodules bring extra test files, prefer `test.pathIgnorePatterns` in `bunfig.toml` over ad-hoc runner wrappers.
- **Framework boundary still stands**: Bun 1.3.12 includes server/runtime fixes, `TCP_DEFER_ACCEPT` on Linux, and `Bun.serve()` perf improvements — they do not justify replacing Elysia in app code.
- **Cgroup-aware parallelism**: thread pool and JIT threads now respect Docker/K8s CPU limits on Linux. No config needed.
- **Automatic engine wins**: `URLPattern` (up to 2.3x), `Bun.Glob.scan()` (up to 2x), `Bun.stripANSI` / `Bun.stringWidth` (up to 11x on some inputs), `bun build` (up to 1.47x on low-core machines) — all automatic, no code churn required.
- **Do not overreact to runtime micro-benchmarks**: many engine wins are automatic. They do not require code changes unless they enable a cleaner Bun-native API you already need.

## Performance Note

Do not replace Elysia, Drizzle, or the `postgres` driver with lower-level Bun primitives just for theoretical speed. Prefer Bun-native helpers around those tools, not instead of them.
