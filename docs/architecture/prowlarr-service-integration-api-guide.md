# Prowlarr Service Integration API Guide

**Date:** 2026-06-26
**Status:** research-grounded reference
**Primary sources:** official OpenAPI JSON, official repo source, Arrtemplar service-integration code

## Purpose

Future-reference guide for adding Prowlarr as an Arrtemplar service integration. This guide is intentionally limited to API/architecture facts and local extension points. It does **not** prescribe implementation tasks.

## Official API Basics

### Base URL and versioning

- Published OpenAPI URL: `https://raw.githubusercontent.com/Prowlarr/Prowlarr/develop/src/Prowlarr.Api.V1/openapi.json`
- Human docs entrypoint: `https://prowlarr.com/docs/api/`
- OpenAPI server template: `{protocol}://{hostpath}`
- OpenAPI defaults: `http://localhost:9696`
- Main REST prefix: `/api/v1/...`
- Example instance base from user context: `http://192.168.13.9:9696/`

### Auth facts

| Mechanism | Official evidence | Notes |
| ---------- | ------------------- | ------- |
| `X-Api-Key` header | OpenAPI `securitySchemes.X-Api-Key` | Best fit for Arrtemplar service-to-service auth. |
| `apikey` query param | OpenAPI `securitySchemes.apikey` | Officially supported, but header auth is cleaner for logging/security. |
| `POST /login` form auth | OpenAPI request body is `multipart/form-data`; repo marks `AuthenticationController` anonymous | Browser/session oriented, not required for minimal instance integration. |
| `GET /ping` anonymous | Repo marks `PingController` `AllowAnonymous` | Good for optional liveness without a key. |

### Content types

- Most API endpoints return `application/json`.
- `POST /login` consumes `multipart/form-data`.
- Log file endpoints such as `GET /api/v1/log/file/{filename}` return `text/plain`.

### Response-code reality

- Official spec overwhelmingly documents `200 OK`.
- Some operations explicitly add `404 Not Found` and `500 Internal Server Error`.
- The generated spec does **not** consistently enumerate `401/403` for secured endpoints, even though API-key security is declared globally.

## Minimal Arrtemplar Validation Flow

Use this as the smallest endpoint set analogous to current qBittorrent/SABnzbd connection testing:

1. **Optional liveness:** `GET /ping`
   - Why: confirms host/port reachability without needing a key.
   - Upstream auth note: anonymous in repo source.

2. **Primary authenticated validation:** `GET /api/v1/system/status`
   - Why: returns version/runtime/platform/auth/url-base data in one call.
   - Best fit for Arrtemplar’s existing normalized probe fields: `reachable`, `authenticated`, `compatible`, `version`, and a summary string.

3. **Optional health summary:** `GET /api/v1/health`
   - Why: returns health items with `source`, `type`, `message`, and `wikiUrl`.
   - Use when product wants a warning/issue summary beyond basic connectivity.

4. **Optional richer ops summary:** `GET /api/v1/indexerstatus` and/or `GET /api/v1/indexerstats`
   - Why: useful if Arrtemplar later surfaces per-indexer operational health or stats.
   - Not required for initial instance-validation parity.

### Important non-goal

Do **not** use these as Arrtemplar’s own Prowlarr-instance validation call:

- `POST /api/v1/indexer/test`
- `POST /api/v1/applications/test`
- `POST /api/v1/downloadclient/test`

Those test resources configured **inside** Prowlarr, not the Prowlarr server instance itself.

## Useful Upstream Endpoint Catalog

### Validation and status

| Method | Path | Likely Arrtemplar use |
| ------- | ------ | ------------------------ |
| `GET` | `/ping` | Anonymous liveness check |
| `HEAD` | `/ping` | Lightweight liveness |
| `GET` | `/api/v1/system/status` | Main authenticated version/status check |
| `GET` | `/api/v1/health` | Optional health summary |
| `GET` | `/api` | API info/current/deprecated data; optional |
| `GET` | `/api/v1/system/task` | Optional scheduled-task visibility |
| `GET` | `/api/v1/system/task/{id}` | Optional task detail |

