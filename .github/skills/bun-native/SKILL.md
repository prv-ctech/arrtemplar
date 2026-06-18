---
name: bun-native
description: |
  Bun runtime and server-tooling skill for this repo. Use when replacing Node-style server utilities with Bun-native APIs in backend code, CLI scripts, workers, subprocesses, file IO, or server-side caching. Do not use it for route design, database schema design, or browser/UI code.

  USE THIS SKILL WHEN THE USER:
  - Replaces Node-style server utilities with Bun-native APIs
  - Writes or refactors CLI scripts, workers, cron jobs, or subprocess code
  - Implements Bun file IO, Bun Shell, Bun.password, Bun Redis client usage
  - Reviews backend or tooling code for Bun-native compliance
  - Optimizes server-side runtime or memory behavior without changing the app architecture
  - Uses Bun test runner features (bun:test, parallel, isolate, shard, changed)
  - Works with Bun-native parsers (TOML, YAML, JSON5, JSONL, Markdown, HTML)
  - Implements Bun-native hashing, crypto, or password utilities
  - Uses Bun FFI, transpiler, or C compiler features
  - Works with Bun.Glob, Bun.semver, Bun.color, or Bun utilities
  - Configures Bun environment variables, DNS, or networking (UDP, TCP)
  - Uses Bun.SQLite, Bun.SQL, or Bun.Archive
  - Processes images with Bun.Image (resize, convert, generate thumbnails)
  - Uses HTTP/2 or HTTP/3 client features, QUIC, or advanced fetch protocols
  - Needs process lifecycle control (--no-orphans, process.execve)
  - Uses fs.watch for file system monitoring

  CORE PATTERNS:
  - Elysia is the HTTP backbone: never use Bun.serve() or Bun WebSocket server for app routes
  - Drizzle + postgres is the database: never use bun:sqlite or Bun.SQL for app data
  - Prefer Bun.env over process.env in server code
  - Prefer Bun.file()/Bun.write() over node:fs in server/tooling code
  - Prefer Bun.spawn()/Bun Shell over child_process
  - Prefer Bun.password.hash()/verify() over bcrypt/argon2 packages
  - Prefer Bun.randomUUIDv7() over crypto.randomUUID() for server IDs
  - Prefer Bun.sleep() over setTimeout-based async waits
compatibility:
  - github-copilot
  - claude-code
  - openai-codex
license: MIT
metadata:
  author: arrbit
  version: "1.3.14"
---

# Bun Native — Agent Instruction Set

> **This file is a map, not the territory.** All detailed API patterns, prohibited patterns with rationale, code examples, version compatibility notes, and compliance rules live exclusively in the `references/` directory. This file tells you WHICH reference to read for which task. **Do not write Bun-native code until you have read the relevant reference file(s).**

---

## How to Use This Skill

1. **Identify the task** from the `USE THIS SKILL WHEN` list above.
2. **Read the matching reference file** from the index below. Each covers a specific Bun API area.
3. **Always start with `core-preflight.md`** before making changes — it has the preflight checklist.
4. **Read `core-prohibited.md`** first to avoid introducing prohibited patterns.
5. **Cross-reference** when needed. For example: a CLI tool with file IO and shell scripting → `core-preflight.md` + `io-file-ops.md` + `rt-shell.md`.

---

## Reference File Index

### 🧠 Start Here

| File | Purpose |
|------|---------|
| **[core-preflight.md](references/core-preflight.md)** | Preflight checklist before making any changes. **READ FIRST.** |
| **[core-prohibited.md](references/core-prohibited.md)** | Prohibited patterns and anti-patterns. Never use `Bun.serve()` for app routes, never use `bun:sqlite` for app data. |
| **[perf-native-basics.md](references/perf-native-basics.md)** | Native utility mapping (Node → Bun equivalents) and version compatibility notes. |
| **[net-elysia.md](references/net-elysia.md)** | Elysia boundary — what Bun does NOT handle in this repo. |

### 🌐 Networking

| File | Purpose |
|------|---------|
| **[net-dns.md](references/net-dns.md)** | DNS caching, prefetch, and configuration with `bun --dns`. |
| **[net-udp.md](references/net-udp.md)** | UDP sockets with `Bun.udpSocket()`. |
| **[net-tcp.md](references/net-tcp.md)** | TCP sockets with `Bun.listen()`/`Bun.connect()`. |
| **[net-fetch.md](references/net-fetch.md)** | Extended `fetch()` API with Bun additions (proxy, Unix sockets, custom TLS). |
| **[net-websockets.md](references/net-websockets.md)** | WebSocket client (server-side WebSocket uses Elysia, not Bun). |

### ⚙️ Runtime Features

