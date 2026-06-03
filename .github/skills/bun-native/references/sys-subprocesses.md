# Rule: sys-subprocesses

## Rationale

`Bun.spawn()` and Bun Shell (`$`) are the default subprocess tools for this repo. Bun 1.3.10 hardened pipe handling and 1.3.12 improved standalone executables on Linux.

## Guidelines

- **PROCESS**: Use `Bun.spawn()` for structured subprocess control.
- **SHELL**: Use built-in shell only when shell syntax is actually the clearest solution.
- **ENV**: Pass environment overrides through `env: { ...Bun.env, FOO: "bar" }`.
- **MULTI-SCRIPT WORKFLOWS**: Use `bun run --parallel` or `bun run --sequential` when one repo task should orchestrate multiple package scripts.
- **LONG-LIVED HELPERS**: `Bun.spawn()` with piped stdio is a reliable default for helper processes that need programmatic control.
- **STANDALONE EXECUTABLES**: `bun build --compile` on Linux now embeds the module graph via a proper ELF section (`.bun`). Binaries work with `chmod 111` (execute-only) and need zero file I/O at startup. No more dependency on `/proc/self/exe`.
- **NIXOS / GUIX PORTABILITY**: Compiled binaries now have `PT_INTERP` normalized back to standard FHS paths, making them portable across Linux systems including NixOS.
- **`--no-orphans`**: Use `bun run --no-orphans` or `[run] noOrphans = true` in `bunfig.toml` when Bun is launched by a supervisor (Electron, CI runner) that may be force-killed. Bun exits when its parent dies (even on `SIGKILL`) and recursively `SIGKILL`s all descendants. Inherited by nested Bun processes. Linux/macOS only.
- **`process.execve()`**: Use `process.execve(execPath, args, env)` to replace the current process image in-place (never returns on success). stdio inherited, signal mask reset. Throws `ERR_WORKER_UNSUPPORTED_OPERATION` from worker threads, `ERR_FEATURE_UNAVAILABLE_ON_PLATFORM` on Windows.

## Examples

### Correct (Shell)

```typescript
import { $ } from "bun";
const output = await $`ls *.ts`.text();
```

### Correct (Spawn)

```typescript
const proc = Bun.spawn(["bun", "run", "postgres:check"]);
const text = await new Response(proc.stdout).text();
```

### Correct (Parallel Script Orchestration)

```bash
bun run --parallel build:css build:js
bun run --sequential postgres:check test:pg
```
