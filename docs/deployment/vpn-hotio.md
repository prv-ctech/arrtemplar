# Hotio VPN decision

## Decision

Do not rebase the Arrtemplar app image onto `hotio/base`.

Arrtemplar is a Bun/Elysia web app that serves its frontend and API from one container on port `3000`. It does not need a VPN appliance, `PUID`/`PGID` bootstrap flow, `/config`-managed runtime, `NET_ADMIN`, privileged mode, or `/dev/net/tun` as part of its default app runtime.

`hotio/base` is better treated as a separate VPN-capable container pattern, not as the standard Arrtemplar runtime base.

## Why `hotio/base` is the wrong app base

- It is built around a VPN/bootstrap appliance model, not a Bun application runtime.
- It expects `/config` ownership management and Hotio-style `PUID`, `PGID`, `UMASK`, and `TZ` conventions.
- VPN-enabled deployments often require `NET_ADMIN` and may require `/dev/net/tun` or provider-specific sysctls.
- Arrtemplar's current runtime contract is simpler: one non-root `bun` user, one `/app/data` volume, and no default tunneled egress requirement.

## When Hotio is still useful

Use Hotio only when a separate service genuinely needs outbound VPN routing.

Typical pattern:

1. Run a dedicated Hotio VPN container with its own `/config` mount.
2. Configure `PUID`, `PGID`, `UMASK`, `TZ`, and the WireGuard or OpenVPN provider settings on that VPN container.
3. Grant the VPN container only the capabilities it needs, usually `NET_ADMIN` and sometimes `/dev/net/tun`.
4. Attach only the egress-sensitive service containers to that VPN network context.
5. Keep Arrtemplar outside that network path unless Arrtemplar itself truly needs tunneled outbound traffic.

In Docker Compose terms, that usually means the VPN-dependent service uses `network_mode: "service:<vpn-container>"` or an equivalent shared network pattern. In Unraid, the same idea applies: the VPN appliance is separate, and only the containers that need tunneled egress should share it.

## Current stance

- Arrtemplar app container: no VPN by default.
- Downloader or indexer sidecars: optional VPN candidates.
- Arrtemplar should not receive `NET_ADMIN`, `/dev/net/tun`, privileged mode, or other VPN-only grants unless product scope changes.

## Open question

Does Arrtemplar itself ever need tunneled outbound traffic, or should that remain limited to future auxiliary service containers?

Until that requirement exists, keep the Arrtemplar app runtime separate from the VPN appliance pattern.
