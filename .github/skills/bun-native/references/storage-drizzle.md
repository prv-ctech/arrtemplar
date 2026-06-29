# Rule: storage-drizzle

## Rationale

This repo has already standardized on PostgreSQL with Drizzle ORM. Bun-native guidance should support that choice, not replace it with unrelated storage APIs.

## Guidelines

- **PRIMARY DB**: Use Drizzle ORM with the `postgres` driver for application data.
- **DATABASE URLS**: Read environment values through the repo env layer backed by `Bun.env`.
- **QUERY SHAPE**: Use repositories and prepared Drizzle statements for hot paths when appropriate.
- **DO NOT INTRODUCE `bun:sqlite` OR `Bun.sql`** for the app's primary relational storage.
- **VALKEY IS SEPARATE**: Use Bun's `RedisClient` only for Valkey-backed cache, rate-limit, or coordination concerns. It does not replace relational storage.
- **SCRIPTING**: For migration/bootstrap helpers, prefer Bun-native scripts and subprocesses instead of Node wrappers.

## Examples

### Correct (Repository Pattern & Prepared Statement)

```typescript
import postgres from "postgres";

const sql = postgres(Bun.env.DATABASE_URL ?? "");

class UserRepository {
  private insertUser = db
    .insert(users)
    .values({ name: placeholder("name") })
    .prepare();

  async create(name: string) {
    return this.insertUser.execute({ name });
  }
}
```
