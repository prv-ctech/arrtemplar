# Rule: rt-hashing

## Rationale

Bun provides three levels of hashing: cryptographic password hashing (`Bun.password`), non-cryptographic hashing (`Bun.hash`), and incremental cryptographic hashing (`Bun.CryptoHasher`). Bun 1.3.13 adds SHA3 support.

## Bun.password — Cryptographic Password Hashing

### Async API

```typescript
const hash = await Bun.password.hash("password");
const isMatch = await Bun.password.verify("password", hash);
```

### With Algorithm Options

```typescript
// Argon2id (default, recommended)
await Bun.password.hash(password, {
  algorithm: "argon2id", // "argon2id" | "argon2i" | "argon2d"
  memoryCost: 4,         // kibibytes
  timeCost: 3,           // iterations
});

// Bcrypt
await Bun.password.hash(password, {
  algorithm: "bcrypt",
  cost: 4,               // 4-31
});
```

### Sync API

```typescript
const hash = Bun.password.hashSync(password, { algorithm: "bcrypt", cost: 4 });
const isMatch = Bun.password.verifySync(password, hash);
```

- Algorithm stored in hash — `verify()` auto-detects
- Bcrypt: passwords >72 bytes are SHA-512 pre-hashed (security improvement)
- Salt auto-generated and included in hash

## Bun.hash — Non-Cryptographic Hashing

```typescript
Bun.hash("some data here");           // 11562320457524636935n (Wyhash, 64-bit)
Bun.hash("some data here", 1234);     // with seed

// Input: string, TypedArray, DataView, ArrayBuffer, SharedArrayBuffer

// Available algorithms:
Bun.hash.wyhash(data, seed);       // 64-bit (default)
Bun.hash.crc32(data, seed);        // 32-bit
Bun.hash.adler32(data, seed);      // 32-bit
Bun.hash.cityHash32(data, seed);   // 32-bit
Bun.hash.cityHash64(data, seed);   // 64-bit
Bun.hash.xxHash32(data, seed);     // 32-bit
Bun.hash.xxHash64(data, seed);     // 64-bit
Bun.hash.xxHash3(data, seed);      // 64-bit
Bun.hash.murmur32v3(data, seed);   // 32-bit
Bun.hash.murmur32v2(data, seed);   // 32-bit
Bun.hash.murmur64v2(data, seed);   // 64-bit
Bun.hash.rapidhash(data, seed);    // 64-bit
```

32-bit → `number`; 64-bit → `bigint`

## Bun.CryptoHasher — Incremental Cryptographic Hashing

### Supported Algorithms

`blake2b256`, `blake2b512`, `md4`, `md5`, `ripemd160`, `sha1`, `sha224`, `sha256`, `sha384`, `sha512`, `sha512-224`, `sha512-256`, **`sha3-224`**, **`sha3-256`**, **`sha3-384`**, **`sha3-512`** (SHA3 new in 1.3.13), `shake128`, `shake256`

```typescript
const hasher = new Bun.CryptoHasher("sha256");
hasher.update("hello world");
hasher.digest();              // Uint8Array(32)
hasher.digest("hex");         // string
hasher.digest("base64");      // string
hasher.digest(existingArray); // write into pre-existing TypedArray

// HMAC
const hmacHasher = new Bun.CryptoHasher("sha256", "secret-key");
hmacHasher.update("hello world");
hmacHasher.digest("hex");

const copy = hmacHasher.copy(); // clone before digest
```

### HMAC-Supported Algorithms

`blake2b512`, `md5`, `sha1`, `sha224`, `sha256`, `sha384`, `sha512-224`, `sha512-256`, `sha512`

### Important Notes

- HMAC `CryptoHasher` is NOT reset after `.digest()` — cannot call `.digest()` twice on same instance
- Use `.copy()` to clone state before digesting
- SHA3 support added in Bun 1.3.13 for both WebCrypto and `node:crypto`

## Bun.sha() — Shorthand

```typescript
const sha256 = Bun.sha("hello", "sha256"); // Uint8Array
```

## Guidelines

- **PASSWORD HASHING**: Always use `Bun.password.hash()` / `.verify()` — never bcrypt/argon2 packages
- **NON-CRYPTO**: Use `Bun.hash` for checksums, cache keys, and data integrity (not security)
- **INCREMENTAL**: Use `Bun.CryptoHasher` for streaming hash computation
- **SHA3**: Now available for both `node:crypto` and WebCrypto (Bun 1.3.13+)
- **ARGON2ID DEFAULT**: Prefer argon2id (default) for new password hashing
