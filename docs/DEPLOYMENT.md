# Sori Deployment

Sori now ships with an install-oriented deployment flow built for a single Ubuntu 22.04+ server.

Important architecture rule:

- production stays **Caddy-only**
- no nginx layer is introduced
- one install = one server = one default community

## Production Layout

- Web app: `https://example.com`
- API: `https://api.example.com`
- LiveKit signaling: `https://livekit.example.com`
- Media / MinIO public host: `https://media.example.com`

The installer derives the full topology from one root domain and writes everything into `.env`.

## Files

- Installer: [`install.sh`](../install.sh)
- Updater: [`update.sh`](../update.sh)
- Base compose: [`docker-compose.yml`](../docker-compose.yml)
- Production override: [`docker-compose.production.yml`](../docker-compose.production.yml)
- Production Caddy config: [`infrastructure/caddy/Caddyfile.production`](../infrastructure/caddy/Caddyfile.production)
- Production LiveKit config: [`infrastructure/livekit.production.yaml`](../infrastructure/livekit.production.yaml)
- Env template: [`.env.example`](../.env.example)

## Install Flow

The installer performs:

1. installs system dependencies:
   - Docker Engine
   - Docker Compose plugin
   - Git
   - `curl`, `openssl`, `ufw`, `jq`
2. clones or updates the repository
3. asks for:
   - root domain
   - ACME contact email
   - human-readable server name
4. validates DNS for:
   - `example.com`
   - `api.example.com`
   - `livekit.example.com`
   - `media.example.com`
5. generates secrets and hidden adminpanel credentials
6. writes `.env`
7. opens firewall rules for:
   - `80/tcp`
   - `443/tcp`
   - `7881/tcp`
   - `7882/udp`
8. runs:
   - DB migrations
   - install bootstrap
   - full compose deploy
9. waits for health and prints the install summary

## One-command Install

From inside the repo:

```bash
sudo bash install.sh --domain example.com --email admin@example.com --server-name "My Sori"
```

From a future GitHub-hosted raw script:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/<ref>/install.sh | sudo bash -s -- \
  --repo-url https://github.com/<owner>/<repo>.git \
  --ref main \
  --domain example.com \
  --email admin@example.com \
  --server-name "My Sori"
```

## Update Flow

Use:

```bash
sudo bash update.sh
```

Or pin a release tag:

```bash
sudo bash update.sh --ref v1.2.0
```

The updater:

1. fetches the latest git refs/tags
2. checks out the requested ref or updates the current branch
3. reapplies DB migrations
4. reruns install bootstrap so hidden admin metadata stays valid
5. rebuilds and restarts the production stack
6. waits for `/health`

## Hidden Adminpanel Account

The installer generates a hidden `adminpanel` user and stores its credentials in:

- `.env`
- `.install/admin-credentials.txt`

The role remains hidden from the regular chat system and is intended only for admin routes/UI.

## Operational Notes

- Caddy handles automatic HTTPS directly, which replaces the need for nginx + certbot in this architecture.
- Internal services are bound to `127.0.0.1` where appropriate through `.env` so they are not exposed publicly.
- LiveKit keeps TCP `7881` and UDP `7882` reachable for WebRTC.
- The install bootstrap also ensures:
  - the default community exists
  - default channels exist
  - server settings are seeded
  - public registration stays disabled
