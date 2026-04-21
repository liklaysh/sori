# SORI — System Reference

SORI is a single-server communication platform focused on persistent chat, voice channels, direct messages, direct calls, media uploads, and an embedded admin panel. The current deployment model is intentionally simple: one install, one server, one default community, Caddy-only routing, and Docker/OrbStack-friendly local runtime on macOS.

This file describes the system as it exists in the repository today.

## Product Model

- Install mode: single-server, single-community
- Default community: `default-community`
- Primary domains:
  - `sori-web.sori.orb.local`
  - `sori-backend.sori.orb.local`
  - `sori-livekit.sori.orb.local`
  - `sori-media.sori.orb.local`
- TLS: self-signed wildcard certificate
- Routing model: Caddy-only
- Current auth model: cookie-based auth via `sori_auth`

The system is not currently designed around granular role/ACL enforcement or multi-community tenancy. That is intentionally deferred. The architecture should remain install-friendly and predictable for a small private community.

## Monorepo Layout

- Backend: [`apps/backend`](/Users/liklaysh/Documents/dev/voice/sori/apps/backend)
- Web app: [`apps/web`](/Users/liklaysh/Documents/dev/voice/sori/apps/web)
- Shared UI package: [`packages/ui`](/Users/liklaysh/Documents/dev/voice/sori/packages/ui)
- Gateway Caddy config: [`infrastructure/caddy/Caddyfile`](/Users/liklaysh/Documents/dev/voice/sori/infrastructure/caddy/Caddyfile)
- Web runtime Caddy config: [`apps/web/Caddyfile`](/Users/liklaysh/Documents/dev/voice/sori/apps/web/Caddyfile)
- Compose stack: [`docker-compose.yml`](/Users/liklaysh/Documents/dev/voice/sori/docker-compose.yml)
- Caddy migration validator: [`scripts/validate-caddy-migration.sh`](/Users/liklaysh/Documents/dev/voice/sori/scripts/validate-caddy-migration.sh)

## Runtime Stack

### Backend

- Runtime: Node.js 20
- Framework: Hono
- Database: PostgreSQL
- ORM: Drizzle
- Realtime: Socket.IO
- Cache/presence/runtime state: Valkey
- Media engine: LiveKit
- Object storage: MinIO (S3-compatible)

### Frontend

- React 18
- Vite
- Zustand
- Tailwind + shared `@sori/ui`
- Sonner for notifications
- LiveKit React components for voice/call UI

### Infrastructure

- Gateway: Caddy
- Web runtime: Caddy
- Local orchestration: Docker Compose / OrbStack

## Current Architecture

### Community and Chat Model

- The application boots into a single install context centered on `default-community`
- Messages are stored and consumed through context-based buckets, not a legacy flat message list
- Web chat state is organized around `messagesByContext`
- DM read flow uses `POST /dm/conversations/:id/read`
- Public user payloads are sanitized before frontend consumption

### Media / Attachments Model

- The message/media contract has been normalized around `attachment`
- The old flat media contract must not be reintroduced
- Upload size is synchronized through:
  - backend: `MAX_UPLOAD_SIZE_MB`
  - frontend: `VITE_MAX_UPLOAD_SIZE_MB`
- Upload handling has been hardened to stream data rather than reading full files into memory

### Voice and Calling Model

- Voice channels and direct calls both use LiveKit, but they are different product flows
- Voice channel UX is persistent and community-scoped
- Direct call UX is overlay-first and can be expanded into a full call workspace
- Voice occupant state includes:
  - speaking status
  - streaming status
  - mute status
  - deafen status
- Voice/disconnect cleanup is handled both client-side and server-side to reduce stale occupants and zombie sessions

### Admin Model

- The admin panel is part of the same web app
- It includes:
  - dashboard
  - users
  - channels
  - storage
  - backups
  - telemetry
  - audit
- `Server Logs` was intentionally removed from the UI
- `Interaction Streams` was intentionally removed from audit because telemetry covers operational call visibility better

## Routing and Deployment

### Caddy-Only Deployment

The system intentionally uses a Caddy-only scheme.

- Gateway Caddy handles public host routing and TLS termination
- Web runtime also runs on Caddy
- No additional nginx layer should be reintroduced

### Public Host Routing

- `sori-web.*` -> web runtime
- `sori-backend.*` -> backend
- `sori-livekit.*` -> LiveKit
- `sori-media.*` -> MinIO/media

### Discovery Layer for Future Native Clients

The repository now contains a discovery/bootstrap contract for future Windows/macOS/Android clients.

Endpoints:
- `GET /client/bootstrap`
- `GET /.well-known/sori/client.json`

Implemented in:
- [`apps/backend/src/routes/client.ts`](/Users/liklaysh/Documents/dev/voice/sori/apps/backend/src/routes/client.ts)

Exposed through:
- backend host
- web host
- gateway-level well-known routing

The payload currently includes:
- install mode
- default community id
- web/api/ws/livekit/media endpoints
- auth paths
- socket path and transport hints
- upload limit
- basic feature flags

