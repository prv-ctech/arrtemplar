# Authenticated Route Boundaries

Status: Accepted  
Date: 2026-05-23  
Implementation: `689b097` (`Implement authenticated routing restructure`)  
Updated: 2026-05-28 (`Session-based admin user-management mutations`)

## Purpose

Arrtemplar separates authenticated application pages, self-service account settings, delegated mod settings, and admin-only tools into explicit TanStack Router boundaries. The current model avoids putting account identifiers in self-service URLs, keeps global controls under `/admin/*`, and treats client route hiding as UX only: server handlers remain the real authorization boundary.

This follows the OWASP authorization guidance to define explicit trust boundaries, apply least privilege, deny by default, and test authorization logic. It also follows OWASP IDOR guidance by using the authenticated session for “current account” resources instead of exposing object identifiers in the account-settings URL.

## Route map

| Route | Owner | Access | Purpose |
| --- | --- | --- | --- |
| `/` | Public redirect | Public | Sends users to `/app/dashboard`. |
| `/login` | Public auth | Public | Login/setup surface; signed-in users land at `/app/dashboard`. |
| `/app/dashboard` | App | Authenticated user | Shared user/admin dashboard experience. |
| `/account` | Account | Authenticated user | Signed-in account profile and password settings. |
| `/account/theme` | Account | Authenticated user | Personal browser theme settings. |
| `/account/notifications` | Account | Authenticated user; delegated notification controls require a mod with `admin:notifications` | Personal notification settings with optional delegated controls for granted mods. |
| `/account/general` | Delegated account section | Mod with `admin:general` | Delegated General settings content. Admins use `/admin/general`. |
| `/account/library` | Delegated account section | Mod with `admin:library` | Delegated Library settings content. Admins use `/admin/library`. |
| `/account/users` | Delegated account section | Mod with `admin:users` | Delegated Users content. High-risk user-management mutations remain exact-admin-only APIs. |
| `/account/import` | Delegated account section | Mod with `admin:import` | Delegated Import settings content. Admins use `/admin/import`. |
| `/account/services` | Delegated account section | Mod with `admin:services` | Delegated Services settings content. Admins use `/admin/services`. |
| `/account/logs` | Delegated account section | Mod with `admin:logs` | Delegated Logs settings content. Admins use `/admin/logs`. |
| `/account/about` | Delegated account section | Mod with `admin:about` | Delegated About/version content. Admins use `/admin/about`. |
| `/admin` | Admin | Admin role only | Redirects to `/admin/general`. |
| `/admin/general` | Admin | Admin role only | General application settings and display preferences. |
| `/admin/library` | Admin | Admin role only | Metadata import and library curation settings. |
| `/admin/users` | Admin | Admin role only | Managed non-admin local accounts: create users, rotate passwords, change user/mod roles, grant mod permissions, disable, and restore. Admin accounts are not listed or mutated here. |
| `/admin/import` | Admin | Admin role only | Import queue, files, and parser configuration. |
| `/admin/notifications` | Admin | Admin role only | Notification channels and webhooks. |
| `/admin/services` | Admin | Admin role only | External service integrations. |
| `/admin/logs` | Admin | Admin role only | Logging level, retention, and audit. |
| `/admin/about` | Admin | Admin role only | Version info and credits. |
| `/admin?tab=...` | Admin index | Admin role only | Legacy query-param tab routing has been removed; query params are ignored by the `/admin` index redirect to `/admin/general`. |
| `/admin/nope` (or any undefined admin path) | Admin | Admin role only | Admin-scoped not-found recovery UI with a link back to `/admin/general`. |

Legacy frontend `/user/*` account routes have been removed and are not redirected, aliased, or shimmed. Stale `/user/*` URLs should hit normal not-found handling rather than being rewritten to `/account`.

## Account and delegation model

Self-service account settings live under `/account/*` and use the authenticated session as the account selector. No public account ID appears in the URL for profile, password, theme, or notification preferences.

Delegated account sections are for mods only. A mod sees only the `/account/<section>` entries for grants present in `user.permissions`. Admins do not receive delegated account shortcuts under `/account/*`; admins use the global `/admin/*` console.

Delegated section slugs are clean route slugs (`general`, `library`, `users`, `import`, `services`, `logs`, `about`). The `admin:` prefix belongs only to permission slugs such as `admin:logs`, where it identifies the grant namespace. Do not create `/mod/*` routes or `admin-`-prefixed account routes.

When a future admin section becomes delegatable to mods, register all of these values together in the shared permission catalog:

- Admin console route: `/admin/<section>`
- Delegated account route: `/account/<section>`
- Permission slug: `admin:<section>`
- Label, description, minimum role, risk metadata, and server authorization policy

