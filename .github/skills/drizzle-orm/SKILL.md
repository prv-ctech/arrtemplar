---
name: drizzle-orm
description: |
  Type-safe SQL ORM for TypeScript with zero runtime overhead. Covers Drizzle ORM schemas,
  queries, relations, migrations, performance optimization, and PostgreSQL best practices.

  USE THIS SKILL WHEN THE USER:
  - Defines table schemas with `pgTable`, `mysqlTable`, or `sqliteTable`
  - Writes select, insert, update, delete, or relational queries
  - Sets up relations between tables
  - Configures `drizzle-kit` for migrations (`generate`, `push`, `pull`, `migrate`)
  - Infers TypeScript types from schema (`$inferSelect`, `$inferInsert`)
  - Chooses between SQL-like API and relational query API
  - Optimizes query performance (prepared statements, batch operations, pooling)
  - Works with PostgreSQL-specific features (identity columns, JSONB, arrays, enums)
  - Integrates Drizzle with serverless Postgres providers (Neon, Supabase)
  - Troubleshoots type errors in Drizzle schemas
  - Migrates from another ORM (Prisma, Knex) to Drizzle

  CORE PATTERNS:
  - Migration-first: schema changes ALWAYS start with SQL migrations, never code-first
  - Type-safe: use `$inferSelect` / `$inferInsert` for TypeScript types from schema
  - Relational queries: use the relational query API (`db.query`) for nested data
  - Performance: use prepared statements and batch operations for hot paths
  - Postgres-native: prefer `identity` columns, native `jsonb`, and Postgres-specific features
compatibility:
  - github-copilot
  - claude-code
  - openai-codex
license: MIT
metadata:
  author: arrbit
  version: "1.0"
---

# Drizzle ORM — Agent Instruction Set

> **This file is a map, not the territory.** All detailed schema patterns, query APIs, relation definitions, migration workflows, performance guidance, driver configuration, and code examples live exclusively in the `references/` directory. This file tells you WHICH reference to read for which task. **Do not write Drizzle code or give ORM advice until you have read the relevant reference file(s).**

---

## How to Use This Skill

1. **Identify the task** from the `USE THIS SKILL WHEN` list in the frontmatter above.
2. **Scan the reference file index below** and match your task to the right file(s) by purpose.
3. **Read the full reference file** before generating any code, giving any advice, or reviewing any database work.
4. **Cross-reference** when a task spans multiple domains. For example: adding a new table with relations → read `schema-table-definitions.md` + `schema-column-types.md` + `relations-defining.md` + `migrations-workflow.md` + `types-inference.md`.
5. **When lost**, start with `_sections.md` for the full index, then drill into the specific topic.

---

## Reference File Index

Each entry below describes the **purpose** of the file — what problem it solves and when you must read it. The actual knowledge lives inside the file.

---

### 🏗️ Schema Design (CRITICAL)

| File | Purpose — Read this when you need to… |
|------|----------------------------------------|
| **[schema-table-definitions.md](references/schema-table-definitions.md)** | Define tables with `pgTable`. Covers primary keys (`serial`, `uuid`, `identity`), column modifiers (`.notNull()`, `.unique()`, `.default()`), table-level constraints, and schema organization patterns. |
| **[schema-column-types.md](references/schema-column-types.md)** | Choose the right column type. Covers `text`, `varchar`, `integer`, `boolean`, `timestamp`, `json`/`jsonb`, `uuid`, `date`, and the TypeScript mappings for each. |
| **[schema-indexes-constraints.md](references/schema-indexes-constraints.md)** | Add indexes and constraints. Covers unique indexes, composite indexes, foreign keys, check constraints, and partial indexes for query performance. |
| **[engine-postgres.md](references/engine-postgres.md)** | Use PostgreSQL-specific features. Covers `identity` columns (`GENERATED ALWAYS AS IDENTITY`), native `jsonb`, `text[]` arrays, `enum` types, and other Postgres-exclusive patterns only available with the `pg-core` import. |

---

### 📊 Queries (CRITICAL)

| File | Purpose — Read this when you need to… |
|------|----------------------------------------|
| **[query-select-patterns.md](references/query-select-patterns.md)** | Write `SELECT` queries. Covers `.select()`, `.from()`, column selection, aliases, and the difference between the SQL-like API and the relational query API. |
| **[query-filters-operators.md](references/query-filters-operators.md)** | Filter query results. Covers `eq()`, `ne()`, `gt()`, `lt()`, `like()`, `ilike()`, `inArray()`, `isNull()`, `and()`, `or()`, and combining filters. |
| **[query-mutations.md](references/query-mutations.md)** | Insert, update, and delete data. Covers `.insert().values()`, `.update().set()`, `.delete()`, `.returning()`, `onConflictDoUpdate()` (upsert), and `onConflictDoNothing()`. |
| **[query-error-handling.md](references/query-error-handling.md)** | Handle database errors. Covers unique constraint violations, foreign key errors, transaction rollbacks, and Drizzle-specific error patterns. |

---