| File | Purpose |
|------|---------|
| **[rt-workers.md](references/rt-workers.md)** | Worker threads and concurrency with `Bun.spawn()` workers. |
| **[rt-cron.md](references/rt-cron.md)** | `Bun.cron()` for standalone machine-level jobs (API jobs use `@elysiajs/cron`). |
| **[rt-webview.md](references/rt-webview.md)** | Headless browser automation for testing. |
| **[rt-shell.md](references/rt-shell.md)** | Bun Shell (`$`) for scripting, builtin commands, and output handling. |
| **[rt-env.md](references/rt-env.md)** | `Bun.env`, `.env` loading, and environment configuration. |
| **[rt-ffi.md](references/rt-ffi.md)** | FFI, C compiler (`bun build --compile`), and native interop. |
| **[rt-transpiler.md](references/rt-transpiler.md)** | `Bun.Transpiler` for programmatic transpilation. |
| **[rt-csrf.md](references/rt-csrf.md)** | CSRF token generation and verification with `Bun.password`. |
| **[rt-secrets.md](references/rt-secrets.md)** | OS-native credential storage integration. |
| **[rt-console.md](references/rt-console.md)** | Console extensions (depth, `console.write`, async iterable). |

### 📄 Data Parsers

| File | Purpose |
|------|---------|
| **[rt-toml.md](references/rt-toml.md)** | TOML parsing, import, and bundler support. |
| **[rt-yaml.md](references/rt-yaml.md)** | YAML parsing, import, and bundler support. |
| **[rt-markdown.md](references/rt-markdown.md)** | Markdown to HTML/ANSI/React rendering. |
| **[rt-json5.md](references/rt-json5.md)** | JSON5 parsing and stringify. |
| **[rt-jsonl.md](references/rt-jsonl.md)** | JSONL parsing and streaming. |
| **[rt-html-rewriter.md](references/rt-html-rewriter.md)** | `HTMLRewriter` streaming transformation. |

### 🔐 Crypto & Hashing

| File | Purpose |
|------|---------|
| **[rt-hashing.md](references/rt-hashing.md)** | `Bun.password`, `Bun.hash`, `Bun.CryptoHasher`, SHA3 support. |
| **[rt-crypto-webcrypto.md](references/rt-crypto-webcrypto.md)** | WebCrypto and `node:crypto` with SHA3, X25519. |

### 💾 File I/O & Storage

| File | Purpose |
|------|---------|
| **[io-file-ops.md](references/io-file-ops.md)** | `Bun.file()`, `Bun.write()`, `FileSink` — prefer over `node:fs`. |
| **[rt-image.md](references/rt-image.md)** | `Bun.Image` — built-in image processing pipeline (JPEG, PNG, WebP, GIF, BMP, HEIC, AVIF, TIFF). |
| **[rt-archive.md](references/rt-archive.md)** | Tar/tar.gz archive creation and extraction. |
| **[rt-streams.md](references/rt-streams.md)** | `ReadableStream`, direct streams, `ArrayBufferSink`. |
| **[rt-binary-data.md](references/rt-binary-data.md)** | `ArrayBuffer`, `TypedArray`, `Buffer`, `Blob`, `BunFile`. |
| **[storage-drizzle.md](references/storage-drizzle.md)** | Drizzle + postgres boundary — no `bun:sqlite` for app data. |
| **[rt-sqlite.md](references/rt-sqlite.md)** | `bun:sqlite` — tooling only, not app data. |
| **[rt-sql.md](references/rt-sql.md)** | `Bun.SQL` — tooling only, not app data. |

### 🛠 Utilities

| File | Purpose |
|------|---------|
| **[rt-glob.md](references/rt-glob.md)** | Glob pattern matching and file scanning with `Bun.Glob`. |
| **[rt-semver.md](references/rt-semver.md)** | Semver comparison (~20x faster than node-semver). |
| **[rt-color.md](references/rt-color.md)** | Color conversion (CSS, ANSI, hex, RGB, HSL). |
| **[rt-utils.md](references/rt-utils.md)** | General utilities: `Bun.sleep()`, `Bun.randomUUIDv7()`, `Bun.inspect()`. |

### 🧪 Testing & Subprocesses

| File | Purpose |
|------|---------|
| **[test-native.md](references/test-native.md)** | `bun:test` runner: parallel tests, isolate, shard, changed files. |
| **[sys-subprocesses.md](references/sys-subprocesses.md)** | `Bun.spawn()` and `Bun.spawnSync()` — prefer over `child_process`. |

---

## Agent Behavioral Rules

1. **Never write Bun-native code from memory.** Always read the relevant reference file(s) first. Also read `core-prohibited.md` to avoid banned patterns.

2. **Elysia is the HTTP backbone.** Never use `Bun.serve()` or Bun WebSocket server for application routes. Bun server APIs are only for isolated test probes.

