# Rule: net-fetch

## Rationale

Bun extends the standard `fetch()` API with proxy support, Unix domain sockets, TLS configuration, S3 protocol, and performance features like connection pooling and DNS prefetching.

## Extended Options

```typescript
await fetch("http://example.com", {
  proxy: "http://proxy.com",
  unix: "/var/run/app.sock",
  tls: {
    key: Bun.file("/path/to/key.pem"),
    cert: Bun.file("/path/to/cert.pem"),
    rejectUnauthorized: false,
  },
  decompress: true,
  keepalive: false,
  verbose: true,
});
```

## Protocol Support

- `http://` / `https://` — Standard HTTP
- `s3://` — Fetch from S3 buckets (credentials via `s3` option or env vars). Streaming PUT/POST uses multipart upload automatically.
- `file://` — Fetch local files
- `data:` — Data URLs with base64
- `blob:` — Blob URLs from `URL.createObjectURL()`

## Proxy Support

```typescript
await fetch("http://example.com", {
  proxy: "http://user:pass@proxy.example.com:8080",
});
await fetch("http://example.com", {
  proxy: { url: "http://proxy.com", headers: { "Proxy-Authorization": "Bearer ..." } },
});
```

Keep-alive for HTTPS proxy CONNECT tunnels (Bun 1.3.12+): tunnels and TLS sessions are pooled and reused across sequential requests.

## Performance Features

- **Connection pooling**: Enabled by default. Max 256 simultaneous requests via `BUN_CONFIG_MAX_HTTP_REQUESTS`
- **DNS prefetching**: `fetch.preconnect("https://bun.com")`
- **`sendfile` optimization**: Files >32KB use OS `sendfile` syscall
- **Response buffering**: Optimized `.text()`, `.json()`, `.bytes()`
- **DNS caching**: 30-second default TTL, deduplicated lookups
- **zlib-ng (1.3.13)**: Up to 5.5x faster gzip compression

## Guidelines

- **USE STANDARD FETCH**: In Elysia routes, use standard `fetch()` for outbound HTTP requests
- **PROXY CONFIG**: Set `HTTP_PROXY`/`HTTPS_PROXY` env vars; changes take effect on next fetch (Bun 1.3.12+)
- **CONNECTION POOLING**: Don't manage connection pools manually — Bun handles it
- **STREAMING**: Use `for await (const chunk of response.body)` for large responses
- **TIMEOUT**: Use `AbortSignal.timeout(ms)` for request timeouts

## Experimental HTTP/2 Client (1.3.14)

Enable globally via `BUN_FEATURE_FLAG_EXPERIMENTAL_HTTP2_CLIENT=1` or `--experimental-http2-fetch`, or opt in per-request:

```typescript
// Force HTTP/2 — fails with HTTP2Unsupported if server doesn't support it
await fetch("https://example.com", { protocol: "http2" });

// Force HTTP/1.1 — ignores the experimental flag
await fetch("https://example.com", { protocol: "http1.1" });
```

- Parallel fetches to same origin share one TLS handshake and one multiplexed connection
- Connection pooling with idle HTTP/2 session reuse (HPACK state preserved)
- Streaming `ReadableStream` request bodies with flow control
- `REFUSED_STREAM` and graceful `GOAWAY` transparently retried (up to 5 attempts)
- RFC 9113 conformance: CONTINUATION flood mitigation, HPACK bomb protection, PING reflection attack mitigation
- Not yet supported: HTTP proxies/CONNECT tunneling, Unix sockets, server push, cleartext HTTP/2 (h2c)

## Experimental HTTP/3 Client (1.3.14)

Enable via `BUN_FEATURE_FLAG_EXPERIMENTAL_HTTP3_CLIENT=1` or `--experimental-http3-fetch`:

```typescript
const res = await fetch("https://example.com/", { protocol: "http3" });
```

- QUIC-based transport using lsquic v4.6.2
- Concurrent multiplexed requests over single QUIC connection
- Full-duplex bidirectional streaming (server responds while upload in progress)
- Alt-Svc automatic upgrade: subsequent requests routed over QUIC after server advertises `Alt-Svc: h3`
- `rejectUnauthorized` TLS option, `AbortSignal` support
- ⚠️ Highly experimental — API may change

## Bugfixes (1.3.12/1.3.13/1.3.14)

- Proxy `HTTP_PROXY`/`HTTPS_PROXY` changes at runtime now take effect on next fetch
- AbortController properly rejects queued requests
- Fetch with `HTTP_PROXY` no longer injects incorrect port in proxy URI
- `HTTP/2 WINDOW_UPDATE` fix for stalled client streams
- `fetch()` no longer hangs against hosts that reject ECH GREASE TLS extension (aligned with curl/Node.js)
- Memory leak when following long HTTP redirect chains fixed
- Memory leak with percent-encoded `data:` URLs fixed
