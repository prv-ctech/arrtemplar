# Authenticated route boundaries

Arrtemplar now uses a permission-first route model.

Roles are **not** part of the authenticated web contract or database schema. Access is determined by explicit permission grants plus the default self-service permissions every signed-in user receives.

## Route families

| Route family | Purpose | Notes |
| --- | --- | --- |
| `/dashboard` | Shared authenticated dashboard | Default landing path after sign-in. |
| `/profile` | Signed-in user's own profile dashboard | Self-service dashboard surface only; profile settings are not rendered here. |
| `/profile/settings` | Signed-in user's profile settings default | Redirects to `/profile/settings/main`. |
| `/profile/settings/main` | Signed-in user's profile identity settings | Updates username and email only for the signed-in user. |
| `/profile/settings/password` | Signed-in user's password settings | Changes only the signed-in user's password. |
| `/profile/settings/notifications` | Signed-in user's notification preferences | Reserved for self-service notification settings. |
| `/profile/:publicUserId` | Managed user profile dashboard | Public IDs are locators, not authorization secrets. |
| `/profile/:publicUserId/settings` | Managed user settings default | Redirects to `/profile/:publicUserId/settings/main`. |
| `/profile/:publicUserId/settings/main` | Managed user identity editor | Requires `users:manage` plus `users:update`. |
| `/profile/:publicUserId/settings/password` | Managed user password editor | Requires `users:manage` plus `users:password`. |
| `/profile/:publicUserId/settings/permissions` | Managed user permission editor | Requires `users:manage` plus `users:permissions`. |
| `/settings` | Top-level settings shell | Redirects to the first safe/default section. |
| `/settings/users` | Managed user directory | Requires `users:manage` or `system:admin`. |
| `/settings/about` | Safe application information | Available to signed-in users through default permissions. |
| `/settings/theme` | Signed-in user's theme preference | Theme is **exclusive** to `/settings/theme` and affects only the signed-in user. |
| `/settings/general` | App-wide general settings | Permission-gated. |
| `/settings/library` | Library and metadata settings | Permission-gated. |
| `/settings/import` | Import pipeline settings | Permission-gated. |
| `/settings/notifications` | App-wide notification settings | Permission-gated. |
| `/settings/services` | External service integrations | Permission-gated. |
| `/settings/logs` | Log and audit settings | Permission-gated. |

## Explicitly absent routes

These paths are intentionally **not** part of the application anymore:

- `/admin/*`
- `/account/services`
- delegated `/account/*` settings routes
- `/mod/*`
- `/users`
- `/users/*`
- `/profile/settings/theme`

The profile menu now links to:

- `My Profile` → `/profile`
- `Settings` → `/settings`

Profile settings are reached from the profile dashboard action:

- `Profile Settings` → `/profile/settings/main`

## Permission model

The shared permission catalog lives in `packages/shared/src/api/permissions.ts`.

### Default signed-in permissions

Every signed-in user effectively receives:

- `profile:update`
- `profile:password`
- `profile:notifications`
- `settings:view`
- `settings:about`
- `settings:theme`

### Explicit full admin

The first created account receives an explicit `system:admin` grant.

`system:admin` is treated as a stored permission, not a hidden role. It expands to full effective access across the catalog.

### Cross-user access

Cross-user URLs are never authorized by guessing a public ID.

To access `/profile/:publicUserId` or `/profile/:publicUserId/settings/*`, the actor must have:

1. `users:manage` (or `system:admin`), and
2. the narrower action permission for the target settings page where applicable.

A regular user entering another account's public ID must fail closed.

## Server boundaries

Frontend route visibility is UX only. The server remains the real authorization boundary.

The current permission-first API surfaces are:

- `GET /api/auth/setup`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/profile`
- `PUT /api/profile`
- `PUT /api/profile/password`
- `GET /api/permissions/catalog`
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:publicUserId`
- `PUT /api/users/:publicUserId/settings/main`
- `PUT /api/users/:publicUserId/settings/password`
- `PUT /api/users/:publicUserId/settings/permissions`
- `PATCH /api/users/:publicUserId/status`

## Security rules

- Public user IDs remain 9-character opaque base62 locators.
- Internal UUID primary keys stay server-side.
- Password hashes, session token hashes, CSRF values, and other private fields are never returned to the client.
- Password changes, permission changes, and status changes revoke the target user's sessions.
- The last active `system:admin` grant cannot be removed through managed-user mutations.
- Self-service account changes belong under `/profile/settings`; cross-user profile dashboards and settings belong under `/profile/:publicUserId`; the managed user directory belongs under `/settings/users`.

## SPA routing notes

Vite's SPA fallback still applies for nested frontend paths. Production static hosting should continue rewriting unknown frontend paths to `index.html` so direct loads of `/profile`, `/profile/Ab3Xy9Qp2`, or `/settings/theme` resolve to the app shell.