### Inventory Arrtemplar may later want to read

| Method | Path | Notes |
| ------- | ------ | ------- |
| `GET` | `/api/v1/indexer` | Lists configured indexers |
| `GET` | `/api/v1/indexer/{id}` | Reads one indexer |
| `GET` | `/api/v1/indexer/categories` | Default indexer categories |
| `GET` | `/api/v1/indexerstatus` | Per-indexer status summary |
| `GET` | `/api/v1/indexerstats` | Aggregate indexer stats |
| `GET` | `/api/v1/applications` | Lists Prowlarr-managed application integrations |
| `GET` | `/api/v1/downloadclient` | Lists Prowlarr-managed download clients |
| `GET` | `/api/v1/tag` | Lists tags |
| `GET` | `/api/v1/tag/detail` | Lists tag relationships |
| `GET` | `/api/v1/tag/detail/{id}` | Reads one tag relationship set |
| `GET` | `/api/v1/history` | General history feed |
| `GET` | `/api/v1/history/since` | Incremental history feed |
| `GET` | `/api/v1/history/indexer` | Per-indexer history |

### Upstream CRUD/test surfaces that exist in Prowlarr

| Resource | Methods/paths in official spec |
| --------- | --------------------------------- |
| `applications` | `GET /api/v1/applications`, `POST /api/v1/applications`, `GET/PUT/DELETE /api/v1/applications/{id}`, `PUT/DELETE /api/v1/applications/bulk`, `GET /api/v1/applications/schema`, `POST /api/v1/applications/test`, `POST /api/v1/applications/testall`, `POST /api/v1/applications/action/{name}` |
| `downloadclient` | `GET /api/v1/downloadclient`, `POST /api/v1/downloadclient`, `GET/PUT/DELETE /api/v1/downloadclient/{id}`, `PUT/DELETE /api/v1/downloadclient/bulk`, `GET /api/v1/downloadclient/schema`, `POST /api/v1/downloadclient/test`, `POST /api/v1/downloadclient/testall`, `POST /api/v1/downloadclient/action/{name}` |
| `indexer` | `GET /api/v1/indexer`, `POST /api/v1/indexer`, `GET/PUT/DELETE /api/v1/indexer/{id}`, `PUT/DELETE /api/v1/indexer/bulk`, `GET /api/v1/indexer/schema`, `POST /api/v1/indexer/test`, `POST /api/v1/indexer/testall`, `POST /api/v1/indexer/action/{name}` |
| `indexerproxy` | `GET /api/v1/indexerproxy`, `POST /api/v1/indexerproxy`, `GET/PUT/DELETE /api/v1/indexerproxy/{id}`, `GET /api/v1/indexerproxy/schema`, `POST /api/v1/indexerproxy/test`, `POST /api/v1/indexerproxy/testall`, `POST /api/v1/indexerproxy/action/{name}` |
| `notification` | `GET /api/v1/notification`, `POST /api/v1/notification`, `GET/PUT/DELETE /api/v1/notification/{id}`, `GET /api/v1/notification/schema`, `POST /api/v1/notification/test`, `POST /api/v1/notification/testall`, `POST /api/v1/notification/action/{name}` |

### Commands and general config

| Method | Path | Notes |
| ------- | ------ | ------- |
| `GET` | `/api/v1/command` | Lists commands |
| `POST` | `/api/v1/command` | Starts a command |
| `GET` | `/api/v1/command/{id}` | Reads command status |
| `DELETE` | `/api/v1/command/{id}` | Cancels/deletes a command |
| `GET` | `/api/v1/config/host` | General host/auth/proxy/cert config; includes sensitive fields |
| `PUT` | `/api/v1/config/host/{id}` | Updates host config |
| `GET` | `/api/v1/config/downloadclient` | Reads download-client config resource |
| `GET` | `/api/v1/config/development` | Reads development config |
| `GET` | `/api/v1/config/ui` | Reads UI config |

## Fields Worth Knowing From Official Schemas

### `SystemResource`

Useful for a connection/status card:

