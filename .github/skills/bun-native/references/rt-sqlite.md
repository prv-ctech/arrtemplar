# Rule: rt-sqlite

## Rationale

`bun:sqlite` provides a synchronous SQLite3 driver. In this repo, it is **only for tooling, testing, and local development** — never for application data, which uses Drizzle + PostgreSQL.

## Architecture Boundary

```
Application data → Drizzle + postgres (NEVER bun:sqlite)
Tooling/testing/local dev → bun:sqlite is acceptable
```

## API

### Database

```typescript
import { Database } from "bun:sqlite";

const db = new Database("mydb.sqlite");
const db = new Database(":memory:");
const db = new Database("mydb.sqlite", { readonly: true, create: true, strict: true, safeIntegers: true });
```

### WAL Mode (Recommended)

```typescript
db.run("PRAGMA journal_mode = WAL;");
```

### Statements

```typescript
const query = db.query("SELECT * FROM users WHERE id = $id");

query.all({ $id: 1 });     // T[]
query.get({ $id: 1 });     // T | null
query.run({ $id: 1 });     // { lastInsertRowid, changes }
query.values({ $id: 1 });  // unknown[][]
query.iterate({ $id: 1 }); // Iterable

query.as(UserClass); // map results to class instances
query.finalize();    // destroy, free resources
```

### Parameters

```typescript
// Named
db.query("SELECT * FROM foo WHERE bar = $bar").all({ $bar: "bar" });

// Positional
db.query("SELECT ?1, ?2").all("hello", "goodbye");

// Strict mode: bind without $ prefix
const db = new Database(":memory:", { strict: true });
db.query("SELECT $message").all({ message: "Hello world" });
```

### Transactions

```typescript
const insert = db.prepare("INSERT INTO cats (name) VALUES ($name)");
const insertCats = db.transaction((cats) => {
  for (const cat of cats) insert.run(cat);
  return cats.length;
});

insertCats([{ $name: "Keanu" }, { $name: "Salem" }]);
insertCats.deferred(cats);
insertCats.immediate(cats);
insertCats.exclusive(cats);
```

Nested transactions become savepoints. Exceptions trigger rollback.

### Serialize/Deserialize

```typescript
const contents = olddb.serialize(); // Uint8Array
const newdb = Database.deserialize(contents);
```

### Disposable

```typescript
{
  using db = new Database("mydb.sqlite");
  using query = db.query("select 'Hello world' as message;");
}
```

## Performance

- 3-6x faster than `better-sqlite3`
- 8-9x faster than `deno.land/x/sqlite`

## Datatype Mappings

| JavaScript | SQLite |
|-----------|--------|
| `string` | `TEXT` |
| `number` | `INTEGER` or `DECIMAL` |
| `boolean` | `INTEGER` (1 or 0) |
| `Uint8Array` / `Buffer` | `BLOB` |
| `bigint` | `INTEGER` |
| `null` | `NULL` |

## Guidelines

- **TOOLING ONLY**: Never use for application data — use Drizzle + PostgreSQL
- **WAL MODE**: Always enable WAL for better concurrent read performance
- **PREPARED STATEMENTS**: Use `db.query()` (cached) for repeated queries
- **TRANSACTIONS**: Use `db.transaction()` for atomic multi-statement operations
- **DISPOSABLE**: Use `using` for automatic resource cleanup
