# Rule: rt-secrets

## Rationale

`Bun.secrets` stores and retrieves sensitive credentials using OS-native credential storage. Experimental — best for local development tools, not production deployment secrets.

## Platform Backends

| Platform | Backend |
|----------|---------|
| macOS | Keychain Services |
| Linux | libsecret (GNOME Keyring, KWallet) |
| Windows | Windows Credential Manager |

## API (all async)

### `Bun.secrets.get(options)` → `Promise<string | null>`

```typescript
const password = await Bun.secrets.get({ service: "my-app", name: "alice@example.com" });
// Or positional:
const password = await Bun.secrets.get("my-app", "alice@example.com");
```

### `Bun.secrets.set(options, value)` → `Promise<void>`

```typescript
await Bun.secrets.set({ service: "my-app", name: "alice" }, "password123");
// Or positional:
await Bun.secrets.set("my-app", "alice", "password123");
```

Overwrites existing credentials.

### `Bun.secrets.delete(options)` → `Promise<boolean>`

```typescript
const deleted = await Bun.secrets.delete({ service: "my-app", name: "alice" });
```

Returns `true` if deleted, `false` if not found.

## Guidelines

- **LOCAL DEV ONLY**: Best for CLI tools, local dev servers, personal API keys
- **NOT FOR PRODUCTION**: Use environment variables for production deployment secrets
- **MEMORY SAFETY**: Memory is zeroed after use. Credentials encrypted at rest by OS.
- **LINUX**: Requires a running secret service daemon (GNOME Keyring, KWallet)
- **EXPERIMENTAL**: API may change in future Bun versions