3. **Drizzle + postgres is the database.** Never use `bun:sqlite` or `Bun.SQL` for application data. SQLite is tooling-only.

4. **Prefer Bun-native equivalents over Node APIs.** `Bun.env` over `process.env`, `Bun.file()`/`Bun.write()` over `node:fs`, `Bun.password` over `bcrypt`, `Bun.randomUUIDv7()` over `crypto.randomUUID()`, `Bun.sleep()` over `setTimeout`-based waits.

5. **Browser code must be free of Bun APIs.** `src/app/` must never import from `bun:` or use Bun globals.
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

process.env.API_KEY;
await new Promise((resolve) => setTimeout(resolve, 1000));
crypto.randomUUID();
await bcrypt.hash(password, 10);
const server = Bun.serve({ fetch() { ... } }); // for app routes

// Correct
const config = await Bun.file("config.json").json();
const proc = Bun.spawn(["bun", "run", "build"]);

const apiKey = Bun.env.API_KEY;
await Bun.sleep(1000);
const id = Bun.randomUUIDv7();
const hash = await Bun.password.hash(password);
const app = new Elysia().get("/", () => "ok").listen(3000); // Elysia for HTTP
```

### Repo-Approved Bun Replacements

| Current Pattern | Bun / Repo Alternative |
|---|---|
| `process.env.FOO` in server code | `Bun.env.FOO` |
| `setTimeout`-based async waits/backoff | `await Bun.sleep(ms)` |
| `crypto.randomUUID()` for server IDs | `Bun.randomUUIDv7()` |
| `bcrypt` / `argon2` for password hashing | `Bun.password.hash()` / `.verify()` |
| `node:fs` reads and writes | `Bun.file()` / `Bun.write()` |
| `child_process.spawn` / `exec` | `Bun.spawn()` or `import { $ } from "bun"` |
| Latency timing with `Date.now()` deltas | `Bun.nanoseconds()` for hot paths |
| Redis libraries for Valkey | `RedisClient` from `bun` |
| `zlib.gzip()` response compression | `Bun.gzipSync()` / `Bun.gzip()` |
| `marked` / `markdown-it` for CLI output | `Bun.markdown.ansi()` or `bun ./file.md` |
| `toml` / `smol-toml` packages | `Bun.TOML.parse()` / `import from "./file.toml"` |
| `yaml` / `js-yaml` packages | `Bun.YAML.parse()` / `import from "./file.yaml"` |
| `json5` package | `Bun.JSON5.parse()` / `import from "./file.json5"` |
| `string-width` / `strip-ansi` packages | `Bun.stringWidth()` / `Bun.stripANSI()` |
| `glob` / `fast-glob` packages | `new Glob("**/*.ts").scan()` |
| `semver` package | `Bun.semver.satisfies()` / `Bun.semver.order()` |
| `slice-ansi` / `cli-truncate` packages | `Bun.sliceAnsi()` |
| Manual CSRF token generation | `Bun.CSRF.generate()` / `Bun.CSRF.verify()` |
| `sharp` / `jimp` for server image processing | `Bun.Image` — built-in chainable pipeline |
| `node:fs` watch / `chokidar` for file watching | `fs.watch()` with rewritten OS-native backend |

### Bun 1.3.14 Highlights

- **`Bun.Image`**: Built-in image processing (JPEG, PNG, WebP, GIF, BMP, HEIC, AVIF, TIFF). Chainable pipeline: `.resize()`, `.rotate()`, `.flip()`, `.webp()`, `.jpeg()`, `.png()`. Drop-in sharp alternative with zero native module installs.
- **HTTP/3 (QUIC) in `Bun.serve`**: Experimental server-side HTTP/3 alongside HTTP/1.1 and HTTP/2. Enable with `http3: true` + TLS.
- **Experimental HTTP/2 client for `fetch()`**: Multiplexed connections, connection coalescing, per-request protocol control via `{ protocol: "http2" }`.
- **Experimental HTTP/3 client for `fetch()`**: QUIC-based fetch with `{ protocol: "http3" }`. Alt-Svc automatic upgrades supported.
- **Global Virtual Store**: `bun install --linker=isolated` with `globalStore = true` in `bunfig.toml`. ~7x faster warm installs via symlinks instead of file clones.
- **Rewritten `fs.watch()` backend**: Direct OS API integration (inotify/FSEvents/kqueue). Fixes recursive watching, deleted-and-recreated files, macOS thread overhead.
- **`--no-orphans`**: Auto-exit when parent process dies (even on `SIGKILL`). Recursive `SIGKILL` of all descendants. Linux/macOS only.
- **`process.execve()`**: POSIX syscall to replace current process image in-place. Matches Node.js v24 API.
- **`Bun.Terminal` on Windows**: ConPTY-powered pseudoterminal support on Windows.
- **`using` / `await using` native in Bun target**: No longer transpiled to helper calls when targeting Bun (`bun run`, `Bun.Transpiler({ target: "bun" })`, `bun build --target=bun`).
- **Shared `SSL_CTX` cache**: All TLS APIs share one native `SSL_CTX` per identical config. Fixes memory leaks in MongoDB, Mongoose, Postgres pools, Redis, `tls.connect()`.
- **Cross-language LTO** (Linux): Zig ↔ C++ link-time optimization. 3.5% faster HTTP throughput, 6.5% faster `Bun.escapeHTML`.
- **Faster ESM module loading**: ~12% faster by eliminating struct copy overhead during transpilation.
- **Reduced GC overhead**: Eliminated redundant re-scanning of ~63 built-in object types during incremental GC.
- **Smaller binary**: -6 to -18 MB across Linux and Windows builds.
- **70+ Bun Shell bug fixes**: `cd`, `[[ -f ]]`, tilde expansion, path handling.
- **`bun publish` README metadata**: Automatically finds and sends README contents to npm registry.
- **SQLite 3.53.0**: Updated built-in SQLite with new config options.
- **FreeBSD and Android support**: First-party native builds.

### Bun 1.3.13 Highlights

- **`bun test --parallel[=N]`**: Distribute test files across N worker processes with work-stealing
- **`bun test --isolate`**: Fresh global environment per test file in the same process
- **`bun test --shard=M/N`**: Split tests across CI jobs (round-robin, deterministic)
- **`bun test --changed` / `--changed=REF`**: Only run tests affected by git changes
- **`bun install` streaming extraction**: 17x less memory, streams tarballs to disk while downloading
- **Source maps use 8x less memory**: Bit-packed binary format at ~2.4 bytes/mapping
- **5.5x faster gzip** via zlib-ng 2.3.3 (SIMD-accelerated)
- **SHA3-224/256/384/512** in WebCrypto and node:crypto
- **X25519 deriveBits** in SubtleCrypto
- **5% less runtime memory** from mimalloc v3 + libpas scavenger
- **`ws+unix://` WebSocket client**: Unix domain socket support
- **Range requests** in Bun.serve() (automatic 206 Partial Content)
- **1.43x faster array iteration** in Bun internals
- **Isolated linker** for `bun install --linker=isolated` (8.5x faster in peer-heavy monorepos)
- **JSC upgrade**: 1,316 upstream commits with IC, JIT, SIMD, and Wasm improvements

