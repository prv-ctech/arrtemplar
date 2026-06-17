# Rule: rt-shell

## Rationale

Bun Shell (`import { $ } from "bun"`) provides a cross-platform, safe shell scripting API. It replaces bash scripts, child_process, and shell utility packages.

## API: `import { $ } from "bun"`

```typescript
import { $ } from "bun";

await $`echo "Hello World!"`;
const text = await $`echo "Hello"`.text();
const { stdout, stderr } = await $`echo "Hello!"`.quiet();
```

## Features

- **Cross-platform**: Windows, Linux, macOS
- **Bash-like syntax**: redirection, pipes, env vars, globs, brace expansion
- **Safe interpolation**: All interpolated strings escaped by default (prevents command injection)
- **JavaScript interop**: `Response`, `ArrayBuffer`, `Blob`, `Bun.file()` as stdin/stdout/stderr
- **Custom builtin commands**: `cd`, `ls`, `rm`, `echo`, `pwd`, `cat`, `touch`, `mkdir`, `which`, `mv`, `exit`, `true`, `false`, `yes`, `seq`, `dirname`, `basename`

## Output Capture

```typescript
const text = await $`echo "Hello"`.text();
const json = await $`cat package.json`.json();
for await (const line of $`cat list.txt`.lines()) { console.log(line); }
const blob = await $`echo "Hello"`.blob();
```

## Redirection

```typescript
await $`echo bun! > greeting.txt`;
await $`cat < ${response}`;
await $`echo "log entry" >> app.log`;
await $`command 2>&1`;
```

## Piping

```typescript
await $`echo "Hello World!" | wc -w`;
await $`cat < ${response} | wc -w`;
```

## Command Substitution

```typescript
await $`echo Hash: $(git rev-parse HEAD)`;
await $`REV=$(git rev-parse HEAD) && docker build -t myapp:$REV`;
```

## Environment & Working Directory

```typescript
await $`echo $FOO`.env({ ...Bun.env, FOO: "bar" });
$.env({ FOO: "bar" }); // global default
await $`pwd`.cwd("/tmp");
$.cwd("/tmp"); // global default
```

## Error Handling

```typescript
try {
  await $`exit 1`;
} catch (err) {
  console.log(err.exitCode, err.stderr.toString());
}

const { exitCode } = await $`maybe-fail`.nothrow();
$.nothrow(); // global default
$.throws(false); // alias
```

## Utilities

```typescript
$.braces("echo {1,2,3}"); // ["echo 1", "echo 2", "echo 3"]
$.escape('$(foo) `bar` "baz"'); // escaped version
await $`echo ${{ raw: '$(foo)' }}`; // unescaped raw string
```

## .sh File Loader

```bash
bun ./script.sh  # uses Bun Shell instead of /bin/sh
```

## Guidelines

- **PREFER $ OVER child_process**: Use `import { $ } from "bun"` for shell scripting
- **SAFE INTERPOLATION**: Interpolated values are automatically escaped — no injection risk
- **CROSS-PLATFORM**: Works on Windows without bash
- **CAVEAT**: Explicitly spawning a new shell (`bash -c`) bypasses protections
- **COMMAND SUBSTITUTION**: Use `$(...)` syntax, not backticks inside template literals
