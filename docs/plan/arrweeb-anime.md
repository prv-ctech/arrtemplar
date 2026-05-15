# AnimeHub AI Build Plan

## Purpose

Build a self-hosted anime-focused media app that combines:

- **Plex-style watching**
- **Overseerr-style requesting**
- **Sonarr-style library/download automation**
- **Anime-native search, parsing, release-group handling, and import logic**

The app should be built as a modular system where Bun powers the backend/control plane, React powers the frontend, Jikan provides initial anime metadata, and specialized anime search connectors provide better release matching than generic Sonarr/Prowlarr-style parsing.

This plan is written as a prompt/specification for an AI coding assistant to follow while building the app backbone.

---

# 1. High-Level Product Vision

Create an anime-native media hub where:

## Admins can

- Manage users.
- Add and edit anime library entries.
- Import metadata from Jikan.
- Approve, deny, and prioritize requests.
- Configure search providers, download clients, quality profiles, release groups, and import rules.
- Search for releases using anime-native parsing and scoring.
- Send approved releases to download clients.
- Scan completed downloads.
- Manually match files when automatic matching is uncertain.
- Watch available anime.
- View logs, failed jobs, and audit history.

## Users can

- Log in.
- Search anime metadata.
- Request anime.
- View request status.
- Watch approved/available anime.
- Track watch progress.
- Manage their own watchlist/favorites later.

## The app should specialize in anime by understanding

- Release groups.
- Alternative titles.
- Romaji, English, native Japanese, and synonym titles.
- Absolute episode numbering.
- Season-based numbering.
- Episode ranges and batches.
- OVAs, ONAs, movies, specials, and recap episodes.
- Sub/dub/dual-audio releases.
- Subtitle language indicators.
- Video codecs, bit depth, source, and resolution.
- Trusted/preferred/blocked groups.
- Provider-specific quirks, especially Nyaa-style torrent release names.

---

# 2. Non-Negotiable Boundaries

The app must be designed for lawful self-hosted media management only.

The AI building this project must follow these rules:

- Do not build features intended to bypass paywalls, DRM, authentication, region locks, captchas, or access controls.
- Do not hardcode illegal sources or copyrighted content assumptions.
- Treat all external search/download integrations as admin-configured providers.
- Respect provider terms, rate limits, and robots/crawling limitations where applicable.
- Store credentials securely.
- Do not expose secrets in logs, frontend bundles, stack traces, or API responses.
- Validate file paths to prevent path traversal.
- Never allow a normal user to access arbitrary files from the host machine.
- Keep provider modules modular so any provider can be disabled.

---

# 3. Recommended Tech Stack

## Backend

- Runtime: **Bun 1.3.14+**
- Language: **TypeScript**
- API framework: **Hono**, **Elysia**, or direct `Bun.serve`
- Database, MVP: **SQLite**
- Database, later: **Postgres**
- Query layer: **Drizzle**, **Kysely**, or direct Bun SQL APIs
- Auth: server-side sessions with secure cookies
- Jobs: persistent DB-backed job table first; Redis-backed queue later if needed
- Realtime updates: WebSockets or Server-Sent Events
- External tools: `ffmpeg`, `ffprobe`, `mediainfo`, `7z`/`unrar` as optional subprocesses

## Frontend

- **React**
- **Vite**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **TanStack Query** for API state
- **TanStack Router** or **React Router** for routing
- **Zustand** or **Jotai** for small client-side state
- Native HTML5 video player first
- Video.js or HLS.js later when advanced playback is needed

## Metadata

- Primary metadata provider for MVP: **Jikan**
- Jikan base site: `https://jikan.moe/`
- Store provider IDs, especially MAL IDs.
- Cache metadata responses.
- Allow manual metadata corrections.
- Add AniList/TMDB/AniDB later as optional providers.

## Search Providers

Primary goal: build anime-native search providers before relying on generic fallback tools.

- Native anime search connector first.
- Native Nyaa-style provider as the main target connector.
- Fallback providers later:
  - Prowlarr
  - Jackett
  - Generic Torznab/Newznab

## Download Clients

Start with one client:

- qBittorrent

Add later:

- Transmission
- SABnzbd
- NZBGet

---

# 4. Core Design Principles

The AI should follow these principles throughout implementation.

## 4.1 Build modularly

Every major external dependency should be behind an interface:

- Metadata providers
- Search providers
- Download clients
- Importers
- Media scanners
- Notification providers
- Playback/transcoding providers

Do not bake provider-specific logic into controllers or UI components.

## 4.2 Manual override must exist early

Anime matching is messy. Automatic matching will fail.

Build admin tools early for:

- Adding aliases.
- Correcting episode matches.
- Marking a release as wrong.
- Forcing a release to match an anime/episode.
- Marking a batch as a specific episode range.
- Blocking a release group.
- Preferring a release group.

## 4.3 Search should use scoring, not just regex

Regex is only one layer. The app must parse releases into structured data and then score candidates.

A release should be accepted, rejected, or sent to manual review based on score and reasons.

## 4.4 Admins need transparency

When the app chooses or rejects a release, the UI should show why.

For each candidate, show:

- Parsed title.
- Matched anime.
- Episode match.
- Release group.
- Resolution.
- Codec.
- Audio/subtitle flags.
- Seeders.
- Size.
- Trusted status.
- Score.
- Acceptance/rejection reasons.

## 4.5 Jobs must be durable

Download/import/search tasks should survive restarts.

Use a persistent jobs table with:

- Status
- Attempts
- Retry time
- Error message
- Payload
- Result
- Timestamps

## 4.6 Import operations must be idempotent

Running an import twice should not corrupt the library.

Track imported files by:

- Path
- Size
- Checksum/hash if available
- Matched episode
- Import timestamp
- Previous import history

## 4.7 Security is part of the backbone

Do not build the app first and add security later.

Implement from the beginning:

- Password hashing.
- Secure sessions.
- Route permissions.
- CSRF protection for cookie-authenticated writes.
- Rate limits for login and sensitive endpoints.
- Audit logs for admin actions.
- Secret redaction.
- Path safety.

---

# 5. Suggested Monorepo Structure

