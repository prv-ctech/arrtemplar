# Authenticated Route Boundaries

Status: Accepted  
Date: 2026-05-23  
Implementation: `689b097` (`Implement authenticated routing restructure`)  
Updated: 2026-05-23 (`Admin path-based settings routing migration`)

## Purpose

Arrtemplar separates authenticated application pages, user-owned settings, and admin-only tools into explicit TanStack Router boundaries. This keeps normal user flows from depending on admin routes while still sharing the same authenticated shell, session model, and theme system.

## Route map

| Route | Owner | Access | Purpose |
| --- | --- | --- | --- |
| `/` | Public redirect | Public | Sends users to `/app/dashboard`. |
| `/login` | Public auth | Public | Login/setup surface; signed-in users land at `/app/dashboard`. |
| `/app/dashboard` | App | Authenticated user | Shared user/admin dashboard experience. |
| `/user/settings` | User | Authenticated user | Account-owned profile, password, theme, and personal notification settings. |
| `/admin` | Admin | Admin role only | Redirects to `/admin/general`. |
| `/admin/general` | Admin | Admin role only | General application settings and display preferences. |
| `/admin/library` | Admin | Admin role only | Metadata import and library curation settings. |
| `/admin/users` | Admin | Admin role only | User management and permissions. |
| `/admin/import` | Admin | Admin role only | Import queue, files, and parser configuration. |
| `/admin/notifications` | Admin | Admin role only | Notification channels and webhooks. |
| `/admin/services` | Admin | Admin role only | External service integrations. |
| `/admin/logs` | Admin | Admin role only | Logging level, retention, and audit. |
| `/admin/about` | Admin | Admin role only | Version info and credits. |
| `/admin?tab=...` | — | — | Not supported; legacy query-param routing has been removed. Stale query-param URLs reach the admin scoped not-found handler. |
| `/admin/nope` (or any undefined path) | Admin | Admin role only | Admin-scoped not-found recovery UI with a link back to `/admin/general`. |

## TanStack Router shape

The route tree is code-based in `apps/web/src/routes/router.tsx`:

- `rootRoute` owns global layout concerns: `<Outlet />` and the app toaster.
- `appRoute` contributes the `/app` URL segment and wraps children with `AuthGate`, `AppShell`, and `AuthenticatedUserContext`.
- `dashboardRoute` is a child of `appRoute`, producing `/app/dashboard`.
- `userRoute` contributes the `/user` URL segment and also wraps children with `AuthGate`, `AppShell`, and `AuthenticatedUserContext`.
- `userSettingsRoute` is a child of `userRoute`, producing `/user/settings`.
- `adminLayoutRoute` is a root child at `/admin` and uses `AuthGate requiredRole="admin"` with `notFoundComponent` for scoped recovery.
- Child routes of `adminLayoutRoute`:
  - `adminIndexRoute` (`/`) — redirects to `/admin/general` with `replace: true`.
  - `adminGeneralRoute` (`/general`) — renders General admin settings.
  - `adminLibraryRoute` (`/library`) — renders Library admin settings.
  - `adminUsersRoute` (`/users`) — renders Users admin settings.
  - `adminImportRoute` (`/import`) — renders Import admin settings.
  - `adminNotificationsRoute` (`/notifications`) — renders Notifications admin settings.
  - `adminServicesRoute` (`/services`) — renders Services admin settings.
  - `adminLogsRoute` (`/logs`) — renders Logs admin settings.
  - `adminAboutRoute` (`/about`) — renders About admin settings.
- Admin settings sections are defined as explicit static child routes (not a dynamic `/$section` catch-all) so that invalid section paths fail closed into the admin not-found handler.

Keep the `declare module "@tanstack/react-router"` registration in `router.tsx`; it preserves typed `Link`, `Navigate`, and router inference.

## Boundary rules