### 🔗 Relations (HIGH)

| File | Purpose — Read this when you need to… |
|------|----------------------------------------|
| **[relations-defining.md](references/relations-defining.md)** | Define table relationships. Covers `one()`, `many()`, the `relations()` helper, `fields`/`references` mapping, and self-referencing relations. |
| **[relations-querying.md](references/relations-querying.md)** | Query related data. Covers `db.query.table.findMany({ with: { related } })`, nested `with` clauses, and the relational query API for fetching nested data in a single round-trip. |

---

### 🧬 Type Safety (MEDIUM-HIGH)

| File | Purpose — Read this when you need to… |
|------|----------------------------------------|
| **[types-inference.md](references/types-inference.md)** | Extract TypeScript types from schema. Covers `$inferSelect`, `$inferInsert`, column-level type inference, and using inferred types for API boundaries. |
| **[types-custom-types.md](references/types-custom-types.md)** | Create custom column types. Covers `customType()`, `$type<T>()` for JSON columns, enum columns, and domain-specific type wrappers. |

---

### 🚀 Performance (MEDIUM)

| File | Purpose — Read this when you need to… |
|------|----------------------------------------|
| **[perf-prepared-statements.md](references/perf-prepared-statements.md)** | Use prepared statements for hot paths. Covers `.prepare()`, query parameterization, and when prepared statements reduce planning overhead. |
| **[perf-batch-operations.md](references/perf-batch-operations.md)** | Batch multiple operations. Covers bulk inserts, batch updates, and reducing round-trips for high-throughput workloads. |

---

### 🔄 Migrations (HIGH)

| File | Purpose — Read this when you need to… |
|------|----------------------------------------|
| **[migrations-workflow.md](references/migrations-workflow.md)** | Run the migration workflow. Covers `drizzle-kit generate` (generate SQL from schema changes), `drizzle-kit migrate` (apply migrations), `drizzle-kit push` (prototype directly), and `drizzle-kit pull` (introspect existing DB). |
| **[migrations-config.md](references/migrations-config.md)** | Configure `drizzle.config.ts`. Covers `schema` paths, `out` directory, `dialect`, `dbCredentials`, and environment-specific configuration. |

---

### 🔌 Database Drivers (MEDIUM)

| File | Purpose — Read this when you need to… |
|------|----------------------------------------|
| **[driver-postgres.md](references/driver-postgres.md)** | Connect to PostgreSQL. Covers `node-postgres` (`pg` Pool), connection strings, SSL configuration, and pooling strategies. |
| **[driver-serverless.md](references/driver-serverless.md)** | Connect to serverless Postgres. Covers Neon serverless driver, Supabase, `@neondatabase/serverless`, edge-compatible configuration, and WebSocket-based connections. |

---

### 🔬 Advanced Patterns (LOW)

| File | Purpose — Read this when you need to… |
|------|----------------------------------------|
| **[advanced-dynamic-queries.md](references/advanced-dynamic-queries.md)** | Build dynamic queries. Covers conditional where clauses, dynamic column selection, and composing query builders from runtime conditions. |
| **[advanced-sql-operator.md](references/advanced-sql-operator.md)** | Use raw SQL when needed. Covers `sql` template tag for raw expressions, `sql.join()`, and safely mixing raw SQL with the query builder. |
| **[vs-prisma.md](references/vs-prisma.md)** | Compare Drizzle vs Prisma. Covers trade-offs (zero runtime overhead vs code generation, SQL-like vs client-based), migration complexity, and when each is the better choice. Read when migrating from Prisma. |

---

### 📑 Index

| File | Purpose — Read this when you need to… |
|------|----------------------------------------|
| **[_sections.md](references/_sections.md)** | Get the full categorized index of all references with priority levels, file prefixes, and topic descriptions. Use for navigation when you're unsure which file to read. |

---

## Agent Behavioral Rules

1. **Never write Drizzle code from memory.** Always open and read the relevant reference file(s) first. The references contain canonical patterns, correct vs incorrect examples, and rationale.

2. **Migration-first: schema changes start with SQL migrations.** Never start with TypeScript schema and push. Write the SQL migration first, then generate or write the TypeScript reflection. The migration is the source of truth.

3. **Use `$inferSelect` / `$inferInsert` for TypeScript types.** Never manually duplicate type definitions that already exist in the schema. Let Drizzle infer types.

4. **Prefer PostgreSQL-native features.** Use `identity` columns (`GENERATED ALWAYS AS IDENTITY`) over `serial`, native `jsonb` over storing JSON strings, and `text[]` for arrays. Read `engine-postgres.md` for the full catalog.

5. **Use the relational query API for nested data.** `db.query.table.findMany({ with: { related } })` fetches nested relations in a single query. Don't manually stitch results from separate queries.

6. **Use prepared statements for hot paths.** `.prepare()` reduces planning overhead on frequently executed queries.

7. **Don't use `drizzle-kit push` in production.** `push` is for prototyping. Use `generate` + `migrate` for production deployments with version-controlled migration files.

