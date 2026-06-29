# Unraid deployment

This page covers the current single-container Unraid setup for Arrtemplar.

Arrtemplar listens on container port `3000`. The built frontend and the API come from that same server. Production does not run a Vite dev or preview server in the container.

## Base template values

- Repository: `prvctech/arrtemplar:latest`
- AppData volume: `/mnt/cache/appdata/arrtemplar:/app/data`
- Container port: `3000`
- Host port example: `7123`
- Network type: bridge or a custom network
- Privileged: off
- Tailscale: off unless you are deliberately layering it in yourself
- Extra Parameters: remove `--user 0:0`

If you need a pinned image for rollback, use a `sha-*` or semver tag instead of `latest`.

If you need VPN-routed egress for a different service, keep Arrtemplar out of that path by default and use a separate VPN container pattern. See `docs/deployment/vpn-hotio.md`.

## Common env values

These image defaults are usually correct on Unraid and can stay as-is:

- `FRONTEND_DIST_ROOT=/app/apps/web/dist`
- `DATABASE_URL=/app/data/db/arrtemplar.sqlite`
- `HELP_TICKET_STORAGE_ROOT=/app/data/media/ticket`
- `LOG_FILE_PATH=/app/data/logs/arrtemplar.jsonl`
- `LOG_LEVEL=info`
- `LOG_CONSOLE=false`

The two values you must set for the actual deployment profile are `WEB_ORIGIN` and `SESSION_COOKIE_SECURE`.

## Profile: LAN HTTP

Use this only when users open Arrtemplar directly over plain HTTP on the LAN.

- Host port: `7123`
- Container port: `3000`
- Volume: `/mnt/cache/appdata/arrtemplar:/app/data`
- `WEB_ORIGIN=http://192.168.13.9:7123`
- `SESSION_COOKIE_SECURE=false`

That gives you a direct LAN URL at `http://192.168.13.9:7123`.

## Profile: HTTPS reverse proxy

Use this when Nginx Proxy Manager, Traefik, Caddy, or another reverse proxy terminates TLS in front of Arrtemplar.

- Host port can stay `7123` or move to any internal port you prefer.
- Container port stays `3000`.
- `WEB_ORIGIN=https://arrtemplar.example.com`
- `SESSION_COOKIE_SECURE=true`

The reverse proxy owns the public HTTPS port. Arrtemplar still serves the app internally from port `3000`.

## Non-root runtime

The image runs as the bundled non-root `bun` user (`uid=1000`, `gid=1000` in the upstream `oven/bun:1.3.14-slim` image). Do not add `--user 0:0` back to the template.

If `/mnt/cache/appdata/arrtemplar` was created by an older root-run container, correct the host-side ownership before the first non-root redeploy:

```sh
chown -R 1000:1000 /mnt/cache/appdata/arrtemplar
```

If permissions still fail after that, treat it as a data-path ownership issue and fix the path instead of restoring a root override.

## First deploy checklist

1. Set the repository tag you want.
2. Map `7123` on the host to `3000` in the container.
3. Mount `/mnt/cache/appdata/arrtemplar` to `/app/data`.
4. Set `WEB_ORIGIN` for the real URL.
5. Set `SESSION_COOKIE_SECURE=false` for LAN HTTP or `true` for HTTPS.
6. Leave privileged mode off.
7. Remove `--user 0:0` from Extra Parameters.

## After deploy

- Open the login page at the configured `WEB_ORIGIN`.
- Check `http://<host>:<port>/health` from the same network.
- Confirm the database appears under `/mnt/cache/appdata/arrtemplar/db`.
- Confirm logs appear under `/mnt/cache/appdata/arrtemplar/logs`.

## Upgrades

On each upgrade, keep the same `/app/data` mount and env values. Pull the new tag, redeploy, then verify `/health` and the login page.
