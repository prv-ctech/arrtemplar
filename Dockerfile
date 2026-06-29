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

COPY package.json bun.lock bunfig.toml ./
COPY patches ./patches
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN bun install --frozen-lockfile --production

COPY apps/server ./apps/server
COPY packages/shared ./packages/shared
COPY --from=build /app/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production \
    SERVER_PORT=3000 \
    WEB_ORIGIN=http://localhost:3000 \
    FRONTEND_DIST_ROOT=apps/web/dist \
    DATABASE_URL=data/db/arrtemplar-dev.sqlite \
    SESSION_COOKIE_SECURE=false \
    LOG_LEVEL=info \
    LOG_FILE_PATH=data/logs/arrtemplar.jsonl \
    LOG_FILE_MAX_SIZE_BYTES=10485760 \
    LOG_FILE_MAX_FILES=5 \
    LOG_CONSOLE=false

RUN mkdir -p /app/data/db /app/data/logs /app/data/media/ticket \
    && chown -R bun:bun /app

USER bun

EXPOSE 3000

CMD ["bun", "run", "--cwd", "apps/server", "start"]