### Bun 1.3.12 Highlights

- **Bun.WebView**: Native headless browser automation (WebKit on macOS, Chrome cross-platform)
- **`Bun.markdown.ansi()`**: Markdown to ANSI-colored terminal output
- **`bun ./file.md`**: Render Markdown files directly in terminal
- **In-process `Bun.cron(schedule, handler)`**: Disposable, no-overlap, UTC, --hot safe
- **Async stack traces** for native APIs (node:fs, Bun.write, node:http, node:dns)
- **2.3x faster URLPattern**, **2x faster Bun.Glob.scan()**, **11x faster Bun.stringWidth**
- **Cgroup-aware parallelism** on Linux (Docker/K8s CPU limits respected)
- **TCP_DEFER_ACCEPT** for Bun.serve() on Linux
- **`using` / `await using`** native support in JavaScriptCore
- **Improved standalone executables** on Linux (ELF section embedding)

### Bun 1.3.11 Highlights

- **4 MB smaller** on Linux x64
- **`Bun.cron` OS-level**: crontab/launchd/Task Scheduler registration
- **`Bun.sliceAnsi`**: ANSI and grapheme-aware string slicing
- **`Bun.cron.parse()`**: Cron expression parsing to next fire Date
- **`--path-ignore-patterns`**: Exclude test files by glob pattern
- **Native Windows ARM64** .bin shim

### Browser Boundary

```typescript
// src/server/feature.ts - Server uses Bun APIs
const file = Bun.file("./public/manifest.json");

// src/app/component.tsx - UI stays on Web APIs
const data = await fetch("/api/db");
```

---

## File Organization

```text
.agents/skills/bun-native/
├── SKILL.md
└── references/
    ├── core-*.md          # Preflight and prohibited patterns
    ├── perf-*.md          # Performance and native mapping
    ├── net-*.md           # Networking (DNS, UDP, TCP, fetch, websockets, Elysia)
    ├── rt-*.md            # Runtime features (workers, cron, shell, parsers, etc.)
    ├── io-*.md            # File I/O operations
    ├── storage-*.md       # Storage boundaries (Drizzle, SQLite, SQL)
    ├── test-*.md          # Testing (bun:test runner)
    └── sys-*.md           # Subprocess management (legacy, see rt-shell.md)
```
