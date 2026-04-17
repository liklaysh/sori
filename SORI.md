# 🌌 SORI (Sanctuary) — Neon Nocturne Core

**SORI** is a high-fidelity, production-grade communication platform designed with a **Neon Nocturne** aesthetic. It integrates real-time chat, high-performance voice connectivity, and a robust administrative suite within a unified monorepo architecture.

---

## 🛠 Technology Stack

### 🟦 Core Infrastructure
- **Monorepo Architecture**: Managed via `npm workspaces` for seamless dependency sharing between apps/packages.
- **Runtime Environment**: Node.js (v20+) with `tsx` for backend execution and `Vite` for frontend orchestration.
- **Media Engine**: **LiveKit** orchestrated through Docker/OrbStack for ultra-low latency voice/video.
- **Object Storage**: **MinIO** (S3-compatible) for secured file persistence and profile assets.
- **Caching & Presence**: **Valkey** (Redis-alternative) for real-time presence sync and link metadata caching.

### 🟧 Backend (`@sori/backend`)
- **Framework**: **Hono** — ultra-fast web framework with built-in JWT middleware and type-safe routing.
- **Database**: **PostgreSQL** (via `postgres.js`) optimized with **Drizzle ORM** for type-safe relational data management.
- **Identity**: `nanoid` for secure, non-sequential identity generation.
- **Utilities**: `bcryptjs` for credential hashing, `zod` for request validation, and `open-graph-scraper` for rich link previews.
- **Socket Engine**: `Socket.io` with Redis adapter for horizontal scaling and real-time event propagation.

### 🟪 Frontend (`@sori/web`)
- **Library**: **React 18** with **Vite** for optimized HMR and build performance.
- **State Management**: **Zustand** for lightweight, persistent global state.
- **Styling**: **Vanilla CSS / CSS Modules** + **Tailwind CSS** for layout utilities.
- **UI Components**: Custom internal library `@sori/ui` built for the Neon Nocturne aesthetic (no transparency, high contrast).
- **Media Layer**: `@livekit/components-react` and `livekit-client` for complex voice interaction logic.
- **Icons & Polish**: `lucide-react` for iconography and `sonner` for toast notifications.

---

## 🏗 System Architecture & Recent Refactoring

### 🔄 Data Integrity (PostgreSQL Migration)
The system has been fully migrated from legacy SQLite to **PostgreSQL**.
- **Relation Mapping**: Drizzle ORM provides a single source of truth for the schema in `apps/backend/src/db/schema.ts`.
- **Performance**: Leveraging PostgreSQL's robust indexing and connection pooling for high-concurrency chat environments.

### 🛡️ Data Resilience (Backup System)
A decentralized backup service has been integrated into the Admin Panel:
- **Automation**: `postgres-backup-local` service generates snapshots every 12 hours.
- **Registry & Download**: Admins can view the registry and download `.sql.gz` snapshots directly from the Web-UI for cold storage.
- **Safety**: 72-hour rolling retention policy for automated snapshots.

### 🎨 Unified Identity Sync (Avatar Refactor)
Implemented a system-wide **Avatar Resolution Protocol**:
- **Utility**: `getAvatarUrl` standardizes the pathing for local MinIO uploads vs external CDN images.
- **Consistency**: Real-time avatar updates are now synchronized instantly across the Sidebar, Member Lists, and Voice Grids.

### 📊 Telemetry & Monitoring
- **MOS Calculations**: Real-time Mean Opinion Score tracking for every voice session.
- **Purification**: Automated 72-hour cleanup of operational logs to maintain optimal DB performance.

---

## 📋 Features

### 💬 Communication
- **Persistent Channels**: Categorized text and voice channels with role-based access.
- **Rich Presence**: Real-time "Who's Talking" visualization via socket heartbeats.
- **Direct Messaging**: Secured 1-on-1 conversations with online/offline status indicators.

### 🎙️ Global Calling
- **Noise Suppression**: Integration of `RNNoise` (WASM) for studio-quality audio in noisy environments.
- **Floating Overlays**: Non-blocking call interface that persists during navigation.

### 👑 Administrative Mission Control
- **Identity Registry**: Infinite-scroll management of all citizens with credential rotation capabilities.
- **System Health**: Live dashboard monitoring of Backend, PostgreSQL, LiveKit, and MinIO latency.
- **Audit Ledger**: Comprehensive tracking of administrative actions for system accountability.

---

## 💻 Development Workflow

### Requirements
- **OrbStack** (recommended for macOS) or Docker Desktop.
- **Node.js v20+**.
- **PostgreSQL**, **Valkey**, **MinIO**, and **LiveKit** running locally.

### Commands
```bash
# Install dependencies
npm install

# Start development environment
npm run dev:backend  # Start Hono API
npm run dev:web      # Start Vite Frontend

# Database management
npm run db:push -w @sori/backend    # Push schema changes to DB
npm run db:studio -w @sori/backend  # Open Drizzle Studio
```

---
*Sanctuary: Neon Nocturne Aesthetic • Production-Ready Infrastructure • Verified by Antigravity*