```txt
animehub/
  apps/
    server/
      src/
        main.ts
        config/
        http/
        modules/
        db/
        jobs/
        utils/
      package.json
      bunfig.toml

    web/
      src/
        routes/
        components/
        lib/
        hooks/
        stores/
        styles/
      package.json
      vite.config.ts
      tailwind.config.ts

  packages/
    shared/
      src/
        types/
        constants/
        schemas/

    anime-parser/
      src/
        parser.ts
        normalizer.ts
        scorer.ts
        fixtures/
        tests/

    db-schema/
      src/
        schema.ts
        migrations/

  scripts/
  docker/
  docs/
  README.md
  package.json
```

---

# 6. Backend Module Layout

```txt
apps/server/src/modules/
  auth/
    auth.routes.ts
    auth.service.ts
    password.ts
    sessions.ts
    permissions.ts

  users/
    users.routes.ts
    users.service.ts

  metadata/
    metadata.routes.ts
    metadata.service.ts
    providers/
      metadata-provider.ts
      jikan.provider.ts

  anime/
    anime.routes.ts
    anime.service.ts
    aliases.service.ts
    episodes.service.ts

  requests/
    requests.routes.ts
    requests.service.ts
    approval.service.ts

  search/
    search.routes.ts
    search.service.ts
    providers/
      search-provider.ts
      nyaa.provider.ts
      prowlarr.provider.ts
      jackett.provider.ts
    parser/
      anime-release-parser.ts
      title-normalizer.ts
    scoring/
      release-scorer.ts
      scoring-rules.ts

  downloads/
    downloads.routes.ts
    downloads.service.ts
    clients/
      download-client.ts
      qbittorrent.client.ts
      transmission.client.ts
      sabnzbd.client.ts

  library/
    library.routes.ts
    scanner.ts
    importer.ts
    matcher.ts
    file-probe.ts
    path-safety.ts

  player/
    player.routes.ts
    stream.controller.ts
    progress.service.ts

  integrations/
    integrations.routes.ts
    integrations.service.ts
    secrets.service.ts

  jobs/
    job-runner.ts
    job-queue.ts
    job-types.ts

  settings/
    settings.routes.ts
    settings.service.ts

  audit/
    audit.service.ts
```

---

# 7. Frontend Route Layout

```txt
apps/web/src/routes/
  login.tsx
  dashboard.tsx
  requests.tsx
  watch.tsx
  watch.$animeId.tsx
  watch.$animeId.$episodeId.tsx

  admin.tsx
  admin.library.tsx
  admin.library.$animeId.tsx
  admin.requests.tsx
  admin.search.tsx
  admin.downloads.tsx
  admin.imports.tsx
  admin.integrations.tsx
  admin.users.tsx
  admin.settings.tsx
```

---

# 8. Important Frontend Components

```txt
components/
  ui/
    shadcn components

  layout/
    AppShell.tsx
    Sidebar.tsx
    Topbar.tsx
    AdminNav.tsx

  auth/
    LoginForm.tsx
    RequireAuth.tsx
    RequireRole.tsx

  anime/
    AnimeCard.tsx
    AnimeSearch.tsx
    AnimeDetails.tsx
    AnimeAliasEditor.tsx
    EpisodeGrid.tsx
    EpisodeRow.tsx

  requests/
    RequestButton.tsx
    RequestStatusBadge.tsx
    UserRequestsTable.tsx
    AdminRequestApprovalTable.tsx

  search/
    ReleaseSearchForm.tsx
    ReleaseCandidateTable.tsx
    CandidateScoreBadge.tsx
    RejectionReasons.tsx
    ManualMatchDialog.tsx

  downloads/
    DownloadMonitor.tsx
    DownloadStatusBadge.tsx

  imports/
    ImportQueueTable.tsx
    ManualImportDialog.tsx
    FileMatchCard.tsx

  player/
    VideoPlayer.tsx
    ContinueWatchingRow.tsx
    WatchProgressBar.tsx

  settings/
    QualityProfileEditor.tsx
    ReleaseGroupManager.tsx
    IntegrationStatusCard.tsx
```

---

# 9. Core Data Model

Use SQLite first. Keep the schema compatible with future Postgres migration.

## 9.1 Users and auth

```txt
users
- id
- username
- email
- password_hash
- role
- disabled_at
- created_at
- updated_at
- last_login_at

sessions
- id
- user_id
- token_hash
- expires_at
- ip_address
- user_agent
- created_at

api_tokens
- id
- user_id
- name
- token_hash
- scopes_json
- last_used_at
- expires_at
- created_at

audit_logs
- id
- actor_user_id
- action
- target_type
- target_id
- metadata_json
- ip_address
- created_at
```

## 9.2 Anime metadata

```txt
anime_titles
- id
- canonical_title
- english_title
- native_title
- romaji_title
- type
- status
- year
- season
- synopsis
- poster_url
- banner_url
- source_provider
- source_id
- created_at
- updated_at

anime_external_ids
- id
- anime_id
- provider
- external_id
- confidence
- created_at

anime_aliases
- id
- anime_id
- alias
- normalized_alias
- source
- confidence
- created_by_user_id
- created_at

episodes
- id
- anime_id
- season_number
- episode_number
- absolute_number
- title
- synopsis
- air_date
- runtime_minutes
- created_at
- updated_at
```

## 9.3 Library and playback

```txt
media_files
- id
- anime_id
- episode_id
- path
- relative_path
- file_name
- size_bytes
- checksum
- duration_seconds
- container
- video_codec
- audio_codec
- resolution
- bit_depth
- subtitle_languages_json
- audio_languages_json
- imported_at
- created_at

watch_progress
- id
- user_id
- anime_id
- episode_id
- media_file_id
- position_seconds
- duration_seconds
- completed
- updated_at
```

## 9.4 Requests

```txt
requests
- id
- user_id
- anime_id
- request_type
- status
- note
- approved_by_user_id
- denied_by_user_id
- created_at
- approved_at
- denied_at
- updated_at
```

Request statuses:

```txt
pending
approved
denied
searching
downloading
partially_available
available
failed
cancelled
```

## 9.5 Search and release intelligence

