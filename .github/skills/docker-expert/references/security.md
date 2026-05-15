# Docker Security Patterns

## Non-Root User Configuration

```dockerfile
# Create dedicated user with specific UID/GID
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
WORKDIR /app
COPY --chown=appuser:appgroup . .
USER 1001
```

## Secrets Management

### Docker Secrets (Swarm)

```yaml
services:
  app:
    secrets:
      - db_password
secrets:
  db_password:
    external: true
```

### BuildKit Build-Time Secrets

```dockerfile
RUN --mount=type=secret,id=api_key \
    API_KEY=$(cat /run/secrets/api_key) && \
    ./configure.sh
```

```bash
docker build --secret id=api_key,src=./secrets/api_key.txt .
```

### Never Do This

```dockerfile
# BAD - Secrets in image layers
ENV API_KEY=secret123

# BAD - Secrets in ARG
ARG DB_PASSWORD
```

## Runtime Security

### Capability Restrictions

```yaml
services:
  app:
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

### Read-Only Root Filesystem

```yaml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
```

## Security Checklist

- [ ] Non-root user with specific UID/GID
- [ ] No secrets in ENV or ARG
- [ ] Minimal base image (Alpine/distroless)
- [ ] Health checks configured
- [ ] Resource limits set
- [ ] Network isolation
- [ ] Regular base image updates
