# Arr-Style API Key Rework Security Audit

## Scope

Reviewed the 2026-06-25 API key rework that replaced scoped bearer keys with multiple named full-authority keys.

Primary files:

- `apps/server/src/auth/api-key.service.ts`
- `apps/server/src/auth/route-principal.ts`
- `apps/server/src/auth/routes.ts`
- `apps/server/src/security/csrf.ts`
- `apps/server/src/download-clients/routes.ts`
- `apps/server/src/db/schema.ts`
- `apps/server/drizzle/0014_amused_sabretooth.sql`
- `apps/server/drizzle/0015_legacy_api_key_cleanup.sql`
- `apps/web/src/features/admin/api-keys/ApiKeysSettings.tsx`
- `apps/web/src/lib/api.ts`

## Trust boundaries

- Browser UI stays on session cookie + CSRF.
- External API clients authenticate with `X-Api-Key` or `Authorization: Bearer`.
- Query `apikey` stays disabled.
- Key management routes stay session-only.
- Download-client service routes, permission catalog, and read-only user routes accept full-authority API keys.

## Findings

### 1. Secret handling

- Keys are generated as 32 lowercase hex characters.
- Secrets are hashed at rest with no plaintext recovery path.
- The UI shows the secret once on create and rotate.
- Logs and audit rows store only `keyPrefix`, `fingerprint`, route path, and safe request metadata.

Status: pass

### 2. Legacy key invalidation

- Legacy `artk_` keys are not accepted by the new request validator.
- Migration `0015_legacy_api_key_cleanup.sql` backfills `key_prefix` and `fingerprint`, then soft-deletes legacy rows so they disappear from active lists and cannot authenticate.

Status: pass

### 3. Route separation

- Session-only surfaces remain session-only: auth/session flows, profile self-service, and API key management.
- Full-authority API keys can reach protected external API routes without per-key permission arrays.
- Unsafe API-key requests on approved service routes bypass CSRF only when an API-key transport is present; invalid keys do not fall back to session auth.

Status: pass

### 4. Abuse controls

- Invalid, deleted, and query-transport API key attempts emit warning logs and audit entries.
- Repeated invalid attempts are rate-limited.
- Deleted keys are soft-deleted, preserved for audit, and blocked at auth time.

Status: pass

## Residual risk

- Full-authority keys are intentionally broad. Operational risk shifts from scope design to key hygiene. The UI now supports named keys, one-time reveal, rotate-in-place, and single-key deletion to keep blast radius manageable.

## Verification

- `DATABASE_URL=data/db/arrtemplar-test.sqlite bun run db:migrate`
- `DATABASE_URL=data/db/arrtemplar-test.sqlite bun test test/apps/server/src/auth/auth.routes.test.ts test/apps/server/src/security/csrf.test.ts test/apps/server/src/download-clients/download-client.routes.test.ts`
- `bun test test/apps/web/src/lib/api.test.ts test/apps/web/src/features/admin/admin-settings-layout.test.ts`
- `bun run typecheck`
- `bun run check:quality:code:full`
- Browser check on `/settings/general`: created one key, confirmed one-time secret dialog, confirmed table layout, then deleted the key.

## Follow-up

- If query-string compatibility is ever required for a third-party integration, add it as an explicit compatibility mode with separate redaction and request-audit review.