```txt
release_groups
- id
- name
- normalized_name
- aliases_json
- preferred
- blocked
- notes
- created_at
- updated_at

quality_profiles
- id
- name
- min_resolution
- max_resolution
- preferred_resolutions_json
- preferred_codecs_json
- preferred_sources_json
- allow_dub
- allow_dual_audio
- allow_batch
- min_seeders
- max_size_bytes
- preferred_groups_json
- blocked_groups_json
- created_at
- updated_at

search_providers
- id
- type
- name
- base_url
- enabled
- priority
- config_json
- created_at
- updated_at

search_results
- id
- provider_id
- anime_id
- episode_id
- raw_title
- normalized_title
- raw_payload_json
- parsed_payload_json
- score
- decision
- rejection_reasons_json
- searched_at

release_decisions
- id
- anime_id
- episode_id
- search_result_id
- decision
- reason
- decided_by_user_id
- created_at
```

## 9.6 Downloads, integrations, jobs

```txt
download_clients
- id
- type
- name
- base_url
- enabled
- encrypted_credentials_json
- config_json
- created_at
- updated_at

downloads
- id
- request_id
- anime_id
- episode_id
- search_result_id
- client_id
- external_download_id
- status
- progress
- save_path
- error_message
- created_at
- updated_at

integration_credentials
- id
- type
- name
- encrypted_secret
- metadata_json
- created_at
- updated_at

jobs
- id
- type
- status
- payload_json
- result_json
- error_message
- attempts
- max_attempts
- run_after
- locked_at
- locked_by
- created_at
- updated_at
```

---

# 10. Shared TypeScript Interfaces

Create shared types early in `packages/shared`.

## 10.1 Metadata provider

```ts
export type MetadataProviderName = "jikan" | "anilist" | "tmdb" | "manual";

export type AnimeMetadataSearchResult = {
  provider: MetadataProviderName;
  providerId: string;
  canonicalTitle: string;
  englishTitle?: string;
  nativeTitle?: string;
  romajiTitle?: string;
  synonyms: string[];
  type?: "tv" | "movie" | "ova" | "ona" | "special" | "unknown";
  year?: number;
  posterUrl?: string;
  synopsis?: string;
};

export interface MetadataProvider {
  name: MetadataProviderName;
  searchAnime(query: string): Promise<AnimeMetadataSearchResult[]>;
  getAnimeById(providerId: string): Promise<AnimeMetadataSearchResult>;
}
```

## 10.2 Search provider

```ts
export type SearchProviderName = "nyaa" | "prowlarr" | "jackett" | "torznab";

export type SearchQuery = {
  animeId: string;
  canonicalTitle: string;
  aliases: string[];
  episodeNumber?: number;
  absoluteNumber?: number;
  seasonNumber?: number;
  qualityProfileId?: string;
  preferredGroups?: string[];
  blockedGroups?: string[];
};

export type SearchProviderResult = {
  provider: SearchProviderName;
  rawTitle: string;
  url: string;
  magnetUrl?: string;
  torrentUrl?: string;
  sizeBytes?: number;
  seeders?: number;
  leechers?: number;
  completed?: number;
  uploadedAt?: string;
  category?: string;
  trusted?: boolean;
  remake?: boolean;
  uploader?: string;
  rawPayload: unknown;
};

export interface SearchProvider {
  name: SearchProviderName;
  search(query: SearchQuery): Promise<SearchProviderResult[]>;
}
```

## 10.3 Parsed anime release

```ts
export type ParsedAnimeRelease = {
  releaseGroup?: string;
  animeTitle: string;
  normalizedAnimeTitle: string;
  seasonNumber?: number;
  episodeNumber?: number;
  absoluteEpisode?: number;
  episodeRange?: {
    start: number;
    end: number;
  };
  isBatch: boolean;
  resolution?: "480p" | "720p" | "1080p" | "2160p" | "unknown";
  source?: string;
  videoCodec?: string;
  audioCodec?: string;
  bitDepth?: "8bit" | "10bit" | "unknown";
  subtitles?: string[];
  audioLanguages?: string[];
  isDub?: boolean;
  isDualAudio?: boolean;
  hash?: string;
  extraTags: string[];
};
```

## 10.4 Candidate release

```ts
export type ReleaseCandidate = {
  provider: SearchProviderName;
  rawTitle: string;
  url: string;
  magnetUrl?: string;
  torrentUrl?: string;
  sizeBytes?: number;
  seeders?: number;
  leechers?: number;
  completed?: number;
  uploadedAt?: string;
  category?: string;
  trusted?: boolean;
  remake?: boolean;
  uploader?: string;
  parsed: ParsedAnimeRelease;
  score: number;
  decision: "accept" | "reject" | "manual_review";
  acceptanceReasons: string[];
  rejectionReasons: string[];
};
```

## 10.5 Download client

```ts
export type DownloadClientType = "qbittorrent" | "transmission" | "sabnzbd" | "nzbget";

export type AddDownloadInput = {
  url: string;
  category?: string;
  savePath?: string;
  paused?: boolean;
  tags?: string[];
};

export type DownloadStatus = {
  externalId: string;
  name: string;
  status: "queued" | "downloading" | "completed" | "failed" | "paused" | "unknown";
  progress: number;
  savePath?: string;
  errorMessage?: string;
};

export interface DownloadClient {
  type: DownloadClientType;
  testConnection(): Promise<boolean>;
  addDownload(input: AddDownloadInput): Promise<{ externalId: string }>;
  getStatus(externalId: string): Promise<DownloadStatus>;
  removeDownload(externalId: string, deleteFiles: boolean): Promise<void>;
}
```

---

# 11. Phase-Based Implementation Plan

Build from simplest to hardest. Do not start with complex automation. Build a working vertical slice first.

---

## Phase 0: Repository and Tooling Backbone

### Goal

Create the project structure and development environment.

### Tasks

- Initialize monorepo.
- Add Bun workspace config.
- Add `apps/server`.
- Add `apps/web` with Vite React TypeScript.
- Add Tailwind CSS.
- Add shadcn/ui setup.
- Add shared package for types.
- Add parser package skeleton.
- Add linting and formatting.
- Add environment variable loading.
- Add basic README.

### Expected output

- Server starts with Bun.
- Web app starts with Vite hot reload.
- Shared types can be imported by both server and web.

### Acceptance criteria

- `bun install` works.
- `bun run dev` starts backend and frontend.
- Frontend can call a `/health` endpoint.
- `/health` returns app name, version, and status.

---

## Phase 1: Database Foundation

