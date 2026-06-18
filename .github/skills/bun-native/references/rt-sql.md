# Rule: rt-sql

## Rationale

`Bun.SQL` provides a built-in SQL client for PostgreSQL, MySQL, and SQLite with tagged template literal queries. In this repo, it is **only for tooling, scripts, and ad-hoc queries** — application data uses Drizzle + the `postgres` driver.

## Architecture Boundary

```
Application data → Drizzle + postgres driver (NEVER Bun.SQL for app data)
Tooling/scripts/ad-hoc → Bun.SQL is acceptable
```

## API

### Connection

```typescript
import { sql } from "bun";
// Uses DATABASE_URL env var, auto-detects adapter

import { SQL } from "bun";
const pg = new SQL("postgres://user:pass@localhost:5432/mydb");
const mysql = new SQL("mysql://user:pass@localhost:3306/mydb");
const sqlite = new SQL("sqlite://myapp.db");
const mem = new SQL(":memory:");
```

### Tagged Template Queries

```typescript
const users = await sql`SELECT * FROM users WHERE active = ${true} LIMIT ${10}`;

const [user] = await sql`INSERT INTO users (name, email) VALUES (${name}, ${email}) RETURNING *`;

await sql`INSERT INTO users ${sql([
  { name: "Alice", email: "alice@example.com" },
  { name: "Bob", email: "bob@example.com" },
])}`;
```

### SQL Fragments

```typescript
await sql`SELECT * FROM ${sql("users")}`; // dynamic table names

const filter = sql`AND age > ${minAge}`;
await sql`SELECT * FROM users WHERE active = ${true} ${filterAge ? filter : sql``}`;

await sql`SELECT * FROM users WHERE id IN ${sql([1, 2, 3])}`;
```

### Transactions

```typescript
await sql.begin(async (tx) => {
  await tx`INSERT INTO users (name) VALUES (${"Alice"})`;
  await tx`UPDATE accounts SET balance = balance - 100 WHERE user_id = 1`;
});

await sql.begin(async (tx) => {
  await tx.savepoint(async (sp) => {
    await sp`UPDATE users SET status = 'active'`;
  });
});
```

### Connection Pooling

```typescript
const sql = new SQL({
  max: 20,
  idleTimeout: 30,
  maxLifetime: 3600,
  connectionTimeout: 10,
});
```

### Reserved Connections

```typescript
{
  using reserved = await sql.reserve();
  await reserved`SELECT 1`;
} // auto-released
```

## Guidelines

- **TOOLING ONLY**: Never use for application data — use Drizzle + `postgres` driver
- **PREPARED STATEMENTS**: Auto-enabled for static queries; disable with `prepare: false` for PgBouncer
- **TAGGED TEMPLATES**: Use tagged template literals for safe parameterized queries
- **TRANSACTIONS**: Use `sql.begin()` for atomic operations
- **DYNAMIC PASSWORDS**: Use `password: async () => await signer.getAuthToken()` for rotating credentials

## Environment Variables

| Database | Primary | Fallback |
|----------|---------|----------|
| PostgreSQL | `POSTGRES_URL` | `DATABASE_URL` |
| MySQL | `MYSQL_URL` | `DATABASE_URL` |
| SQLite | `DATABASE_URL` | — |
