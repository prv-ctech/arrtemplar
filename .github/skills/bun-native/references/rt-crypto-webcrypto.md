# Rule: rt-crypto-webcrypto

## Rationale

Bun implements both Web Crypto API (`crypto.subtle`) and `node:crypto` with significant enhancements in 1.3.13 including SHA3 support and X25519 key agreement.

## SHA3 Support (Bun 1.3.13+)

SHA3-224, SHA3-256, SHA3-384, SHA3-512 are now supported across both APIs.

### node:crypto

```typescript
import crypto from "crypto";

const hash = crypto.createHash("sha3-256");
hash.update("Hello, world!");
console.log(hash.digest("hex"));

const hmac = crypto.createHmac("sha3-256", "secret-key");
hmac.update("Hello, world!");
console.log(hmac.digest("hex"));
```

### Web Crypto API

```typescript
const digest = await crypto.subtle.digest(
  "SHA3-256",
  new TextEncoder().encode("Hello, world!"),
);
console.log(Buffer.from(digest).toString("hex"));
```

Works with: `crypto.createHash`, `crypto.createHmac`, `crypto.getHashes`, `crypto.subtle.digest`, `crypto.subtle.sign`/`verify` with HMAC.

## X25519 deriveBits (Bun 1.3.13+)

```typescript
const keyPair = await crypto.subtle.generateKey("X25519", false, ["deriveBits"]);
const remoteKeyPair = await crypto.subtle.generateKey("X25519", false, ["deriveBits"]);

const sharedSecret = await crypto.subtle.deriveBits(
  { name: "X25519", public: remoteKeyPair.publicKey },
  keyPair.privateKey,
  256,
);
```

- Proper rejection of small-order public keys per RFC 7748 §6.1
- Pass `null` or `0` as length for full 32-byte output

## BoringSSL Update (Bun 1.3.13)

Updated to include ML-KEM and ML-DSA (NIST FIPS 203/204) post-quantum algorithms for future support.

## Guidelines

- **SHA3 AVAILABLE**: Use SHA3-256/384/512 where stronger hash algorithms are needed
- **X25519 COMPLETE**: Full key agreement support including `deriveBits`
- **NODE:CRYPTO COMPAT**: Use `node:crypto` for compatibility, WebCrypto for standard APIs
- **POST-QUANTUM**: ML-KEM/ML-DSA available in underlying BoringSSL for future use