### Goal

Create the database layer and first migrations.

### Tasks

- Add SQLite database connection.
- Add migrations.
- Create tables:
  - users
  - sessions
  - audit_logs
  - anime_titles
  - anime_aliases
  - anime_external_ids
  - episodes
  - metadata_cache
- Add seed script.
- Create first admin user from environment variables.

### Expected output

- App can create/update database schema.
- Admin user exists after seed.

### Acceptance criteria

- Fresh database can be migrated with one command.
- Admin user can be seeded safely.
- Migrations are repeatable.
- Schema is typed in TypeScript.

---

## Phase 2: Auth, Sessions, Roles, and Permissions

### Goal

Implement secure login and role-based access.

### Tasks

- Add password hashing.
- Add login route.
- Add logout route.
- Add session creation.
- Store hashed session token in database.
- Use secure HttpOnly cookies.
- Add `GET /api/auth/me`.
- Add role system:
  - admin
  - user
- Add permission middleware.
- Add login rate limiting.
- Add audit log entries for login/logout/admin actions.

### Expected output

- Admin can log in.
- User role can be checked on protected routes.
- Frontend can know whether the user is logged in.

### Acceptance criteria

- Unauthenticated users cannot access protected APIs.
- Normal users cannot access admin APIs.
- Session cookies are HttpOnly.
- Failed login attempts are rate-limited.
- Password hashes are never returned by API.

---

## Phase 3: Frontend Shell

### Goal

Create the base UI structure.

### Tasks

- Create login page.
- Create app layout.
- Create admin layout.
- Add sidebar/topbar.
- Add protected route wrapper.
- Add role-protected route wrapper.
- Add dashboard placeholder.
- Add shadcn components:
  - Button
  - Card
  - Dialog
  - Table
  - Input
  - Badge
  - Dropdown
  - Tabs
  - Toast/Sonner

### Expected output

- User can log in from frontend.
- Admin sees admin navigation.
- Normal user sees user navigation.

### Acceptance criteria

- Vite hot reload works.
- Auth state persists after refresh.
- Login failure shows an error.
- Logout works.

---

## Phase 4: Jikan Metadata Provider

### Goal

Allow admins to search anime metadata and import anime records.

### Tasks

- Implement `MetadataProvider` interface.
- Implement `JikanProvider`.
- Add metadata caching table.
- Add API routes:
  - `GET /api/metadata/search?query=`
  - `GET /api/metadata/jikan/:id`
  - `POST /api/admin/anime/import`
- Normalize Jikan titles into:
  - canonical title
  - English title
  - native title
  - synonyms
  - aliases
- Store MAL ID in `anime_external_ids`.
- Cache metadata responses.
- Add rate-limit/backoff handling.

### Expected output

- Admin can search for anime.
- Admin can import an anime into the local library.
- Aliases are created automatically from Jikan titles/synonyms.

### Acceptance criteria

- Search results display title, image, year/type when available.
- Import creates an anime record.
- Import creates aliases.
- Duplicate MAL imports are prevented.
- API handles Jikan errors gracefully.

---

## Phase 5: Manual Anime Library Management

### Goal

Let admins manage anime entries before automation exists.

### Tasks

- Add anime list API.
- Add anime detail API.
- Add edit anime API.
- Add alias management API.
- Add episode management API.
- Add admin UI pages:
  - Library list
  - Anime detail
  - Alias editor
  - Episode editor

### Expected output

- Admin can manually edit imported anime.
- Admin can add aliases.
- Admin can add/edit episodes.

### Acceptance criteria

- Admin can add a custom alias.
- Admin can delete a wrong alias.
- Admin can create an episode.
- Admin can edit episode numbers and absolute numbers.
- Normal users cannot modify metadata.

---

## Phase 6: Basic Playback and Watch Progress

### Goal

Add the simplest possible watch experience.

### Tasks

- Add `media_files` table.
- Add admin route to manually register a media file path.
- Add path safety validation.
- Add streaming endpoint with HTTP Range support.
- Add watch progress table.
- Add API endpoints:
  - `GET /api/watch/anime`
  - `GET /api/watch/anime/:animeId`
  - `GET /api/watch/episodes/:episodeId/stream`
  - `POST /api/watch/progress`
- Add frontend pages:
  - Watch library
  - Anime watch detail
  - Episode player
  - Continue watching row

### Expected output

- Admin can attach a local file to an episode.
- User can play that file in browser if the browser supports it.
- App saves playback progress.

### Acceptance criteria

- Video seeking works via Range requests.
- Users can only stream files registered in the database.
- Users cannot request arbitrary file paths.
- Progress saves periodically.
- Continue watching appears after playback.

---

## Phase 7: User Request System

### Goal

Allow users to request anime and admins to approve/deny.

### Tasks

- Add requests table if not already created.
- Add API routes:
  - `POST /api/requests`
  - `GET /api/requests/mine`
  - `GET /api/admin/requests`
  - `POST /api/admin/requests/:id/approve`
  - `POST /api/admin/requests/:id/deny`
- Add user UI:
  - Search anime
  - Request button
  - My requests page
- Add admin UI:
  - Request approval table
  - Approve/deny dialogs
  - Request status badges

### Expected output

- User can request anime.
- Admin can approve or deny.
- Request status updates.

### Acceptance criteria

- Duplicate active requests are prevented.
- Users cannot approve their own requests unless admin.
- Denial requires optional reason.
- Approval writes audit log.

---

## Phase 8: Anime Release Parser Package

### Goal

Build the specialized parser that makes this app better than generic tools.

### Tasks

Create `packages/anime-parser`.

Parser should detect:

- Release group.
- Anime title.
- Season number.
- Episode number.
- Absolute episode number.
- Episode ranges.
- Batch releases.
- Resolution.
- Source.
- Codec.
- Bit depth.
- Audio language.
- Subtitle language.
- Dub/sub/dual-audio indicators.
- Hash.
- Extra tags.

### Example titles to support

