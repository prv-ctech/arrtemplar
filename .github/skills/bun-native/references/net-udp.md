# Rule: net-udp

## Rationale

`Bun.udpSocket()` provides low-latency UDP networking without external dependencies. Useful for DNS, service discovery, metrics, and real-time protocols.

## API: `Bun.udpSocket(options)`

```typescript
const socket = await Bun.udpSocket({
  hostname: "0.0.0.0",
  port: 0, // random port
  socket: {
    data(socket, data, port, address, flags) {
      if (flags?.truncated) {
        console.log("Datagram was truncated!");
      }
    },
    drain(socket) {},
    error(socket, err) {},
  },
});

console.log(socket.port);
```

## Key Methods

### `socket.send(data, port, address)` → `boolean`

Returns `false` on backpressure. Address must be a valid IP (no DNS resolution).

### `socket.sendMany(items)` → `number`

Batch-send multiple packets in a single syscall.

- **Unconnected**: flat array `[data, port, addr, data, port, addr, ...]`
- **Connected**: array of data items `[data, data, ...]`
- Returns number of successfully sent packets

### Connection Mode

```typescript
const client = await Bun.udpSocket({
  connect: { port: server.port, hostname: "127.0.0.1" },
});
client.send("Hello");
```

### Multicast

```typescript
socket.addMembership("224.0.0.1");
socket.dropMembership("224.0.0.1");
socket.setMulticastTTL(5);
socket.setMulticastLoopback(true);
socket.setMulticastInterface("0.0.0.0");
socket.addSourceSpecificMembership(source, group);
socket.dropSourceSpecificMembership(source, group);
```

### Other

- `socket.setBroadcast(bool)` — Enable broadcasting
- `socket.setTTL(n)` — Set IP TTL

## Guidelines

- **NO DNS RESOLUTION**: `send()` requires IP addresses. Resolve DNS separately if needed.
- **HANDLE BACKPRESSURE**: Check `send()` return value; use `drain` handler.
- **TRUNCATION DETECTION**: Check `flags.truncated` in the `data` callback (Bun 1.3.12+).
- **ICMP ERRORS**: ICMP errors (port unreachable, host unreachable) surface through `error` handler; socket stays open (Bun 1.3.12+).

## Bugfixes (1.3.11/1.3.12)

- `reusePort: true` now works on macOS
- Implicit bind-on-send works on macOS
- Socket fd leak on failure fixed
- `addSourceSpecificMembership`/`dropSourceSpecificMembership` socket options no longer inverted
