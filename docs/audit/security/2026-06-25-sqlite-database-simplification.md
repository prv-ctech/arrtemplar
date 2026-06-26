# Security Audit: SQLite Database Simplification

Date: 2026-06-25
Trigger: implementation plan
Scope: SQLite runtime configuration, Drizzle migration reset, local dev/test DB reset, query logging, and secret-bearing database tables.

## Affected Areas

- `apps/server/src/db/client.ts` — opens SQLite connections, applies PRAGMAs, logs lifecycle events, and closes file databases.
- `apps/server/src/db/migrate.ts` — applies checked-in Drizzle SQL migrations and logs migration lifecycle events.
- `apps/server/src/db/schema.ts` — defines secret-bearing auth/API-key/OAuth/download-client tables and database indexes.
- `apps/server/drizzle/0000_sqlite_core_baseline.sql` — new single baseline migration after pre-production history reset.
- `data/db/backups/sqlite-reset-20260625T193442Z/` — ignored local backup of previous dev/test SQLite files before active DB reset.

## Findings

- none

## Notes

- Migration history was reset only after old dev/test SQLite files were backed up, then active DB files were recreated from the new Drizzle baseline.
- Runtime hardening keeps `foreign_keys=ON`, `busy_timeout=5000`, file-only WAL, and `synchronous=NORMAL`; it adds `trusted_schema=OFF` and `PRAGMA optimize` on file DB open/close.
- Lifecycle logs use structured LogTape fields for storage kind, URL kind, PRAGMA status, migration folder, and durations. They do not log raw `DATABASE_URL`, full DB paths, query params, secrets, tokens, cookies, hashes, or raw SQL outside the existing redacted Drizzle query logger.
- Secret-bearing tables remain protected at the app layer: passwords/API keys are hashed, OAuth and download-client secrets are encrypted, and audit metadata excludes raw secret values.
- Deferred decisions remain out of scope: DB-at-rest encryption, `secure_delete`, `auto_vacuum`, audit-log index pruning, and data-preserving import/restore flows.

## Verification

- `DATABASE_URL=data/db/arrtemplar-test.sqlite bun test test/apps/server/src/db/migrate.test.ts test/apps/server/src/db/client.test.ts test/apps/server/src/db/sql-safety.test.ts test/helpers/database.test.ts test/scripts/database-isolation.test.ts test/apps/server/src/auth test/apps/server/src/download-clients`
- `bun run check:code:logtape`
- `bun run check:quality:code:full`
