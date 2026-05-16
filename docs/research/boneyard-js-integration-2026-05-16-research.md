# boneyard-js Integration Research

**Date:** 2026-05-16
**Context:** Evaluating `boneyard-js` (v1.8.1) for pixel-perfect skeleton screens in the arrweeb-anime stack (Bun 1.3.14 monorepo, Vite + React + TanStack Query/Router SPA, Elysia backend proxied through Vite, session-cookie auth, TypeScript strict + resolveJsonModule).

## Key Findings

### 1. What boneyard is and how it works

- **Pixel-perfect skeleton screens** extracted from your real rendered UI — no manual measurement or hand-tuned placeholders.
- **CLI** (`npx boneyard-js build`) opens a headless Playwright Chromium instance, visits your app, finds every `<Skeleton name="...">`, snapshots their DOM layout via `getBoundingClientRect()` at multiple breakpoints, and writes `.bones.json` + `registry.js` files.
- **Vite plugin** (`boneyard-js/vite`) does the same but integrates into the Vite dev server lifecycle — auto-captures on dev server start and on every HMR update. No second terminal needed.
- **React `<Skeleton>` component** at runtime reads from the registry JSON, picks the nearest breakpoint, and renders positioned/sized bone divs with pulse/shimmer/solid animation. Zero runtime DOM measurement.
- **Compact format:** Bones stored as arrays `[x, y, w, h, r]` instead of objects — smaller JSON, faster parsing. Both array and object formats supported.
- **Framework adapters:** `boneyard-js/react`, `boneyard-js/vue`, `boneyard-js/svelte`, `boneyard-js/preact`, `boneyard-js/angular`, `boneyard-js/native` (React Native).
- **Core library** (`boneyard-js`) exports low-level APIs: `snapshotBones()`, `computeLayout()`, `renderBones()`, `compileDescriptor()`.

### 2. Compatibility Verdict

| Concern | Status | Details |
|---------|--------|---------|
| **Bun 1.3.14** | ✅ Likely works | boneyard's CLI uses Playwright (Node.js library). Bun runs Node-compatible npm scripts fine. The `--env-file` flag was explicitly added for Bun runtime env support (v1.6.5 changelog). The package's own test suite runs with `bun test`. However, the Playwright browser download (`npx playwright install chromium`) must run with Node.js or Bun's Node compat layer. |
| **Vite + React** | ✅ Fully supported | boneyard has a dedicated Vite plugin (`boneyard-js/vite`) and a React adapter (`boneyard-js/react`). Peer dependency: `vite >=5` (this project uses latest, likely v6+). Peer dependency: `react >=18` (this project uses latest, likely React 19+). |
| **Vite proxy (Elysia backend)** | ✅ Compatible | The Vite plugin starts a Playwright browser that visits `http://localhost:5173` (the Vite dev server). The Vite proxy forwards `/api` and `/health` to the Elysia backend. This works transparently — boneyard sees the fully assembled frontend. |
| **TanStack Query/Router** | ✅ Compatible | boneyard doesn't interact with data-fetching or routing libraries. It only needs the DOM to be rendered. TanStack Query's `isLoading` state is what drives `loading={isLoading}` on `<Skeleton>`. |
| **Session-cookie auth** | ✅ Supported | See section 5 below. |
| **TypeScript strict + resolveJsonModule** | ✅ Fixed in v1.8.1 | v1.7.9 had `TS2322` errors importing `.bones.json` files. v1.8.1 widened `AnyBone` to accept JSON-inferred shapes. The project has `resolveJsonModule: true` in `tsconfig.base.json` — this is exactly the scenario the fix addressed. |
| **pnpm workspaces** | ✅ Works | boneyard's own repo uses pnpm workspaces. `npm install boneyard-js` works with pnpm. The generated `registry.js` is a side-effect import that doesn't care about the package manager. |
| **Monorepo structure** | ✅ Clean fit | The `apps/web` package installs boneyard. Bones output goes to `apps/web/src/bones/`. The registry import lives in the web app's entry point. No cross-package concerns. |

**Verdict: Fully compatible.** No blockers identified.

### 3. Integration Options: CLI vs Vite Plugin

#### CLI (`npx boneyard-js build`)

- **Pros:** Framework-agnostic, works with any dev server, explicit control, can target specific URLs.
- **Cons:** Second terminal needed, manual re-run after layout changes (or use `--watch`).
- **Best for:** CI pipelines, one-off captures, non-Vite projects.

