---
name: "Code Quality & Architecture"
description: "Use when writing, reviewing, or refactoring any code. Enforces no dead code, no duplication, no overengineering, no wrappers, and no workarounds."
applyTo: "**"
---

## No Secrets hardcoded

No secrets, credentials, or sensitive information should be hardcoded in the codebase. Use environment variables or secure vaults for sensitive data.

- the only exception is .secrets/credentials.txt which is ignored by git and used for local development only.

## No God Files

Files should have a single responsibility. If a file is too large, split it into smaller files.

- If a file is over 1000 lines, consider splitting it into multiple files.
- If a file has multiple responsibilities, consider splitting it into multiple files.

## No Dead Code

Remove confirmed-unused logic immediately. Do not leave it commented out, flagged, or sitting in the file.

- If you **confirm** a code path, export, type, function, component, or file is **100% unused**, **delete it**.
- If unsure, search for references. None found = dead. Remove it.
- **Inform the user** why the code was removed.
- Do **not** leave dead code as comments, disabled branches, or feature flags unless the user explicitly requests one.

---

## No Duplicate Code

**Single source of truth** for every piece of logic. Do not copy, reimplement, or fork existing functionality.

- **Frontend**: Import existing components, utilities, hooks, or styles. Generalize the original instead of creating a second version.
- **Backend**: Use existing queries, validations, middleware, or utilities. No parallel implementations.
- **Database**: Follow existing schema, migration, and query patterns. No second way to do the same thing.
- **Config**: Reference existing constants, env vars, or config values. No hardcoded duplicates.

When you find duplication: consolidate into one shared location, update all callers, delete the duplicates.

---

##  No Overengineered Code

Prefer the simplest approach that correctly solves the problem. Minimal, readable code wins.

- Ask: "Is there a simpler way to achieve the exact same result?" If yes, use it.
- Do not add abstraction layers (factories, strategies, decorators, complex generics) until the code genuinely needs them.
- Do not handle hypothetical future requirements. Solve the problem in front of you.
- Favor flat logic over nested conditionals. Favor clear imperative code over design patterns for simple operations.
- If a 5-line function replaces a 50-line class, use the function.

---

##  No Wrappers — Use Native Tools & Official Plugins

Do not wrap a library to "make it work." Use the library's native API or an **official/maintained plugin**.

- **Elysia**: Native guards, plugins, hooks, schema. No custom middleware wrappers around Elysia internals.
- **Bun**: Bun-native APIs (`Bun.file`, `Bun.password`, `Bun.serve`, etc.). No custom Bun abstractions.
- **Drizzle ORM**: Drizzle query syntax, relations, `drizzle-kit` for migrations. No custom SQL builder or Drizzle wrapper.
- **LogTape**: Native sinks, categories, log levels. No custom logging class wrapper.
- **Framework plugins**: Official plugins (`@elysiajs/cors`, `@elysiajs/swagger`, `@elysiajs/jwt`). No custom wrappers.

**Exception**: Only if the user explicitly says "create a wrapper for X" or there is **no other way** to achieve interop. If you add a wrapper, explain why.

---

##  No Workarounds — Fix the Root Cause

Never patch around a problem. Identify and resolve the root cause.