If a clean delegated slug collides with an existing personal settings route, keep the personal route and reveal a delegated subsection inside it. `admin:notifications` is the canonical example: it augments `/account/notifications` rather than creating a duplicate delegated notifications route.

## TanStack Router shape

The route tree is code-based in `apps/web/src/routes/router.tsx`:

- `rootRoute` owns global layout concerns: `<Outlet />` and the app toaster.
- `appRoute` contributes the `/app` URL segment and wraps children with `AuthGate`, `AppShell`, and `AuthenticatedUserContext`.
- `dashboardRoute` is a child of `appRoute`, producing `/app/dashboard`.
- `accountRoute` contributes the `/account` URL segment and wraps children with `AuthGate`, `AppShell`, and `AuthenticatedUserContext`.
- Account child routes are explicit static children: `/`, `theme`, `notifications`, `general`, `library`, `users`, `import`, `services`, `logs`, and `about`. There is no dynamic catch-all for delegated sections.
- Delegated account route components call `canAccessAccountSettingsPage`. That helper allows personal pages for every authenticated user and delegated pages only for mods with the matching permission.
- `adminLayoutRoute` is a root child at `/admin` and uses `AuthGate requiredRole="admin"` with `notFoundComponent` for scoped recovery.
- Admin child routes are explicit static children for `general`, `library`, `users`, `import`, `notifications`, `services`, `logs`, and `about`.
- Admin settings sections are not modeled as a dynamic `/$section` catch-all, so invalid section paths fail closed into the admin not-found handler.

Keep the `declare module "@tanstack/react-router"` registration in `router.tsx`; it preserves typed `Link`, `Navigate`, and router inference.

## Boundary rules

1. **Default authenticated landing is `/app/dashboard`.** Do not send admins directly to `/admin`; admin tools are privileged tools, not the default home.
2. **Self-service settings live under `/account/*`.** Profile, password, theme, personal notification preferences, and other account-scoped controls belong here.
3. **Instance-wide settings live under `/admin/*`.** User management, global notifications, import/service settings, logs, and operational controls belong here.
4. **Admin accounts are not managed through `/admin/users`.** The admin user manages profile/password through `/account`; normal managed-user APIs list and mutate only non-admin accounts.
5. **The shell may show admin navigation only for admins.** `AppShell` always includes Dashboard and Settings; it adds Admin only when `user.role === "admin"`. Settings always points to `/account`.
6. **Authenticated child pages receive the current user from the route boundary.** `AuthenticatedUserContext` is intentionally scoped inside authenticated layout routes so children do not repeat auth lookups.
7. **Legacy query-param tab routing (`?tab=`) is intentionally removed.** Stale `/admin?tab=users` URLs do not render a tab-selected section; query params are ignored by the `/admin` index redirect to `/admin/general`.
8. **Invalid or undefined admin paths (`/admin/nope`) render a scoped not-found recovery UI.** The admin not-found component displays a message and a link back to `/admin/general`.
9. **Delegated mod settings are least-privilege.** A delegated account section requires `role === "mod"` and the matching grant; admin effective permissions do not unlock `/account/<delegated-section>`.
10. **Public account IDs are not authorization secrets.** They remain API identifiers for managed accounts, but self-service settings do not use them in URLs.
11. **Role and grant changes revoke target sessions.** The UI must treat session refresh as authoritative after role or permission changes.

## Server API boundary

Authenticated user APIs are grouped separately from admin APIs in `apps/server/src/auth/routes.ts`:

- `GET /api/user/profile` returns the current public user from the authenticated session.
- `PUT /api/user/profile` updates only the authenticated user, checks duplicate username/email conflicts, and returns a public user.
- `PUT /api/user/password` verifies the current password before hashing and storing the new password.
- `GET /api/admin/permission-catalog` returns the shared grant catalog for admins only.
- `GET /api/admin/users` lists managed non-admin local account summaries for admins only. The response uses public account IDs and includes active permission grants. It intentionally omits admin accounts, email, password hashes, session IDs, session token hashes, and internal UUIDs.
- `POST /api/admin/users` creates a local account with the `user` role only.
- `PATCH /api/admin/users/:id/password` changes a managed non-admin account password for the authenticated admin session and revokes all target sessions.
- `PATCH /api/admin/users/:id/role` changes a managed non-admin account role between `user` and `mod` for the authenticated admin session and revokes all target sessions. It does not accept `admin` as a target role.
- `PATCH /api/admin/users/:id/permissions` replaces a mod account's grant list for the authenticated admin session, validates grants against the shared catalog, revokes all target sessions, and rejects non-mod targets.
- `DELETE /api/admin/users/:id` soft-deletes managed non-admin account access by setting `disabledAt` and revokes all target sessions.
- `PATCH /api/admin/users/:id/status` currently supports `{ disabled: false }` to restore a disabled managed non-admin account for the authenticated admin session.
- Admin targets are not manageable through `/api/admin/users/:id/*` endpoints; they return safe not-found responses from that managed-account boundary.
- `/api/admin/*` routes remain exact-admin-only unless a handler is explicitly permission-gated for a granted mod section. The current user-management and permission-grant APIs are exact-admin-only. Do not rely on frontend route guards for API protection.