#### Vite Plugin (`boneyard-js/vite`)

- **Pros:** Zero-config — auto-captures on dev server start and on every HMR update. Reads `boneyard.config.json` (including `auth`). No second terminal. Debug mode available (`debug: true`).
- **Cons:** Only works with Vite. Plugin must be added to `vite.config.ts`.
- **Best for:** Active development — bones stay in sync automatically.

#### Recommendation: Vite Plugin for dev, CLI for CI

**For this repo, use the Vite plugin as the primary integration.** The project already uses Vite with `@vitejs/plugin-react` and `@tailwindcss/vite`. Adding the boneyard plugin is a single import. Bones auto-capture on every HMR update.

The CLI can be used in CI as a one-shot build step to regenerate bones before deployment.

### 4. Dependency/Config/Script Changes Likely Needed

#### Install

```bash
cd apps/web && bun add boneyard-js
```

The Playwright browser binary is also needed (one-time):

```bash
npx playwright install chromium
```

#### `apps/web/vite.config.ts` — add plugin

```ts
import { boneyardPlugin } from 'boneyard-js/vite';

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      boneyardPlugin({
        // options: out, breakpoints, wait, framework, skipInitial, cdp, debug
      }),
    ],
    // ... rest of config
  };
});
```

#### `boneyard.config.json` — at project root or `apps/web/`

```json
{
  "breakpoints": [375, 768, 1280],
  "out": "./src/bones",
  "wait": 800,
  "color": "#f0f0f0",
  "darkColor": "#222222",
  "animate": "pulse",
  "resolveEnvVars": true,
  "auth": {
    "cookies": [{ "name": "session", "value": "env[SESSION_TOKEN]", "domain": "localhost" }]
  }
}
```

#### Registry import — in app entry

Add `import './bones/registry'` to the app entry point. Based on the project structure, this would go in `apps/web/src/main.tsx` (the React entry).

#### Scripts — optional additions to `apps/web/package.json`

```json
"scripts": {
  "bones:build": "npx boneyard-js build",
  "bones:watch": "npx boneyard-js build --watch",
  "bones:force": "npx boneyard-js build --force"
}
```

#### `.gitignore` — add bones directory if generated files should be committed

The `.bones.json` files and `registry.js` are generated artifacts. **Recommend committing them** so CI/deployments don't need to run the capture step. If not committing, add `apps/web/src/bones/` to `.gitignore` and run `boneyard-js build` in CI.

### 5. Auth / Protected-Route Handling

The app uses session-cookie auth. Boneyard's headless browser needs to be authenticated to capture protected pages.

**Three strategies, in order of recommendation:**

#### A. Fixture prop (recommended for most components)

Provide mock data via the `fixture` prop on `<Skeleton>`. The fixture renders only during `npx boneyard-js build` (when `window.__BONEYARD_BUILD` is set). No auth needed at all.

```tsx
<Skeleton
  name="dashboard-stats"
  loading={isLoading}
  fixture={<DashboardStats data={mockStats} />}
>
  <DashboardStats data={stats} />
</Skeleton>
```

Best for: data-driven components where you can provide realistic placeholder data.

#### B. Auth config in `boneyard.config.json`

Set `auth.cookies` with the session cookie value. Use `resolveEnvVars: true` with `env[SESSION_TOKEN]` to keep secrets out of the config file.

```json
{
  "resolveEnvVars": true,
  "auth": {
    "cookies": [
      { "name": "session", "value": "env[SESSION_TOKEN]", "domain": "localhost" }
    ]
  }
}
```

Then run: `SESSION_TOKEN=actual_token_value npx boneyard-js build`

The Vite plugin also reads `auth` from `boneyard.config.json` (added in v1.8.1).

#### C. `--cdp` flag (connect to existing Chrome)

Start Chrome with remote debugging, then point boneyard at it. The headless browser inherits cookies/auth from your existing Chrome session.

```bash
npx boneyard-js build --cdp 9222
```

This was fixed in v1.8.1 to actually reuse the browser context (previously it spawned a fresh empty context).

**For this project:** Use **fixtures** for most components (dashboard stats, admin panels, etc.) and **auth config** for pages that need real session state (e.g., capturing the exact rendered state of a user-specific page). The `--cdp` approach is a fallback for complex cases.

