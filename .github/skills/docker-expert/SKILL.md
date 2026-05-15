---
name: docker-expert
description: Docker containerization skill for Dockerfiles, Compose, image optimization, container security, and build or deployment patterns. Use when editing Dockerfiles, docker compose setup, image layers, build caching, container hardening, or runtime packaging. Do not use it for devcontainer-only work.
compatibility:
  - github-copilot
  - claude-code
  - openai-codex
license: MIT
metadata:
  author: arrbit
  version: "1.0"
---

# Docker Expert — Agent Instruction Set

> **This file is a map, not the territory.** All detailed patterns, configuration examples, security hardening rules, and compose patterns live exclusively in the `references/` directory. This file tells you WHICH reference to read for which task. **Do not write Dockerfiles or compose configurations until you have read the relevant reference file(s).**

---

## How to Use This Skill

1. **Identify the task** from the description above (keywords: Dockerfile, Compose, image optimization, container security, build caching, hardening).
2. **Read the matching reference file** from the index below.
3. **Cross-reference** when needed. For example: a production Dockerfile → read `optimization.md` + `security.md`.
4. **For devcontainer work**, use the `devcontainer-config` skill instead.

---

## Reference File Index

| File | Purpose — Read this when you need to… |
|------|----------------------------------------|
| **[optimization.md](references/optimization.md)** | Optimize builds and images. Covers multi-stage builds, build caching, layer ordering for cache efficiency, image size reduction, and `.dockerignore` best practices. |
| **[security.md](references/security.md)** | Harden containers for production. Covers non-root users (`USER`), minimal base images (Alpine/distroless), secrets management (Docker secrets, not `ENV`), filesystem read-only, and capability dropping. |
| **[compose.md](references/compose.md)** | Orchestrate multi-container apps. Covers service definitions, networking, volumes, health checks, `depends_on` with conditions, and environment configuration. |

---

## Agent Behavioral Rules

1. **Never write Dockerfiles from memory.** Always read the relevant reference file(s) first.
2. **Always use non-root users.** Never run containers as root in production. Use `USER` with a specific UID/GID.
3. **Never pass secrets via `ENV`.** Use Docker secrets, mounted files, or a secrets manager. `ENV` values are visible in `docker inspect`.
4. **Use multi-stage builds for production images.** Separate build dependencies from runtime artifacts to minimize image size and attack surface.
5. **Pin base image versions.** Never use `latest` tags in production. Use specific digest or version tags.
6. **For devcontainer work, delegate to `devcontainer-config` skill.** Dockerfiles for development containers follow different rules than production images.