Never expose `passwordHash`, internal UUID primary keys, session IDs, token hashes, or other private database fields from user/profile/admin summary endpoints. Shared request/response contracts live in `packages/shared/src/api/auth.ts`.

High-risk admin user-management operations rely on the authenticated exact-admin session instead of repeated password confirmation. Unsafe `/api/*` requests continue to require the shared CSRF proof header. The service re-reads the active admin actor, rejects disabled or non-admin actors, validates that targets are managed non-admin accounts, writes audit logs, and revokes target sessions when privilege or authenticator state changes.

`disabledAt` is the account-removal mechanism for managed local users. User rows are preserved for auditability, disabled users cannot log in, and any existing session is treated as anonymous during current-user/admin checks. Session revocation is mandatory after password changes, role changes, permission changes, and access removal/restoration because privileges or authenticator state changed.

**Important: Client route guards (`AuthGate`) are a UI convenience only.** Every server API endpoint, especially admin routes, must independently enforce auth and admin role checks. TanStack Router's authenticated route docs explicitly warn that client route guards protect UI only.

## TanStack Query state ownership

User profile state is server state, so TanStack Query owns it:

- `authQueryKey` (`["auth", "me"]`) is the current session user used by auth gates and the shell.
- `userProfileQueryKey` (`["user", "profile"]`) is the profile page cache for `/account`.
- `adminUsersQueryKey` (`["admin", "users"]`) is the admin managed-account table cache.
- `adminPermissionCatalogQueryKey` (`["admin", "permission-catalog"]`) is the admin grant catalog cache.
- Profile updates must call `syncUpdatedUserProfileCaches(queryClient, updatedProfile)` so the profile form, shell account menu, and auth gates agree immediately after save.
- Admin user-management mutations invalidate `adminUsersQueryKey` after success so the table refetches server-confirmed status, role, grant, and timestamp changes.

Do not mirror profile data into unrelated global state. Local form state is only for editable input fields; successful mutations must update Query caches.

## Shared settings UI

Admin settings and account settings share UI primitives in `apps/web/src/features/settings/`:

- `SettingsNav` implements tab semantics, roving keyboard navigation, and the horizontal settings category strip.
- `SettingsPrimitives` provides `SettingsPanel`, `SettingsSection`, `SettingsRow`, and `SettingsSelect`.

Use these primitives for new settings surfaces instead of copying admin or account settings markup.

## Deployment notes

### Vite development

Vite's default `appType: "spa"` includes SPA fallback for nested frontend paths in dev and preview modes, so direct loads or reloads of `/account`, `/account/theme`, `/admin/general`, `/admin/users`, and other frontend routes work automatically.

### Production static hosting

Production static hosts (nginx, Caddy, Cloudflare Pages, etc.) must rewrite nested SPA paths to `index.html`. For example, an nginx config with `try_files $uri $uri/ /index.html` or equivalent. This ensures direct loads of `/account/theme` or `/admin/general` return the app shell.

### Elysia serving the frontend

This migration intentionally does not change Elysia. If Elysia later serves the built frontend, use `@elysia/static` with `indexHTML: true` for SPA fallback:

```typescript
import { staticPlugin } from "@elysiajs/static";
app.use(staticPlugin({ assets: "dist", indexHTML: true }));
```

Elysia should only be updated when the frontend is intentionally moved behind Elysia in production. Current Vite dev setup proxies only `/health` and `/api` to Elysia; frontend paths are owned by Vite.

## Adding future pages

- Add shared authenticated app pages under `appRoute` (`/app/...`).
- Add self-service account pages under `accountRoute` (`/account/...`) and use the authenticated session as the account selector.
- Add privileged operational pages under `adminLayoutRoute` (`/admin/...`) with admin role enforcement. Each new admin section gets an explicit static child route.
- If a privileged admin section is also delegatable to mods, add a shared permission-catalog entry that maps `/admin/<section>` to `/account/<section>` and an `admin:<section>` permission slug.
- If a future delegated section conflicts with an existing personal page slug, keep the personal route and expose delegated controls as a permission-gated subsection on that page.
- Update `AppShell` navigation only when the destination is a primary shell-level destination.
- Add source and behavior tests for route placement, authorization behavior, and Query cache synchronization when mutations change cached user data.
