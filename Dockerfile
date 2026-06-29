FROM oven/bun:1.3.14-slim AS build

WORKDIR /app

COPY package.json bun.lock bunfig.toml tsconfig.base.json tsconfig.json tsconfig.test.json ./
COPY patches ./patches
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN bun install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages

RUN bun run build

FROM oven/bun:1.3.14-slim AS runtime

WORKDIR /app

COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=build /app/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production \
    SERVER_PORT=3000 \
    WEB_ORIGIN=http://localhost:3000 \
    FRONTEND_DIST_ROOT=/app/apps/web/dist \
    DATABASE_URL=/app/data/db/arrtemplar.sqlite \
    SESSION_COOKIE_SECURE=true \
    HELP_TICKET_STORAGE_ROOT=/app/data/media/ticket \
    LOG_LEVEL=info \
    LOG_FILE_PATH=/app/data/logs/arrtemplar.jsonl \
    LOG_FILE_MAX_SIZE_BYTES=10485760 \
    LOG_FILE_MAX_FILES=5 \
    LOG_CONSOLE=false

RUN mkdir -p /app/data/db /app/data/logs /app/data/media/ticket \
    && chown -R bun:bun /app

USER bun

EXPOSE 3000

VOLUME ["/app/data"]

STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["bun", "-e", "const port = Bun.env.SERVER_PORT ?? '3000'; const response = await fetch('http://127.0.0.1:' + port + '/health'); if (!response.ok) throw new Error('Healthcheck failed: ' + response.status);"]

CMD ["bun", "/app/apps/server/dist/main.js"]