1. **Default authenticated landing is `/app/dashboard`.** Do not send admins directly to `/admin`; admin tools are privileged tools, not the default home.
2. **User-owned settings live under `/user/*`.** Profile, password, theme, personal notification preferences, and other account-scoped controls belong here.
3. **Instance-wide settings live under `/admin/*`.** Each admin section has its own canonical path. User management, global notifications, import/service settings, logs, and operational controls belong here.
4. **The shell may show admin navigation only for admins.** `AppShell` always includes Dashboard and Settings; it adds Admin only when `user.role === "admin"`. The shell Admin link points to `/admin`, which redirects to `/admin/general`.
5. **Authenticated child pages receive the current user from the route boundary.** `AuthenticatedUserContext` is intentionally scoped inside authenticated layout routes so children do not repeat auth lookups.
6. **Legacy query-param tab routing (`?tab=`) is intentionally removed.** Stale `/admin?tab=users` URLs do not render a valid admin section and instead reach the admin scoped not-found handler. No redirect or mapping is provided.
7. **Invalid or undefined admin paths (`/admin/nope`) render a scoped not-found recovery UI.** The admin not-found component displays a message and a link back to `/admin/general`.

## Server API boundary

Authenticated user APIs are grouped separately from admin APIs in `apps/server/src/auth/routes.ts`:

- `GET /api/user/profile` returns the current public user.
- `PUT /api/user/profile` updates only the authenticated user, checks duplicate username/email conflicts, and returns a public user.
- `PUT /api/user/password` verifies the current password before hashing and storing the new password.
- `/api/admin/*` routes remain admin-only and must keep role checks in `AuthService.requireRole`.

Never expose `passwordHash` or other private database fields from user/profile endpoints. Shared request/response contracts live in `packages/shared/src/api/auth.ts`.

**Important: Client route guards (AuthGate) are a UI convenience only.** Every server API endpoint, especially admin routes, must independently enforce auth and admin role checks. TanStack Router's authenticated route docs explicitly warn that client route guards protect UI only.

## TanStack Query state ownership

User profile state is server state, so TanStack Query owns it:

- `authQueryKey` (`["auth", "me"]`) is the current session user used by auth gates and the shell.
- `userProfileQueryKey` (`["user", "profile"]`) is the profile page cache.
- Profile updates must call `syncUpdatedUserProfileCaches(queryClient, updatedProfile)` so the profile form, shell account menu, and auth gates agree immediately after save.

Do not mirror profile data into unrelated global state. Local form state is only for editable input fields; successful mutations must update Query caches.

## Shared settings UI

Admin settings and user settings share UI primitives in `apps/web/src/features/settings/`:

- `SettingsNav` implements tab semantics, roving keyboard navigation, and the horizontal settings category strip.
- `SettingsPrimitives` provides `SettingsPanel`, `SettingsSection`, `SettingsRow`, and `SettingsSelect`.

Use these primitives for new settings surfaces instead of copying admin or user settings markup.

## Deployment notes

### Vite development
Vite's default `appType: "spa"` includes SPA fallback for nested frontend paths in dev and preview modes, so direct loads or reloads of `/admin/general`, `/admin/users`, etc. work automatically.

### Production static hosting
Production static hosts (nginx, Caddy, Cloudflare Pages, etc.) must rewrite nested SPA paths to `index.html`. For example, an nginx config with `try_files $uri $uri/ /index.html` or equivalent. This ensures direct loads of `/admin/general` return the app shell.

### Elysia serving the frontend
This migration intentionally does not change Elysia. If Elysia later serves the built frontend, use `@elysia/static` with `indexHTML: true` for SPA fallback:
```typescript
import { staticPlugin } from "@elysiajs/static";
app.use(staticPlugin({ assets: "dist", indexHTML: true }));
```
Elysia should only be updated when the frontend is intentionally moved behind Elysia in production. Current Vite dev setup proxies only `/health` and `/api` to Elysia; frontend paths are owned by Vite.

## Adding future pages

- Add shared authenticated app pages under `appRoute` (`/app/...`).
- Add personal/account pages under `userRoute` (`/user/...`).
- Add privileged operational pages under `adminLayoutRoute` (`/admin/...`) with admin role enforcement. Each new admin section gets an explicit static child route.
- Update `AppShell` navigation only when the destination is a primary shell-level destination.
- Add source and behavior tests for route placement, authorization behavior, and Query cache synchronization when mutations change cached user data.