```txt
[SubsPlease] Sousou no Frieren - 12 (1080p) [A1B2C3D4].mkv
[Erai-raws] Sousou no Frieren - 12 [1080p][Multiple Subtitle][HEVC][AAC].mkv
[EMBER] Kimetsu no Yaiba S04E03 [1080p][HEVC x265 10bit][Multi-Subs].mkv
[ASW] Bleach - Sennen Kessen-hen - 25 [1080p HEVC][English Dub].mkv
[Group] Anime Title - 01-12 Batch [BD 1080p x265 10bit AAC].mkv
One Piece - 1123 [1080p].mkv
Anime Title S02E05 1080p WEB-DL AAC2.0 H.264.mkv
```

### Expected output

A parser that turns raw titles into `ParsedAnimeRelease`.

### Acceptance criteria

- Parser has unit tests.
- Parser handles common anime naming patterns.
- Parser does not crash on unknown titles.
- Parser returns low-confidence/unknown fields rather than fake certainty.
- Parser can be used by backend and tested independently.

---

## Phase 9: Search Provider Abstraction

### Goal

Create the search architecture before implementing full provider logic.

### Tasks

- Add `SearchProvider` interface.
- Add `SearchService`.
- Add provider registry.
- Add search provider database config.
- Add API route:
  - `POST /api/admin/search/releases`
- Add mock search provider for tests.
- Add frontend release search page.

### Expected output

- Admin can run a release search through the abstraction.
- Mock results appear in UI.
- Results are parsed by anime parser.

### Acceptance criteria

- Search service can call multiple providers.
- Provider errors do not crash the entire search.
- Results are deduped by URL/magnet/hash/title where possible.
- Search results are stored for later inspection.

---

## Phase 10: Native Nyaa-Style Anime Search Provider

### Goal

Implement the first native anime-focused provider.

### Tasks

- Add `NyaaProvider` behind the `SearchProvider` interface.
- Make base URL configurable.
- Make provider enable/disable configurable.
- Generate multiple anime search queries from:
  - canonical title
  - English title
  - native title
  - aliases
  - preferred release groups
  - episode number
  - absolute number
  - resolution
- Parse provider results into `SearchProviderResult`.
- Capture provider-specific fields where available:
  - category
  - trusted/remake-like flags
  - uploader
  - seeders
  - leechers
  - completed count
  - size
  - upload date
- Add conservative rate limiting.
- Add provider health/test endpoint.

### Important restrictions

- Do not bypass captchas, authentication, rate limits, or access controls.
- Do not hardcode illegal content workflows.
- Provider must be admin-configured and disableable.

### Expected output

- Admin can search configured provider from the UI.
- Raw provider results are normalized.
- Anime parser processes each result.

### Acceptance criteria

- Provider can be disabled without breaking search service.
- Failed provider request shows clear error.
- Provider results are stored with raw payload for debugging.
- No credentials or secrets are logged.

---

## Phase 11: Candidate Scoring Engine

### Goal

Rank release candidates using anime-specific logic.

### Tasks

Create scoring rules for:

Positive signals:

- Exact alias/title match.
- Correct episode number.
- Correct absolute number.
- Preferred release group.
- Requested resolution.
- Desired codec.
- Desired source.
- Trusted uploader/status when available.
- Enough seeders.
- Reasonable file size.
- Recent upload.

Negative signals:

- Wrong title.
- Wrong episode.
- Wrong season.
- Blocked release group.
- Too few seeders.
- Suspiciously small/large file.
- Dub when sub-only is requested.
- Dual-audio when not allowed.
- Batch when batch is not allowed.
- Remake/reupload when excluded.
- Unknown group when profile requires known groups.

### Decisions

Convert score into:

```txt
accept
manual_review
reject
```

### Expected output

- Every search result gets a score.
- Every result has acceptance/rejection reasons.
- Admin UI shows exactly why each result ranked where it did.

### Acceptance criteria

- Scoring engine has unit tests.
- Score output is deterministic.
- Reasons are human-readable.
- Admin can manually override score decision.

---

## Phase 12: Quality Profiles and Release Groups

### Goal

Allow admins to define what “good release” means.

### Tasks

- Add quality profile CRUD.
- Add release group CRUD.
- Add preferred groups.
- Add blocked groups.
- Add default profile.
- Add UI:
  - Quality profile editor
  - Release group manager
- Link requests/anime to a quality profile.

### Expected output

- Admin can prefer groups like SubsPlease/Erai/EMBER-style names.
- Admin can block unwanted groups.
- Search scoring uses these settings.

### Acceptance criteria

- Changing profile changes scoring result.
- Blocked group candidates are rejected.
- Preferred group candidates receive score boost.
- Profiles are reusable across anime.

---

## Phase 13: qBittorrent Download Client Integration

### Goal

Send selected releases to a download client.

### Tasks

- Add `DownloadClient` interface.
- Implement qBittorrent client.
- Store encrypted client credentials.
- Add integration settings UI.
- Add test connection endpoint.
- Add endpoint to send release to client:
  - `POST /api/admin/downloads/add`
- Add downloads table records.
- Poll download status.

### Expected output

- Admin can configure qBittorrent.
- Admin can test connection.
- Admin can send a selected release.
- Download status appears in UI.

### Acceptance criteria

- Bad credentials show clear error.
- Download add operation writes audit log.
- Download status sync survives restart.
- Secrets are not exposed to frontend.

---

## Phase 14: Persistent Jobs System

### Goal

Move long-running and scheduled work out of request handlers.

### Tasks

- Implement jobs table processing.
- Add job runner.
- Add locking to avoid duplicate workers.
- Add retry logic.
- Add job types:
  - metadata.refresh
  - search.release
  - download.status.sync
  - library.scan
  - import.completed
- Add admin jobs page.

### Expected output

- Background jobs run reliably.
- Failed jobs can be inspected.
- Admin can retry failed jobs.

### Acceptance criteria

- Jobs survive server restart.
- Failed jobs store error messages.
- Job retries are limited.
- Long tasks do not block HTTP responses.

---

## Phase 15: Completed Download Scanner

### Goal

Detect completed downloads and prepare them for import.

### Tasks

- Add library/download path settings.
- Add safe directory scanning.
- Detect video files.
- Ignore partial/incomplete files.
- Use parser on filenames.
- Create import candidates.
- Add import queue UI.

### Expected output

- Completed files appear as import candidates.
- Admin can inspect parsed file info.

### Acceptance criteria

- Scanner cannot scan outside configured directories.
- Scanner ignores unsupported files.
- Scanner handles nested folders.
- Scanner does not duplicate existing imported files.

