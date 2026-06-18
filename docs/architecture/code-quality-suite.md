# Code Quality Suite

## Tool ownership

- Fallow owns repo-wide code intelligence: dead code, dependency placement, duplication, health, and import boundaries.
- React Doctor owns React-specific diagnostics for `apps/web`; `apps/web/doctor.config.json` sets `deadCode: false` so React Doctor does not overlap Fallow's graph analysis.
- TypeScript owns type soundness, Bun owns test execution, and Biome runs last for lint/format feedback.

## Commands

```sh
bun run check:quality:code
bun run check:quality:code:full
```

- `check:quality:code` runs `fallow audit --quiet`, then a React Doctor diff scan, then typecheck, tests, and Biome.
- `check:quality:code:full` runs full-repo Fallow, full React Doctor for `apps/web`, typecheck, tests, and Biome.
- `check:code:quality` and `check:code:quality:full` are aliases for the same suites.
- React Doctor scripts set `CI=true` so normal checks scan only and never open installer prompts.

## Scope and ignores

- Fallow keeps tests in dead-code and dependency analysis so test helpers and test-only dependencies stay visible.
- Fallow excludes test files from duplication checks because test suites intentionally repeat setup and assertions when that improves readability.
- Fallow boundaries allow `apps/web` to import the server package because the Eden client consumes the server `App` type as a compile-time contract; runtime web code still uses browser-safe APIs.
- React Doctor scans only `apps/web`, ignores generated output and colocated test/fixture files, and disables its dead-code pass so Fallow remains the single source for graph findings.
- `apps/web/doctor.config.json` intentionally omits the optional remote `$schema` URL because VS Code currently reports `https://react.doctor/schema/config.json` as an untrusted schema location.
- Biome uses `biome.json` includes and still checks tests; it should not be used to hide Fallow or React Doctor findings.

## Official sources

- React Doctor config files: https://www.react.doctor/docs/configuration/config-files
- React Doctor fixing workflow and CLI: https://www.react.doctor/docs/getting-started/how-to-fix-issues and https://www.react.doctor/docs/reference/cli-reference
- Fallow adoption and configuration: https://docs.fallow.tools/adoption and https://docs.fallow.tools/configuration/overview
- Fallow dead code, duplication, boundaries, auto-fix, CSS, debugging, and limitations: https://docs.fallow.tools/analysis/dead-code, https://docs.fallow.tools/analysis/duplication, https://docs.fallow.tools/analysis/boundaries, https://docs.fallow.tools/analysis/auto-fix, https://docs.fallow.tools/analysis/css-analysis, https://docs.fallow.tools/analysis/debugging, https://docs.fallow.tools/analysis/limitations