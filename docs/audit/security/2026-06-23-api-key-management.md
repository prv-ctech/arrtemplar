# Security Audit: API Key Management

Date: 2026-06-23
Trigger: implementation plan
Scope: shared API-key contracts, Drizzle tables, API-key service, auth routes, CSRF policy, General settings UI, and verification tests

## Affected Areas

- `packages/shared/src/api/api-keys.ts` — API-key request/response contract and one-time reveal shape.
- `packages/shared/src/api/permissions.ts` — explicit API-key-eligible grant allowlist currently exposes `users:manage` read access only.
- `apps/server/src/db/schema.ts` — hash-only API-key storage and explicit grant table.
- `apps/server/src/auth/api-key.service.ts` — key generation, hashing, grant enforcement, lifecycle operations, audit logging, expiry/IP validation, and bearer principal resolution.
- `apps/server/src/auth/routes.ts` — session-only management endpoints, bearer introspection, and bearer read access for permission catalog/user directory.
- `apps/server/src/security/csrf.ts` — explicit unsafe bearer-route CSRF exemption list; currently no unsafe bearer routes are exempt, and API-key management remains CSRF-protected.
- `apps/web/src/features/admin/api-keys/ApiKeysSettings.tsx` — General settings UI for list/create/edit/reveal/rotate/revoke/delete flows.

## Findings

- `AKM-001` — low — resolved — `apps/server/src/auth/api-key.service.ts` — plaintext API key is returned only by create/rotate/refresh responses and is stored only as `secret_hash`.
- `AKM-002` — low — resolved — `apps/server/src/auth/routes.ts` — API-key management routes require browser session permission `settings:general`; bearer-only callers receive auth failure.
- `AKM-003` — low — resolved — `apps/server/src/security/csrf.ts` — bearer headers do not bypass CSRF on session-cookie unsafe routes; `/api/api-keys` unsafe methods still require CSRF.
- `AKM-004` — low — resolved — `apps/server/src/auth/api-key.service.ts` — audit metadata records key IDs, prefixes, counts, and status signals, not raw secrets.
- `AKM-005` — low — resolved — `packages/shared/src/api/permissions.ts` — API-key grant choices are limited to routes implemented for bearer principals so unsupported permissions are not exposed or accepted.
- `AKM-006` — low — resolved — `apps/web/src/features/admin/api-keys/ApiKeysSettings.tsx` — API-key form fields have visible labels and expiry values round-trip between UTC storage and local `datetime-local` input values.

## Next Actions

- Expand `API_KEY_ELIGIBLE_PERMISSION_VALUES` only when the matching bearer route and tests are implemented.
- Add pagination or batched creator lookup if API-key count grows beyond small admin settings usage.

## Verification

- `bun run --cwd packages/shared typecheck` — passed.
- `DATABASE_URL=data/db/arrtemplar-test.sqlite bun run db:migrate` — passed.
- `bun run --cwd apps/server typecheck` — passed.
- `bun run --cwd apps/web typecheck` — passed.
- `DATABASE_URL=data/db/arrtemplar-test.sqlite bun test test/apps/server/src/auth/auth.routes.test.ts test/apps/server/src/security/csrf.test.ts` — passed.
- `DATABASE_URL=data/db/arrtemplar-test.sqlite bun test test/apps/web/src/lib/api.test.ts test/apps/web/src/features/admin/admin-settings-layout.test.ts` — passed.
- Integrated browser verification at `/settings/general` — passed for render, create/reveal, desktop overflow, mobile overflow, mobile dialog overflow, and cleanup revoke/delete.
- `bun run check:quality:code:full` — passed with full suite `261 pass, 0 fail`.
- `bunx react-doctor@latest --verbose --scope changed` — passed with no changed-file issues.
