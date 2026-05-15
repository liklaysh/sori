# Changelog

## 0.1.5

- Fixed a server time synchronization request stampede in the web client that could trigger bursts of `/time` requests during heavy chat rendering.
- Fixed web voice channel manual leave behavior so stale occupant snapshots no longer reconnect the user after pressing disconnect.
- Unified the web voice connected controls with the user control card so the connected voice state renders as one compact sidebar component.

## 0.1.4

- Added a unified user-level noise suppression mode model with WebRTC Basic and RNNoise support in the web client, backed by synced voice preferences.
- Improved voice channel restore behavior after browser refresh so the connected voice module and LiveKit session recover consistently.
- Reworked message reactions so reaction pills attach to the message bubble instead of rendering as detached rows.
- Redesigned audio attachment bubbles with compact file metadata, inline playback controls, progress seeking, and volume handling.
- Updated localized README documentation with project support information.

## 0.1.3

- Improved voice channel occupant synchronization so explicit leave actions and mute/deafen status changes converge faster across clients.
- Restored the chat "scroll to latest message" control in the web client and added the same behavior to the desktop app.
- Improved chat timers to consistently use `HH:MM:SS` formatting for longer voice/call sessions.
- Refined chat UI details found during testing, including DM dividers, message container color consistency, skeleton accessibility, and input tray colors.

## 0.1.2

- Improved voice reconnect stability and presence synchronization during navigation and transient network failures.
- Expanded call telemetry diagnostics for packet loss, jitter, RTT, reconnects, ICE/server information, and quality analysis.
- Improved chat file UX with drag-and-drop handling, max file size hints, paste support, audio attachments, and post-send input focus.
- Synchronized message context menu and quick reaction behavior across clients.
- Improved server install/update reliability and bootstrap execution so updates do not hang on one-off containers.
- Refined production diagnostics export and health checks for easier support analysis.

## 0.1.1

- Improved voice stability, occupant synchronization, and channel sound events.
- Added expanded call telemetry diagnostics with min/max metrics and quality distribution.
- Added admin Diagnostics tab and server diagnostics export tooling.
- Improved desktop app compatibility foundation and release/update readiness.
- Fixed chat and voice UX issues found during pilot testing.

## 0.1.0

- Initial public GitHub release / installer-ready version.