- `appName`
- `instanceName`
- `version`
- `authentication`
- `urlBase`
- `databaseType`
- `runtimeVersion`
- `runtimeName`
- `osName`
- `isLinux`, `isDocker`, `isProduction`

### `HealthResource`

Useful for issue summaries:

- `source`
- `type` (`ok`, `notice`, `warning`, `error` via `HealthCheckResult`)
- `message`
- `wikiUrl`

### `HostConfigResource`

Important caution: this schema includes general settings **and sensitive values** such as:

- `authenticationMethod`
- `authenticationRequired`
- `apiKey`
- `urlBase`
- proxy host/user/password settings
- certificate-validation settings

Arrtemplar should avoid using this endpoint as a routine validation call unless a feature explicitly needs it.

## Arrtemplar Local Extension Points

These are the main local files a future implementation would extend or generalize:

- `packages/shared/src/api/download-clients.ts`
  - Current kinds are only `qbittorrent` and `sabnzbd`.
  - Shared status/probe DTOs already fit a Prowlarr status model.
- `apps/server/src/db/schema.ts`
  - `download_clients` table already supports encrypted secrets, per-kind defaults, and probe metadata.
- `apps/server/src/download-clients/download-client.service.ts`
  - Current place where per-kind probe functions are dispatched.
- `apps/server/src/download-clients/routes.ts`
  - Current HTTP surface for list/create/update/delete/test/status.
- `apps/server/src/download-clients/outbound-request-policy.ts`
  - Current SSRF/timeouts/redirect/response-cap policy to reuse.
- `apps/web/src/features/services-settings/ServicesSettings.tsx`
  - Current UI cards are hardcoded for qBittorrent and SABnzbd.
- `apps/web/src/features/services-settings/services-settings.ts`
  - Current query/mutation hooks for the services screen.
- `apps/web/src/lib/api.ts`
  - Current browser API bindings for services.

## Security Notes For Future Implementation

- Prefer `X-Api-Key` header auth over `apikey` query-param auth when Arrtemplar calls Prowlarr.
- Never log or persist plain API key values outside Arrtemplar’s existing encrypted-secret flow.
- Reuse Arrtemplar’s current outbound policy:
  - `redirect: "manual"`
  - bounded timeout
  - response-size cap
  - host validation
  - deny metadata/link-local targets
- Keep support for LAN/private hosts because that is the current, intentional product model for service integrations.
- Treat `GET /api/v1/config/host` as sensitive because it includes `apiKey` and proxy/cert fields.

## Recommended Minimal v1 Upstream Calls

If goal is only “save instance + test connection + show status,” official-source minimum is:

1. `GET /ping` — optional anonymous reachability.
2. `GET /api/v1/system/status` — required authenticated validation and version display.
3. `GET /api/v1/health` — optional health summary.

Everything else in the upstream API can be deferred until Arrtemplar needs to surface Prowlarr-managed resources.

## Sources

- `https://prowlarr.com/docs/api/`
- `https://raw.githubusercontent.com/Prowlarr/Prowlarr/develop/src/Prowlarr.Api.V1/openapi.json`
- `https://github.com/Prowlarr/Prowlarr`
- `src/Prowlarr.Http/Ping/PingController.cs` in `Prowlarr/Prowlarr`
- `src/Prowlarr.Http/Authentication/AuthenticationController.cs` in `Prowlarr/Prowlarr`
- `src/Prowlarr.Http/ApiInfoController.cs` in `Prowlarr/Prowlarr`
- `src/Prowlarr.Api.V1/System/SystemController.cs` in `Prowlarr/Prowlarr`
- `packages/shared/src/api/download-clients.ts`
- `apps/server/src/db/schema.ts`
- `apps/server/src/download-clients/download-client.service.ts`
- `apps/server/src/download-clients/routes.ts`
- `apps/server/src/download-clients/outbound-request-policy.ts`
- `apps/web/src/features/services-settings/ServicesSettings.tsx`
- `apps/web/src/features/services-settings/services-settings.ts`
- `apps/web/src/lib/api.ts`
