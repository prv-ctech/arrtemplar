# Docker deployment

Arrtemplar ships as one containerized app. The image runs one Bun/Elysia server on container port `3000`. That server serves the built frontend and the API from the same origin.

Vite is build-only in production. The image already contains `apps/web/dist`. There is no Vite dev server and no Vite preview server in the container.

## What persists

Mount `/app/data` to persistent storage.

Everything that matters at runtime lives under that path:

- SQLite database: `/app/data/db/arrtemplar.sqlite`
- Help ticket media: `/app/data/media/ticket`
- Rotating JSONL logs: `/app/data/logs/arrtemplar.jsonl`

Back up the whole `/app/data` tree. That covers the database, logs, and uploaded ticket media in one place.

## Runtime defaults

These values are baked into the image unless you override them:

- `NODE_ENV=production`
- `SERVER_PORT=3000`
- `WEB_ORIGIN=http://localhost:3000`
- `FRONTEND_DIST_ROOT=/app/apps/web/dist`
- `DATABASE_URL=/app/data/db/arrtemplar.sqlite`
- `HELP_TICKET_STORAGE_ROOT=/app/data/media/ticket`
- `LOG_LEVEL=info`
- `LOG_FILE_PATH=/app/data/logs/arrtemplar.jsonl`
- `LOG_FILE_MAX_SIZE_BYTES=10485760`
- `LOG_FILE_MAX_FILES=5`
- `LOG_CONSOLE=false`
- `SESSION_COOKIE_SECURE=true`

Keep container port `3000`. Change the host port if you want a different external port.

## Deployment profiles

### HTTPS reverse proxy

Use this when a reverse proxy terminates TLS and publishes Arrtemplar at a public HTTPS URL.

- Set `WEB_ORIGIN` to the public HTTPS URL.
- Keep `SESSION_COOKIE_SECURE=true`.
- Map any host port you want to container port `3000`.

Example:

```sh
docker run -d \
  --name arrtemplar \
  -p 3000:3000 \
  -v /srv/arrtemplar:/app/data \
  -e WEB_ORIGIN=https://arrtemplar.example.com \
  -e SESSION_COOKIE_SECURE=true \
  prvctech/arrtemplar:latest
```

### LAN HTTP

Use this only when you are serving Arrtemplar over plain HTTP on a trusted LAN.

- Set `WEB_ORIGIN` to the real HTTP URL users open in the browser.
- Override `SESSION_COOKIE_SECURE=false`.
- Keep the container port at `3000`.

Example:

```sh
docker run -d \
  --name arrtemplar \
  -p 7123:3000 \
  -v /srv/arrtemplar:/app/data \
  -e WEB_ORIGIN=http://192.168.1.50:7123 \
  -e SESSION_COOKIE_SECURE=false \
  prvctech/arrtemplar:latest
```

## Container behavior

- Health check: the image probes `http://127.0.0.1:3000/health`
- Stop signal: `SIGTERM`
- Runtime user: the bundled non-root `bun` user (`uid=1000`, `gid=1000` in the upstream `oven/bun:1.3.14-slim` image)
- Privileged mode: not required
- Root override: do not add `--user 0:0`

Read-only rootfs is not enabled yet. Keep `/app/data` as the only intended persistent write target, then validate any temporary-path needs before turning on a read-only root filesystem.

If `/app/data` came from an older root-run container, fix the host-side ownership before redeploying. Example one-time fix for a host path such as `/srv/arrtemplar`:

```sh
chown -R 1000:1000 /srv/arrtemplar
```

Do not keep a root override as the long-term fix.

## Logs

Application logs go to `/app/data/logs/arrtemplar.jsonl` with rotation controlled by `LOG_FILE_MAX_SIZE_BYTES` and `LOG_FILE_MAX_FILES`.

`LOG_CONSOLE=false` in the image keeps routine app logs out of the container console. Set `LOG_CONSOLE=true` only when you want terminal mirroring for troubleshooting.

## Upgrade flow

1. Pick a tag: `latest`, a semver tag, or a pinned `sha-*` tag.
2. Pull the new image.
3. Stop and remove the old container.
4. Recreate it with the same `/app/data` mount and env values.
5. Check `/health` and open the login page.

Example:

```sh
docker pull prvctech/arrtemplar:latest
docker rm -f arrtemplar
docker run -d \
  --name arrtemplar \
  -p 7123:3000 \
  -v /srv/arrtemplar:/app/data \
  -e WEB_ORIGIN=http://192.168.1.50:7123 \
  -e SESSION_COOKIE_SECURE=false \
  prvctech/arrtemplar:latest
```

If you want a safer rollback path, deploy a pinned `sha-*` or semver tag instead of `latest`.
