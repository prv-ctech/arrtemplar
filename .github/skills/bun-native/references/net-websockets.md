# Rule: net-websockets

## Rationale

Bun has a built-in WebSocket server (`Bun.serve({ websocket })`) and extends the browser `WebSocket` client. In this repo, **Elysia handles all WebSocket server concerns**. This reference covers the WebSocket **client** API for outbound connections.

## Architecture Boundary

```
DO NOT use Bun.serve({ websocket }) for app WebSocket routes.
Elysia handles all server-side WebSocket concerns.
Only use the WebSocket CLIENT (new WebSocket(...)) for outbound connections.
```

## WebSocket Client

```typescript
const ws = new WebSocket("ws://localhost:3000");
const wsSecure = new WebSocket("wss://localhost:3000");

ws.onopen = () => ws.send("hello");
ws.onmessage = (event) => console.log(event.data);
ws.onclose = (event) => console.log(event.code, event.reason);
ws.onerror = (event) => console.error(event);
```

### Bun Extensions

```typescript
const ws = new WebSocket("ws://localhost:3000", {
  headers: { Authorization: "Bearer token" },
});
```

### Unix Domain Sockets (Bun 1.3.13+)

```typescript
const ws = new WebSocket("ws+unix:///tmp/app.sock");
const wsWithPath = new WebSocket("ws+unix:///tmp/app.sock:/api/stream?x=1");
const wsTLs = new WebSocket("wss+unix:///tmp/app.sock", {
  tls: { rejectUnauthorized: false },
});
```

- `Host` header defaults to `localhost`
- Proxies automatically skipped for Unix socket URLs
- `wss+unix://` runs full TLS handshake over the domain socket

### Subprotocols

```typescript
const ws = new WebSocket("ws://localhost:3000", ["soap", "wamp"]);
```

## Guidelines

- **CLIENT ONLY**: Use `new WebSocket()` for outbound connections from the server
- **ELYSIA FOR SERVER**: All WebSocket server routes belong in Elysia handlers
- **UNIX SOCKETS**: Use `ws+unix://` for connecting to local services over Unix domain sockets

## Bugfixes (1.3.11/1.3.12/1.3.13/1.3.14)

- `ws.ping()` and `ws.pong()` without arguments now send empty control frames
- WebSocket client validates `Sec-WebSocket-Accept` header per RFC 6455
- WebSocket connections no longer crash with non-ASCII headers/URLs
- Connections over proxy tunnels with bidirectional traffic fixed
- `perMessageDeflate: false` now correctly suppresses the `Sec-WebSocket-Extensions` header in upgrade requests, matching Node.js and `ws` package behavior
- Handshake correctly fails when server responds with `Sec-WebSocket-Extensions` header but client did not offer any extensions (RFC 6455 §9.1)
- `WebSocket.close()` and `WebSocket.terminate()` during `CONNECTING` state now correctly transition to `CLOSED`, fire `error` then `close` (code 1006), and release internal references
- Memory leaks in WebSocket TLS connections and proxy tunnel mode fixed
