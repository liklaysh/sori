# Client Bootstrap Spec v1

This document defines the current discovery contract for future desktop and mobile Sori clients.

## Goal

A native client should need only one server URL.

Given a server URL, the client fetches bootstrap metadata and derives:

- API base URL
- WebSocket URL
- LiveKit URL
- media host
- auth paths
- install mode
- default community id

## Endpoints

The server exposes the same payload from both paths:

- `GET /client/bootstrap`
- `GET /.well-known/sori/client.json`

## Version

- current version: `1`

## Response Shape

```json
{
  "version": 1,
  "server": {
    "name": "Sori Server",
    "installMode": "single-community",
    "defaultCommunityId": "default-community"
  },
  "endpoints": {
    "web": "https://example.com",
    "api": "https://api.example.com",
    "ws": "wss://api.example.com",
    "livekit": "wss://livekit.example.com",
    "media": "https://media.example.com",
    "health": "https://api.example.com/health"
  },
  "auth": {
    "mode": "cookie",
    "loginPath": "/auth/login",
    "mePath": "/auth/me",
    "refreshPath": "/auth/refresh",
    "logoutPath": "/auth/logout"
  },
  "realtime": {
    "socketPath": "/socket.io",
    "transports": ["websocket"]
  },
  "upload": {
    "maxUploadSizeMb": 25
  },
  "features": {
    "directMessages": true,
    "directCalls": true,
    "voiceChannels": true,
    "mediaUploads": true,
    "multiCommunity": false
  },
  "generatedAt": "2026-04-22T00:00:00.000Z"
}
```

## Semantics

### `server`

- `name`: display name for the install
- `installMode`: currently always `single-community`
- `defaultCommunityId`: boot community for this install

### `endpoints`

- `web`: public web app origin
- `api`: REST API origin
- `ws`: Socket.IO origin
- `livekit`: public LiveKit signaling origin
- `media`: public media/object host
- `health`: health endpoint for install diagnostics

### `auth`

- `mode`: currently `cookie`
- path fields are path-only and should be joined onto `endpoints.api`

### `realtime`

- `socketPath`: Socket.IO path relative to `endpoints.ws`
- `transports`: current transport hints for the client

### `upload`

- `maxUploadSizeMb`: server-declared upload limit

### `features`

These are capability hints, not authorization.

## Client Rules

1. The client should trust `version` and branch parsing logic by version.
2. The client should treat unknown top-level fields as forward-compatible.
3. The client should not hardcode Sori hostnames when bootstrap is available.
4. The client should prefer `/.well-known/sori/client.json` when starting from a root server URL.

## Source of Truth

Runtime payload is currently generated in:

- [`apps/backend/src/routes/client.ts`](../apps/backend/src/routes/client.ts)

Type contract is defined in:

- [`apps/backend/src/types/clientBootstrap.ts`](../apps/backend/src/types/clientBootstrap.ts)
