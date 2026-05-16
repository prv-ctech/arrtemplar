# Rule: rt-semver

## Rationale

`Bun.semver` provides ~20x faster semver comparison than `node-semver`. Compatible with npm's semver implementation.

## API

### `Bun.semver.satisfies(version, range)` → `boolean`

```typescript
import { semver } from "bun";

semver.satisfies("1.0.0", "^1.0.0"); // true
semver.satisfies("1.0.0", "^1.0.1"); // false
semver.satisfies("1.0.0", "~1.0.0"); // true
semver.satisfies("1.0.0", "1.0.x");  // true
semver.satisfies("1.0.0", "1.x.x");  // true
semver.satisfies("1.0.0", "1.0.0 - 2.0.0"); // true
```

Returns `false` for invalid `range` or `version`.

### `Bun.semver.order(versionA, versionB)` → `0 | 1 | -1`

```typescript
semver.order("1.0.0", "1.0.0"); // 0
semver.order("1.0.0", "1.0.1"); // -1
semver.order("1.0.1", "1.0.0"); // 1

const unsorted = ["1.0.0", "1.0.1", "1.0.0-alpha", "1.0.0-beta", "1.0.0-rc"];
unsorted.sort(semver.order);
// ["1.0.0-alpha", "1.0.0-beta", "1.0.0-rc", "1.0.0", "1.0.1"]
```

## Guidelines

- **REPLACE node-semver**: Use `Bun.semver` for version comparisons (~20x faster)
- **SORTING**: Use `semver.order` as comparator for `Array.sort()`
- **RANGE CHECKS**: Use `semver.satisfies()` for version range matching
- **COMPATIBLE**: Works with npm semver range syntax