This lets a future native client accept one server URL, fetch bootstrap metadata, and derive the correct API/socket/media/livekit endpoints without hardcoding them.

## Configuration

### Important Environment Variables

- `JWT_SECRET`
- `DATABASE_URL`
- `VALKEY_URL`
- `S3_ENDPOINT`
- `S3_PUBLIC_URL`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `ALLOWED_ORIGINS`
- `MAX_UPLOAD_SIZE_MB`
- `VITE_MAX_UPLOAD_SIZE_MB`
- `PUBLIC_WEB_URL`
- `PUBLIC_API_URL`
- `PUBLIC_WS_URL`
- `PUBLIC_LIVEKIT_URL`
- `PUBLIC_MEDIA_URL`
- `PUBLIC_DEFAULT_COMMUNITY_ID`

Critical backend config is now treated as required. The system should not silently fall back to weak defaults for secrets or external endpoints.

## Backups

Backups are currently handled by the dedicated `postgres-backup` service in Docker Compose.

Policy:
- cadence: once every 24 hours
- retention: always keep only 3 copies
- when a 4th backup is created, the oldest one is deleted

Implementation notes:
- weekly/monthly backup tails are disabled
- backup artifacts are surfaced in Admin -> Backups
- UI supports list + download
- restore is intentionally not performed from the web UI

Related files:
- [`docker-compose.yml`](/Users/liklaysh/Documents/dev/voice/sori/docker-compose.yml)
- [`infrastructure/backup/hooks`](/Users/liklaysh/Documents/dev/voice/sori/infrastructure/backup/hooks)
- [`apps/backend/src/routes/admin/storage.ts`](/Users/liklaysh/Documents/dev/voice/sori/apps/backend/src/routes/admin/storage.ts)

## Observability and Operational Behavior

### Telemetry

- Call telemetry is available through the admin panel
- Stale call cleanup is performed outside of the telemetry GET endpoint
- Telemetry views should be read-oriented, not self-healing by side effect

### Health and Validation

- Backend exposes health endpoints
- Gateway/Caddy migration is validated through:
  - [`scripts/validate-caddy-migration.sh`](/Users/liklaysh/Documents/dev/voice/sori/scripts/validate-caddy-migration.sh)

### Smoke Test

The repo now includes a runtime smoke gate:
- [`apps/backend/src/tests/smoke.runtime.test.ts`](/Users/liklaysh/Documents/dev/voice/sori/apps/backend/src/tests/smoke.runtime.test.ts)

Current smoke coverage includes:
- admin login
- critical admin endpoints
- user provisioning
- regular login
- user search
- upload
- channel message send
- DM send/read
- voice token issuance
- voice join + disconnect cleanup
- direct call initiate/accept/token/end
- discovery endpoint checks from backend and web entrypoints

Root test command:
- `npm test`

## Frontend State and UI Notes

### Chat Runtime

- `ChatArea` is still a central coordinator, but several heavy paths have already been split out
- Voice/livekit shell is lazy-loaded
- Admin tabs are lazy-loaded
- Several modal and overlay paths are lazy-loaded

### Current UX Decisions

- Direct call starts as overlay-first
- Expanding a direct call moves the user into the full call workspace
- Voice channel and direct call UI are intentionally visually aligned where possible
- Search placeholders and noisy empty-state artifacts have been reduced
- Notifications use a single global toaster host

### Design Tokens

- `chat-bubble-me` is now part of the design system and used for self-message bubbles
- Bubble styling avoids transparent glass effects and keeps the denser SORI surface language

## Hardening Already Landed

The following work has already been integrated into the repository:

- Caddy-only gateway/runtime migration
- removal of weak backend config fallbacks
- stricter CORS behavior
- stable cookie/logout behavior
- link preview SSRF hardening
- streaming uploads instead of full in-memory reads
- cleanup of stale call telemetry paths
- reduced realtime noise in chat/presence refresh
- direct-call lifecycle hardening
- removal of legacy frontend dead hooks
- bundle splitting and lazy loading for major frontend surfaces

## Current Constraints

These are deliberate and should be preserved unless the product direction changes:

- single-server install
- single default community
- no extra nginx/gateway layer
- Caddy-only deployment
- current attachment contract
- current context-based message storage
- install-friendly direction for future `install.sh` / `update.sh`

## Recommended Release Checks

Before shipping a meaningful runtime change, verify at least:

```bash
npm run build -w @sori/backend
npm run build -w @sori/web
npm run deploy:backend
npm run deploy:web
npm test
bash scripts/validate-caddy-migration.sh
```

Then manually smoke:
- login
- channel chat
- DM
- voice join/leave
- direct call
- upload
- admin telemetry
- admin backups

## Summary

SORI today is a single-community, Caddy-routed, Docker-friendly communication stack with chat, DMs, direct calls, voice channels, uploads, admin tooling, backup visibility, and a newly introduced discovery/bootstrap contract for future native clients.

The most important architectural rule going forward is this:

One server URL should be enough for a future client to discover how to talk to the whole system.
