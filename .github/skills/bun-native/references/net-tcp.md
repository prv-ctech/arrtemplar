# Rule: net-tcp

## Rationale

`Bun.listen()` and `Bun.connect()` provide low-level TCP socket access for library authors and custom protocol implementations. Not for HTTP — use Elysia for that.

## API: `Bun.listen(options)` — TCP Server

```typescript
const server = Bun.listen({
  hostname: "localhost",
  port: 8080,
  socket: {
    data(socket, data) {},
    open(socket) {},
    close(socket, error) {},
    drain(socket) {},
    error(socket, error) {},
  },
});

server.stop();
server.unref();
```

- Handlers declared **once per server**, shared among all sockets (low GC pressure)
- Contextual data: `socket.data = { sessionId: "abcd" }` in `open` handler
- Generics: `Bun.listen<SocketData>({...})`
- TLS: pass `tls: { key, cert }` (string, BunFile, TypedArray, Buffer, or array)
- Hot reload: `server.reload({ socket: { data() {} } })`

## API: `Bun.connect(options)` — TCP Client

```typescript
const socket = await Bun.connect({
  hostname: "localhost",
  port: 8080,
  socket: {
    data(socket, data) {},
    open(socket) {},
    close(socket, error) {},
    drain(socket) {},
    error(socket, error) {},
    connectError(socket, error) {},
    end(socket) {},
    timeout(socket) {},
  },
  tls: true,
});
```

- Client-specific handlers: `connectError`, `end`, `timeout`
- Hot reload: `socket.reload({ data() {} })`

## Buffering

TCP sockets do **not** buffer data. Many small `.write()` calls are slow. Use `ArrayBufferSink` with `{ stream: true }` for batching.

## Guidelines

- **NOT FOR HTTP**: Use Elysia for HTTP. This is for custom TCP protocols only.
- **BUFFER WRITES**: Use `ArrayBufferSink` for batching small writes.
- **HANDLE BACKPRESSURE**: Use the `drain` handler.
- **UNIX SOCKETS**: `Bun.listen({ unix: "/tmp/my.sock", socket: {...} })`. Bun now matches Node.js semantics: `EADDRINUSE` on existing file, auto-cleanup on close.

## Bugfixes (1.3.12)

- Unix domain socket lifecycle matches Node.js (EADDRINUSE, auto-cleanup)
- Socket paths longer than 104 bytes work on macOS
- `Bun.listen()` and `Bun.connect()` throw `TypeError` instead of crashing with invalid values
