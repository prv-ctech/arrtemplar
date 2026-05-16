# Rule: rt-csrf

## Rationale

`Bun.CSRF` provides built-in CSRF token generation and verification with HMAC signatures and expiration. No external CSRF library needed.

## API

### `Bun.CSRF.generate(secret?, options?)` → `string`

```typescript
const token = Bun.CSRF.generate("my-secret", {
  expiresIn: 3600000,    // 1 hour in ms (default: 86400000 = 24h)
  encoding: "base64url", // "base64" | "base64url" | "hex"
  algorithm: "sha256",   // "sha256" | "sha384" | "sha512" | "sha512-256" | "blake2b256" | "blake2b512"
});
```

### `Bun.CSRF.verify(token, options?)` → `boolean`

```typescript
const isValid = Bun.CSRF.verify(token, {
  secret: "my-secret",
  maxAge: 60000,         // 1 minute in ms (default: 86400000 = 24h)
  encoding: "base64url",
  algorithm: "sha256",
});
```

## Server Example

```typescript
const SECRET = Bun.env.CSRF_SECRET;

// Generate token for form
const token = Bun.CSRF.generate(SECRET, { expiresIn: 3600000 });

// Verify submitted token
app.post("/action", ({ body }) => {
  if (!Bun.CSRF.verify(body.csrfToken, { secret: SECRET })) {
    return new Response("Invalid CSRF token", { status: 403 });
  }
});
```

## Guidelines

- **ALWAYS SET SECRET**: Default secret is per-thread — tokens won't validate across workers/servers/restarts. Use an explicit secret in production.
- **TOKEN CONTENTS**: Cryptographic nonce + timestamp + HMAC signature
- **MATCH OPTIONS**: `encoding` and `algorithm` must match between `generate()` and `verify()`
- **EXPIRY**: Set appropriate `expiresIn`/`maxAge` for your use case