---

## Phase 16: Import Matcher and Manual Import UI

### Goal

Connect completed files to anime episodes.

### Tasks

- Match files using:
  - request/download context
  - parsed release title
  - anime aliases
  - episode number
  - absolute episode number
  - batch range
- Score import match confidence.
- Auto-import high-confidence matches.
- Send uncertain matches to manual review.
- Add manual match dialog.
- Move/copy/hardlink file into library path.
- Register `media_files` record.

### Expected output

- Completed downloads can become watchable episodes.
- Admin can fix uncertain matches.

### Acceptance criteria

- Auto-import only happens above confidence threshold.
- Manual review is required for uncertain matches.
- File operation is path-safe.
- Import is idempotent.
- Imported episode appears in watch UI.

---

## Phase 17: End-to-End Approved Request Flow

### Goal

Connect request approval to search, download, import, and watch.

### Desired flow

```txt
User searches anime
→ User requests anime
→ Admin approves request
→ App searches native provider
→ App scores release candidates
→ Admin chooses or auto-picks best release
→ App sends release to qBittorrent
→ App monitors download
→ Scanner detects completed file
→ Importer matches file to episode
→ Episode becomes watchable
→ User sees request as available
```

### Tasks

- Trigger search job on approval.
- Store candidate releases.
- Allow admin to choose candidate.
- Send selected candidate to download.
- Sync download status.
- Trigger scan/import when download completes.
- Update request status throughout.
- Notify user in UI.

### Expected output

A full MVP vertical slice.

### Acceptance criteria

- One anime can be requested, approved, downloaded, imported, and watched.
- Request status is accurate.
- Admin can see every step.
- Failures are visible and retryable.

---

## Phase 18: Fallback Providers: Prowlarr and Jackett

### Goal

Use generic providers only as fallback or supplemental search.

### Tasks

- Implement Prowlarr provider.
- Implement Jackett provider.
- Add Torznab/Newznab abstraction if useful.
- Normalize results into `SearchProviderResult`.
- Run parser and scoring on fallback results too.
- Add provider priority settings.

### Expected output

- Native provider remains primary.
- Fallback providers fill gaps.

### Acceptance criteria

- Provider priority affects order.
- Native provider can be used alone.
- Fallback provider failures do not break native search.
- All results still pass through anime parser/scorer.

---

## Phase 19: Subtitles, Audio, and Player Improvements

### Goal

Improve anime playback experience.

### Tasks

- Detect external subtitle files.
- Store subtitle tracks.
- Show subtitle selector.
- Store audio language metadata.
- Show dub/sub/dual-audio badges.
- Improve watch progress behavior.
- Add next episode button.
- Add continue watching rows.

### Expected output

- User experience feels closer to a media server.

### Acceptance criteria

- Subtitle metadata appears in episode details.
- Player can show external supported subtitles.
- Progress resumes correctly.
- Completed episodes are marked.

---

## Phase 20: Realtime Updates

### Goal

Make admin and user UIs update live.

### Tasks

- Add WebSocket or SSE server.
- Emit events for:
  - request status changed
  - search completed
  - download progress changed
  - import completed
  - job failed
- Add frontend subscription layer.
- Add toast notifications.

### Expected output

- Admin sees downloads/imports update without refresh.
- User sees request status changes.

### Acceptance criteria

- Realtime connection reconnects after disconnect.
- Events are permission-filtered.
- Users do not receive admin-only events.

---

## Phase 21: Advanced Search Automation

### Goal

Move from manual admin search to smart auto-search.

### Tasks

- Add auto-search setting per anime/request/profile.
- Add search intervals.
- Add missing episode scanner.
- Add failed download replacement search.
- Add release history.
- Add auto-accept thresholds.
- Add “manual review below score X” rule.

### Expected output

- App can automatically find missing episodes.
- Admin can still inspect and override.

### Acceptance criteria

- Auto-search does not spam providers.
- Auto-accept only happens above threshold.
- Rejected candidates are remembered.
- Failed downloads can trigger replacement search.

---

## Phase 22: HLS and Transcoding Controller

### Goal

Support files browsers cannot direct-play.

### Important rule

Bun controls transcoding jobs. Bun does not implement transcoding itself.

### Tasks

- Add ffprobe integration.
- Detect direct-play compatibility.
- Add optional HLS generation using ffmpeg.
- Add temporary transcode directory.
- Add transcode job table/status.
- Add HLS playback support using HLS.js.
- Add cleanup policy.
- Add optional hardware acceleration settings later.

### Expected output

- Unsupported files can be played via generated HLS.

### Acceptance criteria

- Direct-play is preferred when possible.
- Transcoding jobs are cancellable.
- Temporary files are cleaned.
- Users cannot trigger unlimited transcodes.
- Admin can configure transcode limits.

---

## Phase 23: Additional Metadata Providers

### Goal

Improve metadata accuracy beyond Jikan.

### Tasks

- Add provider interface support for multiple sources.
- Add AniList provider.
- Add TMDB provider if desired.
- Add provider priority.
- Add external ID mapping.
- Add metadata conflict UI.
- Add manual correction tools.

### Expected output

- Anime metadata can be enriched and cross-referenced.

### Acceptance criteria

- Existing Jikan imports still work.
- Multiple external IDs can exist per anime.
- Admin can choose canonical metadata.

---

## Phase 24: Plugin System

### Goal

Allow new providers without changing core app logic.

### Tasks

- Formalize provider contracts.
- Add provider registry.
- Add config schema per provider.
- Add enable/disable controls.
- Add plugin health checks.
- Add version compatibility checks.

### Expected output

- Search, metadata, and download providers can be added cleanly.

### Acceptance criteria

- Broken plugin does not crash app.
- Plugin errors are isolated.
- Provider configs are validated.

---

## Phase 25: Production Hardening

### Goal

Make the app safe and maintainable for real self-hosted use.

### Tasks

- Add Dockerfile.
- Add docker-compose example.
- Add reverse proxy notes.
- Add database backup command.
- Add restore command.
- Add structured logging.
- Add log redaction.
- Add metrics endpoint.
- Add health checks.
- Add migration rollback strategy.
- Add dependency vulnerability checks.
- Add integration tests.
- Add e2e tests.

### Expected output

