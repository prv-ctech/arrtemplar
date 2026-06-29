# Rule: core-redaction (`@logtape/redaction`)

> Source: <https://logtape.org/manual/redaction>.

`@logtape/redaction` (since 0.10.0) scrubs sensitive data two complementary
ways: **pattern-based** (regex on formatted output) and **field-based** (by
property name on the record).

> **No redaction is perfect.** Prefer not logging secrets at all; redaction is defense-in-depth.

## Install

```bash
bun add @logtape/redaction
```

## Pattern-based redaction — `redactByPattern()`

Wraps a `TextFormatter` or `ConsoleFormatter` and replaces matched text in the
formatted output. Good for catching secrets embedded in message strings.

```typescript
import { defaultConsoleFormatter, getConsoleSink } from "@logtape/logtape";
import { EMAIL_ADDRESS_PATTERN, JWT_PATTERN, redactByPattern } from "@logtape/redaction";

const formatter = redactByPattern(defaultConsoleFormatter, [EMAIL_ADDRESS_PATTERN, JWT_PATTERN]);
const sink = getConsoleSink({ formatter });
```

For console formatters that return arrays with objects, traversal is recursive,
capped at `maxDepth: 20` and `maxProperties: 1000` by default (override them):
overrun emits a meta-logger warning and truncates.

### Built-in patterns

- `EMAIL_ADDRESS_PATTERN`, `CREDIT_CARD_NUMBER_PATTERN`, `JWT_PATTERN`, `US_SSN_PATTERN`, `KR_RRN_PATTERN`.

### Custom patterns

Each pattern is an object `{ pattern, replacement }` where `pattern` is a `RegExp` that **must have the `g` flag**, and `replacement` is a string. A non-global regex throws `TypeError`.

```typescript
import { redactByPattern, type RedactionPattern } from "@logtape/redaction";

const API_KEY_PATTERN: RedactionPattern = {
  pattern: /xz([a-zA-Z0-9_-]{32})/g,
  replacement: "REDACTED_API_KEY",
};
```

## Field-based redaction — `redactByField()`

Wraps a **sink** and redacts matching property names on the record before it
reaches the sink/formatter. More efficient (checks names, not values) and works
before formatting.

```typescript
import { getConsoleSink } from "@logtape/logtape";
import { redactByField } from "@logtape/redaction";

const sink = redactByField(getConsoleSink()); // uses DEFAULT_REDACT_FIELDS
```

### Custom field patterns + behavior

`fieldPatterns` is an array of strings (exact) or regex. Default `action`
removes the field; replace with a custom `action(value)`:

```typescript
import { DEFAULT_REDACT_FIELDS, redactByField } from "@logtape/redaction";

const sink = redactByField(getConsoleSink(), [
  /pass(?:code|phrase|word)/i,
  /api[-_]?key/i,
  "secret",
  ...DEFAULT_REDACT_FIELDS,
]);

const replaced = redactByField(getConsoleSink(), {
  fieldPatterns: [/password/i, /secret/i],
  action: () => "[REDACTED]",
  maxDepth: 10,
  maxProperties: 200,
});
```

Field redaction is recursive (nested objects and arrays). Overrun truncates and
warns the meta logger; for tagged-template messages, unmatchable interpolated
values become `"[truncated]"`.

### Pseudonymizing for correlation (since 2.1.0)

Replace a sensitive identifier with a **stable** token so records still
correlate without logging the original. `createHmacPseudonymizer()` uses keyed
HMAC via Web Crypto (safer than salted hashing for small input spaces like
emails/numeric IDs); defaults to `hmac-sha256:` + base64url. Because Web Crypto
is async, it pairs with `redactByFieldAsync()` (async-disposal sink):

```typescript
import { configure, dispose, getConsoleSink } from "@logtape/logtape";
import { createHmacPseudonymizer, redactByFieldAsync } from "@logtape/redaction";

const pseudonymize = await createHmacPseudonymizer({ key: "replace-with-a-secret-key" });

const sink = redactByFieldAsync(getConsoleSink(), {
  fieldPatterns: [/userId/i, /email/i],
  action: pseudonymize,
});

await configure({ sinks: { console: sink }, loggers: [{ category: "my-app", sinks: ["console"] }] });
// before shutdown:
await dispose();
```

## Comparing the two

**Pattern-based** — pros: catches structured patterns (cards, SSNs) anywhere in
output, works with any formatter, can scrub inside message strings. Cons:
higher perf cost, regex on all text, possible false positives, operates after
formatting (secret is briefly in memory).

**Field-based** — pros: efficient (names only), runs before the sink/formatter,
fewer false positives, works with any sink. Cons: can't see free-form text,
needs known field names, may miss unexpected names.

## Combining both (max security)

```typescript
const sink = redactByField(
  getConsoleSink({
    formatter: redactByPattern(defaultConsoleFormatter, [EMAIL_ADDRESS_PATTERN, JWT_PATTERN]),
  }),
);
```

## This repo's setup (`apps/server/src/logging/redaction.ts`)

`createRedactedSink(sink)` chains two `redactByField` passes:

1. URL-sensitive fields (`referrer`, `url`) → `redactUrlField` (parses and scrubs query/cookie params).
2. App-sensitive fields (extends `DEFAULT_REDACT_FIELDS` with `email`, `sessionToken`, `tokenHash`, `passwordHash`, `errorMessage`, `formattedQuery`, `params`, `cookie`, `authorization`, `csrf`, …) → `"[REDACTED]"`.

`createRedactedTextFormatter(formatter)` wraps the formatter with
`redactByPattern` over `EMAIL_ADDRESS_PATTERN`, `JWT_PATTERN`,
`CREDIT_CARD_NUMBER_PATTERN`, plus repo-specific patterns (the
`arrtemplar_session=` cookie, `key=value`-style secrets, and a credit-card
regex). **Always wrap sinks via `createRedactedSink()` and formatters via
`createRedactedTextFormatter()`** — do not bypass redaction.

## Best practices

- Pattern-based for secrets in message strings with well-defined patterns.
- Field-based for structured data with known field names.
- Combine both for security-critical apps.
- Test edge cases (partial matches, multi-line).
- For high volume, prefer field-based (cheaper).