### 6. Risks and Pitfalls

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Playwright browser download** | Medium | `npx playwright install chromium` downloads ~300MB. This is a one-time cost but must run before `boneyard-js build`. Ensure it's in CI setup. Not needed for the Vite plugin if you only capture during dev. |
| **Bun subprocess env inheritance** | Low | The changelog (v1.6.5) explicitly calls out `--env-file` for Bun where env vars aren't inherited by subprocesses. If using `env[SESSION_TOKEN]` in auth config, use `--env-file .env` or set vars explicitly. |
| **Vite plugin dev experience** | Low | The plugin captures on startup and HMR. For a large app with many skeletons, each HMR could trigger a recapture. This is debounced, but worth monitoring. The `skipInitial` option and `debug: true` can help tune. |
| **Generated files in version control** | Low | `.bones.json` files can get large if many components are wrapped. They're compact arrays, so this is unlikely to be an issue. Decide upfront whether to commit or generate in CI. |
| **Auth cookie expiry** | Medium | If using `auth.cookies` with a real session token, the token will expire. Use fixtures as the primary approach and auth config only for specific pages. |
| **TanStack Router redirects** | Low | The CLI crawler detects server-side redirects and skips them (v1.7.2). If a protected route redirects to `/login`, boneyard will skip it. Use explicit routes in config or fixtures to handle this. |
| **Dark mode bone colors** | Low | boneyard detects dark mode via the `.dark` class on `<html>` (Tailwind convention). This project uses Catppuccin theme flavors — verify that the `.dark` class is toggled correctly for boneyard's dark mode detection. |
| **resolveJsonModule** | ✅ **Fixed** | v1.8.1 explicitly fixed `TS2322` errors with `resolveJsonModule: true`. No action needed. |
| **Bun test runner** | Low | boneyard's own test suite runs with `bun test`. No compatibility issues. The package's `test` script uses `bun test`. |
| **Angular/Vue/Svelte files in node_modules** | None | boneyard ships framework adapters for all supported frameworks. Only `boneyard-js/react` is relevant. The other adapters are tree-shaken or unused. No impact. |

### 7. Verification Checklist

After integration, verify with:

```bash
# 1. Install
cd apps/web && bun add boneyard-js

# 2. Install Playwright browser (one-time)
npx playwright install chromium

# 3. Start dev server
bun run dev

# 4. Run CLI build (in another terminal)
cd apps/web && npx boneyard-js build

# 5. Check output
ls apps/web/src/bones/  # should show .bones.json files + registry.js

# 6. TypeScript check — verify no TS errors from bone imports
bun run typecheck

# 7. Test suite — verify no regressions
bun test

# 8. Visual verification — start dev server and navigate to a page with <Skeleton>
# The skeleton should render during loading state with pixel-perfect layout

# 9. If using Vite plugin: verify it captures on startup (check terminal output)
# "[boneyard] captured N skeletons across M routes"
```

## Recommendations

1. **Use the Vite plugin** as the primary dev integration — auto-capture on HMR keeps bones in sync without manual steps.
2. **Use the `fixture` prop** for data-driven components (dashboard stats, admin panels, content lists) — avoids auth complexity.
3. **Use `boneyard.config.json` with `auth.cookies`** only for pages where fixtures aren't practical (e.g., capturing the actual user-specific layout).
4. **Commit the generated `apps/web/src/bones/` directory** to version control so CI/deployments don't need Playwright.
5. **Start small** — wrap 1-2 components (e.g., the `AuthLoading` skeleton in `AuthGate.tsx` already has a manual `<Skeleton>` from `@/components/ui/skeleton` that can be replaced) and verify before scaling up.
6. **Add `--env-file` flag** if running auth-protected captures with Bun, since Bun subprocesses don't inherit env vars by default.

## Sources

- GitHub repo: https://github.com/0xGF/boneyard
- npm registry (v1.8.1): https://registry.npmjs.org/boneyard-js/latest
- Official docs: https://boneyard.vercel.app/overview
- CLI docs: https://boneyard.vercel.app/cli
- Config docs: https://boneyard.vercel.app/config
- React docs: https://boneyard.vercel.app/features
- SSR docs: https://boneyard.vercel.app/ssr
- Performance docs: https://boneyard.vercel.app/performance
- Install guide: https://boneyard.vercel.app/install
- Changelog: https://boneyard.vercel.app/changelog
- DeepWiki (codebase analysis): https://deepwiki.com/0xGF/boneyard