---
name: devcontainer-config
description: Devcontainer configuration skill for `devcontainer.json`, workspace container features, lifecycle scripts, forwarded ports, and Compose-backed development environments. Use when editing devcontainer settings or troubleshooting devcontainer startup. Do not use it for generic Dockerfile or production container work.
compatibility:
  - github-copilot
  - claude-code
  - openai-codex
license: MIT
metadata:
  author: arrbit
  version: "1.0"
---

# Dev Container Configuration — Agent Instruction Set

> **This file is a map, not the territory.** All detailed property references, configuration patterns, template usage, and validation rules live exclusively in the `references/` and `assets/` directories. This file tells you WHICH reference to read for which task. **Do not write devcontainer configurations until you have read the relevant reference file(s).**

---

## How to Use This Skill

1. **Identify the configuration type**: image-based, Dockerfile-based, or Docker Compose.
2. **Start from an asset template** in `assets/` matching your type.
3. **Read the relevant reference file** for the properties and patterns you need.
4. **For generic Docker/production work**, use the `docker-expert` skill instead.

---

## Reference File Index

| File | Purpose — Read this when you need to… |
|------|----------------------------------------|
| **[properties.md](references/properties.md)** | Look up specific `devcontainer.json` properties. Covers `name`, `image`, `build.dockerfile`, `dockerComposeFile`, `service`, `features`, `forwardPorts`, `portsAttributes`, `customizations.vscode.extensions`, `containerEnv`, `remoteEnv`, `mounts`, and all lifecycle commands (`onCreateCommand`, `updateContentCommand`, `postCreateCommand`, `postStartCommand`). |
| **[patterns.md](references/patterns.md)** | Implement common configuration patterns. Covers image-based vs Dockerfile-based vs Docker Compose setups, feature selection, environment variable strategies (container-wide vs client-specific), port forwarding with custom labels/behaviors, and lifecycle script ordering. |

---

## Agent Behavioral Rules

1. **Never write devcontainer configs from memory.** Always read the relevant reference file(s) and start from an asset template.
2. **Choose the right base type.** Image-based for standard environments, Dockerfile-based for custom tooling, Docker Compose for multi-container apps (app + database/redis/etc.).
3. **Use features over manual installs.** Browse available features at containers.dev/features before writing custom Dockerfile RUN commands.
4. **Lifecycle scripts have a specific order.** `onCreateCommand` → `updateContentCommand` → `postCreateCommand` → `postStartCommand`. Place commands in the right lifecycle stage.
5. **For Docker optimization or production hardening, delegate to `docker-expert` skill.** Devcontainers are for development environments only.

## Advanced Configuration

### Security and Debugging

For debugging languages like C++, Go, Rust:

```json
{
  "capAdd": ["SYS_PTRACE"],
  "securityOpt": ["seccomp=unconfined"]
}
```

For Docker-in-Docker:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },
  "privileged": true
}
```

### Custom Mounts

Mount additional directories or volumes:

```json
{
  "mounts": [
    {
      "source": "${localEnv:HOME}/.ssh",
      "target": "/home/vscode/.ssh",
      "type": "bind"
    },
    {
      "source": "project-cache",
      "target": "/workspace/.cache",
      "type": "volume"
    }
  ]
}
```

### User Configuration

Control which user runs commands:

```json
{
  "containerUser": "vscode",
  "remoteUser": "vscode",
  "updateRemoteUserUID": true
}
```

- `containerUser`: User for all container operations
- `remoteUser`: User for dev tools/terminals
- `updateRemoteUserUID`: Match local user UID/GID on Linux

## Validation

Use the validation script to check configurations:

```bash
python scripts/validate.py /path/to/devcontainer.json
```

The validator checks for:

- Required properties based on scenario
- Proper lifecycle script formats
- Valid port configurations
- Correct variable syntax
- Common configuration issues

Example output:

```
============================================================
Validation Results for: devcontainer.json
============================================================

❌ ERRORS:
  - Must specify one of: 'image', 'build.dockerfile', or 'dockerComposeFile'

⚠️  WARNINGS:
  - Missing 'name' property - recommended for UI display

❌ Validation failed with 1 error(s)
```

## Reference Documentation

For detailed property information:

- **references/properties.md**: Complete reference of all devcontainer.json properties
- **references/patterns.md**: Real-world examples and common patterns

Use these references when:

- Looking up specific property syntax
- Understanding property interactions
- Finding examples for specific scenarios
- Learning about advanced features

## Variables

Available variables for use in string values:

- `${localEnv:VAR_NAME}` - Environment variable from host machine
- `${containerEnv:VAR_NAME}` - Environment variable from container
- `${localWorkspaceFolder}` - Local path to workspace
- `${containerWorkspaceFolder}` - Container path to workspace
- `${localWorkspaceFolderBasename}` - Workspace folder name
- `${devcontainerId}` - Unique container identifier

Default values: `${localEnv:VAR:default_value}`

## Troubleshooting

### Container won't start

- Check that required properties are present (`image`, `build.dockerfile`, or `dockerComposeFile`)
- Validate JSON syntax
- Check that referenced files (Dockerfile, docker-compose.yml) exist

### Permission issues

- Set `updateRemoteUserUID: true` on Linux
- Configure `containerUser` and `remoteUser` appropriately

### Ports not forwarding

- Ensure application listens on `0.0.0.0` not just `localhost`
- Check `forwardPorts` configuration
- Review `portsAttributes` settings

### Features not installing

- Verify feature IDs are correct
- Check network connectivity
- Use `overrideFeatureInstallOrder` if dependencies exist

### Lifecycle scripts failing

- Check script syntax (string vs array vs object)
- Review script output in dev container log
- Ensure required tools are available in container
- Remember: If a script fails, subsequent scripts won't run