- App can be deployed and maintained.

### Acceptance criteria

- Docker deployment works.
- App starts after restart.
- Database migrations run safely.
- Logs do not leak secrets.
- Critical user/admin flows have tests.

---

# 12. MVP Definition

The first true MVP is not the full app.

The MVP is this vertical slice:

```txt
Admin logs in
→ Imports anime metadata from Jikan
→ Adds aliases/episodes if needed
→ User logs in
→ User requests anime
→ Admin approves request
→ Admin searches native anime provider
→ App parses and scores releases
→ Admin selects candidate
→ App sends candidate to qBittorrent
→ App tracks download
→ App scans completed file
→ Admin confirms/imports file
→ User watches episode
→ Watch progress saves
```

Do not build advanced automation before this works.

---

# 13. API Route Plan

## Auth

```txt
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

## Metadata

```txt
GET    /api/metadata/search?query=
GET    /api/metadata/jikan/:id
POST   /api/admin/anime/import
```

## Anime library

```txt
GET    /api/anime
GET    /api/anime/:id
GET    /api/admin/anime
POST   /api/admin/anime
PATCH  /api/admin/anime/:id
DELETE /api/admin/anime/:id
POST   /api/admin/anime/:id/aliases
DELETE /api/admin/anime/:id/aliases/:aliasId
POST   /api/admin/anime/:id/episodes
PATCH  /api/admin/episodes/:episodeId
DELETE /api/admin/episodes/:episodeId
```

## Requests

```txt
POST   /api/requests
GET    /api/requests/mine
GET    /api/admin/requests
POST   /api/admin/requests/:id/approve
POST   /api/admin/requests/:id/deny
```

## Search

```txt
POST   /api/admin/search/releases
GET    /api/admin/search/results/:searchId
POST   /api/admin/search/results/:resultId/choose
POST   /api/admin/search/results/:resultId/reject
```

## Download clients

```txt
GET    /api/admin/download-clients
POST   /api/admin/download-clients
PATCH  /api/admin/download-clients/:id
DELETE /api/admin/download-clients/:id
POST   /api/admin/download-clients/:id/test
POST   /api/admin/downloads/add
GET    /api/admin/downloads
GET    /api/admin/downloads/:id
```

## Library/imports

```txt
POST   /api/admin/library/scan
GET    /api/admin/imports
POST   /api/admin/imports/:id/confirm
POST   /api/admin/imports/:id/manual-match
POST   /api/admin/imports/:id/reject
```

## Watch/player

```txt
GET    /api/watch/anime
GET    /api/watch/anime/:animeId
GET    /api/watch/episodes/:episodeId
GET    /api/watch/episodes/:episodeId/stream
POST   /api/watch/progress
GET    /api/watch/continue
```

## Jobs

```txt
GET    /api/admin/jobs
GET    /api/admin/jobs/:id
POST   /api/admin/jobs/:id/retry
POST   /api/admin/jobs/:id/cancel
```

## Settings

```txt
GET    /api/admin/settings
PATCH  /api/admin/settings
GET    /api/admin/quality-profiles
POST   /api/admin/quality-profiles
PATCH  /api/admin/quality-profiles/:id
DELETE /api/admin/quality-profiles/:id
GET    /api/admin/release-groups
POST   /api/admin/release-groups
PATCH  /api/admin/release-groups/:id
DELETE /api/admin/release-groups/:id
```

---

# 14. Permission Matrix

```txt
Route group                         Admin   User   Guest
--------------------------------------------------------
/api/auth/login                     yes     yes    yes
/api/auth/logout                    yes     yes    no
/api/auth/me                        yes     yes    no
/api/metadata/search                yes     yes    no
/api/anime                          yes     yes    no
/api/requests                       yes     yes    no
/api/requests/mine                  yes     yes    no
/api/watch/*                        yes     yes    no
/api/admin/*                        yes     no     no
```

Admin-only actions:

- User management.
- Integration management.
- Provider settings.
- Download client settings.
- Quality profile management.
- Release group management.
- Request approval/denial.
- Manual imports.
- File path configuration.
- Library scan configuration.
- Job retry/cancel.

---

# 15. Parser and Scoring Strategy

## 15.1 Normalize everything

Before matching, normalize titles:

- Lowercase.
- Trim spaces.
- Remove repeated punctuation.
- Normalize Unicode where reasonable.
- Remove common noise tokens.
- Convert full-width numbers where reasonable.
- Keep original title for display.

## 15.2 Parse in layers

Recommended parser layers:

1. Extract leading release group from `[Group]`.
2. Extract trailing hash from `[A1B2C3D4]`.
3. Extract bracket tags.
4. Detect resolution.
5. Detect codecs.
6. Detect source.
7. Detect audio/subtitle tags.
8. Detect dub/dual-audio.
9. Detect season/episode patterns.
10. Detect anime-style `Title - 12` pattern.
11. Detect episode ranges and batches.
12. Remaining text becomes title candidate.

## 15.3 Score in layers

Recommended scoring categories:

```txt
Title match:        0-40 points
Episode match:      0-30 points
Quality match:      0-20 points
Group preference:   -50 to +20 points
Provider trust:     0-10 points
Health/seeders:     -20 to +10 points
Penalties:          as needed
```

## 15.4 Decision thresholds

Initial default:

```txt
score >= 80       accept
score 50-79       manual_review
score < 50        reject
blocked group     reject
wrong episode     reject
wrong title       reject
```

These thresholds should become configurable later.

---

# 16. Admin Search UI Requirements

The admin search UI is one of the most important features.

It should show a table like:

```txt
Score | Decision | Group | Title | Episode | Res | Codec | Subs | Seeders | Size | Provider | Reasons
```

Each result row should support:

- Expand details.
- View raw title.
- View parsed data.
- View rejection reasons.
- Choose result.
- Reject result.
- Add alias from result.
- Prefer release group.
- Block release group.
- Manual match anime/episode.

This UI is the core advantage over generic Sonarr-style workflows.

---

# 17. Library Import Rules

The importer must be careful.

## File operations

Support configurable import modes:

```txt
copy
move
hardlink
```

Start with copy or hardlink. Add move later.

## Path safety

All import paths must be resolved and checked against configured root directories.

Never trust a path from:

- User input.
- Download client response.
- Provider result.
- File name.

## Naming format

Start with a simple library format:

```txt
/anime/{Anime Title}/Season {seasonNumber}/S{seasonNumber}E{episodeNumber} - {Episode Title}.{ext}
```

For absolute numbering anime:

```txt
/anime/{Anime Title}/Episodes/{absoluteNumber} - {Episode Title}.{ext}
```

Allow custom naming later.

---

# 18. Security Checklist

The AI must keep this checklist active during implementation.

## Auth

- Hash passwords with a strong algorithm.
- Store only password hashes.
- Store only session token hashes.
- Use HttpOnly cookies.
- Use SameSite cookies.
- Use Secure cookies in production.
- Add login rate limits.

## Authorization

- Every admin route must require admin role.
- User routes must verify ownership where applicable.
- Watch routes must verify the user can access the episode.

## Filesystem

- No arbitrary path streaming.
- No path traversal.
- Only stream files registered in DB.
- Only scan configured directories.
- Hide absolute host paths from normal users.

## Secrets

- Encrypt provider/download client credentials.
- Never return secrets to frontend.
- Redact secrets in logs.
- Do not store secrets in plain JSON logs.

## External calls

- Use timeouts.
- Use retries carefully.
- Use rate limits.
- Do not follow unsafe redirects blindly.
- Do not allow SSRF through arbitrary user-provided URLs.

---

# 19. Testing Strategy

Prioritize tests for areas that can break automation.

## Unit tests

- Anime release parser.
- Title normalizer.
- Scoring engine.
- Permission checks.
- Path safety.
- Import matching.

## Integration tests

- Auth login/logout.
- Metadata import.
- Request approval.
- Search provider mock.
- Download client mock.
- Import flow.

## End-to-end tests later

- Admin imports anime.
- User requests anime.
- Admin approves.
- Search returns candidate.
- Admin selects candidate.
- Mock download completes.
- File imports.
- User watches.

---

# 20. Build Order Summary

Use this exact order unless there is a strong reason to change it:

```txt
0. Repo/tooling backbone
1. Database foundation
2. Auth/sessions/roles
3. Frontend shell
4. Jikan metadata provider
5. Manual anime library management
6. Basic playback and watch progress
7. User request system
8. Anime release parser package
9. Search provider abstraction
10. Native Nyaa-style search provider
11. Candidate scoring engine
12. Quality profiles and release groups
13. qBittorrent integration
14. Persistent jobs system
15. Completed download scanner
16. Import matcher and manual import UI
17. End-to-end approved request flow
18. Prowlarr/Jackett fallback providers
19. Subtitle/audio/player improvements
20. Realtime updates
21. Advanced search automation
22. HLS/transcoding controller
23. Additional metadata providers
24. Plugin system
25. Production hardening
```

---

# 21. First Coding Prompt for the AI

Use this as the first instruction to begin implementation:

```txt
You are building AnimeHub, a self-hosted anime-native media request, automation, and watching app.

Use Bun 1.3.14+ for the backend and React + Vite + TypeScript + Tailwind + shadcn/ui for the frontend.

Start with Phase 0 only.

Create a monorepo with:
- apps/server
- apps/web
- packages/shared
- packages/anime-parser

The backend should expose GET /health.
The frontend should show a simple app shell and call /health.
Use TypeScript everywhere.
Set up scripts so `bun run dev` starts both the backend and frontend dev servers.
Do not implement auth, metadata, downloads, or search yet.
Prepare the structure so those modules can be added later.

After completing Phase 0, report:
- files created
- commands to run
- what works
- what remains for Phase 1
```

---

# 22. Second Coding Prompt for the AI

Use this after Phase 0 is complete:

```txt
Continue AnimeHub by implementing Phase 1: Database Foundation.

Add SQLite database support, migrations, and typed schema definitions.
Create tables for:
- users
- sessions
- audit_logs
- anime_titles
- anime_aliases
- anime_external_ids
- episodes
- metadata_cache

Add a migration command.
Add a seed command that creates the first admin user from environment variables.
Do not implement login yet.
Make sure the migration can run on a fresh database.
Make sure seed is safe to rerun.

After completing Phase 1, report:
- schema created
- migration command
- seed command
- any environment variables required
- what remains for Phase 2
```

---

# 23. Third Coding Prompt for the AI

Use this after Phase 1 is complete:

```txt
Continue AnimeHub by implementing Phase 2: Auth, Sessions, Roles, and Permissions.

Implement:
- password hashing
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- server-side sessions
- hashed session tokens in the database
- HttpOnly cookie session handling
- admin/user roles
- permission middleware
- login rate limiting
- audit logs for login/logout

Do not implement anime metadata or requests yet.
Add frontend login page and basic auth state handling only if needed to verify the backend.

Acceptance criteria:
- admin can log in
- unauthenticated users cannot access protected route
- normal users cannot access admin route
- session survives refresh
- logout clears session
- password hashes and session tokens are never returned by API

After completing Phase 2, report:
- routes added
- middleware added
- security decisions
- test/manual verification steps
- what remains for Phase 3
```

---

# 24. Long-Term Product Identity

Do not build a generic Sonarr clone.

Build an anime-native system with these unique strengths:

- Native anime metadata.
- Strong alias handling.
- Native anime release parsing.
- Release-group intelligence.
- Transparent release scoring.
- Better Nyaa-style search handling.
- Manual correction tools.
- Watch/request/manage in one place.
- Admin-friendly automation.
- User-friendly request and playback experience.

The app should feel like:

```txt
Anime-native Overseerr
+ anime-native Sonarr search intelligence
+ lightweight Plex/Jellyfin-style watching
+ specialized provider connectors
```

---

# 25. Final Instruction to the AI Builder

Build slowly and safely.

Do not skip phases.
Do not add complex automation before the vertical slice works.
Do not hide search decisions from admins.
Do not rely on regex alone.
Do not make provider code impossible to disable.
Do not treat Jikan metadata as perfect truth.
Do not treat automatic matching as always correct.
Do not expose arbitrary host files to users.
Do not leak secrets.

The most important first milestone is:

```txt
A user can request anime.
An admin can approve it.
The app can find a candidate release.
The admin can inspect why it was chosen.
The app can download/import it.
The user can watch it.
```

Everything else comes later.
