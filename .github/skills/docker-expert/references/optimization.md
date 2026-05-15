# Docker Optimization Patterns

## Build Cache Optimization

### Layer Ordering

Copy dependency files before source code for optimal caching:

```dockerfile
# Good - dependencies cached separately
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build

# Bad - cache invalidated on any source change
COPY . .
RUN bun install && bun run build
```

### BuildKit Cache Mounts

```dockerfile
RUN --mount=type=cache,target=/root/.bun \
    bun install
```

## Multi-Stage Patterns

### Bun Production

```dockerfile
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install

FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build

FROM oven/bun:1 AS runtime
WORKDIR /app
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/dist ./dist
USER bun
CMD ["node", "dist/index.js"]
```

### Distroless Minimal

```dockerfile
FROM gcr.io/distroless/nodejs18-debian11
COPY --from=build /app/dist /app
COPY --from=build /app/node_modules /app/node_modules
WORKDIR /app
CMD ["index.js"]
```

## Size Reduction

| Strategy            | Impact                |
| ------------------- | --------------------- |
| Alpine base         | -100MB vs Debian      |
| Multi-stage         | -200MB build tools    |
| Distroless          | -50MB package manager |
| Layer consolidation | -10MB metadata        |

## .dockerignore

```
node_modules
npm-debug.log
Dockerfile*
docker-compose*
.git
.gitignore
.env*
*.md
coverage
.nyc_output
```
