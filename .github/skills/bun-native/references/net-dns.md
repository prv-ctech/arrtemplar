# Rule: net-dns

## Rationale

Bun implements its own DNS module with built-in caching, prefetching, and statistics. This replaces the need for external DNS libraries and provides performance optimizations for repeated connections.

## APIs

### `import { dns } from "bun"`

```typescript
import { dns } from "bun";

dns.prefetch("bun.com", 443);

const stats = dns.getCacheStats();

dns.setServers(["8.8.8.8"]);
const result = dns.lookup("bun.com");
```

### `node:dns` compatibility

```typescript
import * as dns from "node:dns";

const addrs = await dns.promises.resolve4("bun.com", { ttl: true });
```

## DNS Caching

Bun caches DNS entries automatically. Used by: `bun install`, `fetch()`, `node:http`, `Bun.connect`, `node:net`, `node:tls`.

- Up to **255 entries**, max **30 seconds** TTL each
- Failed connections remove the entry
- Simultaneous connections to the same host deduplicate DNS lookups
- Configure TTL: `BUN_CONFIG_DNS_TIME_TO_LIVE_SECONDS=5 bun run my-script.ts`

### `dns.prefetch(hostname, port)`

Pre-resolve a DNS entry before connecting. Useful at startup for database hosts, API endpoints, etc.

```typescript
import { dns } from "bun";
dns.prefetch("my.database-host.com", 5432);
```

Experimental API — may change.

### `dns.getCacheStats()`

```typescript
const stats = dns.getCacheStats();
// {
//   cacheHitsCompleted: number,
//   cacheHitsInflight: number,
//   cacheMisses: number,
//   size: number,
//   errors: number,
//   totalCount: number,
// }
```

## Guidelines

- **PREFETCH AT STARTUP**: Call `dns.prefetch()` for critical external services during app initialization
- **USE CACHING**: Don't build custom DNS caches — Bun's built-in cache handles it
- **ADJUST TTL**: Use `BUN_CONFIG_DNS_TIME_TO_LIVE_SECONDS` for shorter/longer cache durations
- **node:dns COMPAT**: Use `node:dns` APIs when sharing code with Node.js projects

## Bugfixes (1.3.12)

- Stale DNS cache entries referenced by in-flight connections now expire correctly
- `Bun.dns.setServers()` and `Bun.dns.lookup()` no longer crash with invalid inputs
