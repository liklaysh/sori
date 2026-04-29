# Sori Install Guide

This guide describes the production-style single-server install flow.

Sori installs as:

- one Ubuntu 22.04+ server
- one root domain
- one default community
- Docker Compose runtime
- Caddy-only public routing
- automatic HTTPS through Caddy / Let's Encrypt

No nginx or certbot layer is required.

## What You Need

- Ubuntu 22.04+ server with root/sudo access
- Public IPv4 address
- A domain pointed at the server
- Open provider/cloud firewall ports:
  - `22/tcp` for SSH
  - `80/tcp` for ACME HTTP challenge
  - `443/tcp` for web/API/media/LiveKit signaling
  - `7881/tcp` for LiveKit RTC TCP
  - `7882/udp` for LiveKit RTC UDP

## DNS Records

Create these `A` records before running the installer:

```text
example.com          -> server public IPv4
api.example.com      -> server public IPv4
livekit.example.com  -> server public IPv4
media.example.com    -> server public IPv4
```

Replace `example.com` with your real domain.

## One-Command Install

After the repository is published, the normal install command is:

```bash
curl -fsSL https://github.com/liklaysh/sori/raw/main/install.sh | sudo bash
```

The installer then asks for:

- root domain
- ACME / Let's Encrypt contact email
- server name
- whether to enable `ufw`

## Install From an Existing Checkout

If the repository is already on the server:

```bash
sudo bash install.sh
```

The installer asks for required values interactively.

## Advanced / Non-Interactive Install

You can still pass values explicitly for automation:

```bash
curl -fsSL https://github.com/liklaysh/sori/raw/main/install.sh | sudo bash -s -- \
  --repo-url https://github.com/liklaysh/sori.git \
  --ref main \
  --domain example.com \
  --email admin@example.com \
  --server-name "My Sori"
```

Replace the domain values with your real domain and email.

If the installer script was downloaded from a build that does not have a default repository URL baked in, it asks for the Git repository URL interactively.

## What the Installer Does

The installer:

1. Verifies Ubuntu 22.04+ and root execution.
2. Installs required system packages:
   - Docker Engine
   - Docker Compose plugin
   - Git
   - `curl`
   - `openssl`
   - `jq`
   - `ufw`
3. Clones or updates the repository.
4. Asks for:
   - root domain
   - ACME / Let's Encrypt contact email
   - human-readable server name
5. Prints and validates required DNS records for:
   - root web host
   - API host
   - LiveKit host
   - media host
6. Adds host firewall rules for:
   - `OpenSSH`
   - `22/tcp`
   - `80/tcp`
   - `443/tcp`
   - `7881/tcp`
   - `7882/udp`
7. Asks whether to enable `ufw` immediately.
8. Generates or preserves runtime secrets.
9. Generates or preserves hidden `adminpanel` credentials.
10. Writes `.env`.
11. Starts infrastructure services.
12. Runs database migrations.
13. Runs install bootstrap:
    - default community
    - default channels
    - server settings
    - hidden `adminpanel` user
14. Validates production Caddy config.
15. Builds and starts the application stack.
16. Waits for backend health.
17. Validates native-client discovery at:
    - `https://example.com/.well-known/sori/client.json`
18. Writes final credentials to:
    - `.install/admin-credentials.txt`
19. Prints:
    - platform URL
    - admin URL
    - admin login/password
    - client server address
    - client bootstrap URL

## Firewall Prompt

The installer always adds SSH-safe rules before asking to enable `ufw`:

```text
OpenSSH
22/tcp
80/tcp
443/tcp
7881/tcp
7882/udp
```

If `ufw` is inactive, the installer asks:

```text
Enable ufw now? [y/N]
```

Choose `y` only after confirming your provider/cloud firewall also allows the required ports.

## Generated Files

The installer writes:

- `.env`
- `.install/admin-credentials.txt`

Both are created with `chmod 600`.

Do not commit these files.

## Final Output

At the end of a successful install, the installer prints:

```text
SORI installed successfully
URL: https://example.com
Admin: https://example.com/admin
Client server address: https://example.com
Client bootstrap: https://example.com/.well-known/sori/client.json
Login: <generated-admin-login>
Password: <generated-admin-password>
Credentials file: /opt/sori/.install/admin-credentials.txt
```

## Admin Access

The installer creates a hidden `adminpanel` user.

Use the printed credentials to open:

```text
https://example.com/admin
```

The `adminpanel` account is intended for system management and admin UI access.

## Future Desktop / Windows Client

Native clients should ask the user for one server address:

```text
https://example.com
```

Then the client should fetch:

```text
https://example.com/.well-known/sori/client.json
```

That bootstrap payload returns:

- API endpoint
- WebSocket endpoint
- LiveKit endpoint
- media endpoint
- auth paths
- socket path
- default community id
- feature flags

The current auth mode is cookie-based. A native client should keep a cookie jar for the selected server.

Desktop clients are trusted through `DESKTOP_APP_ORIGINS`. The installer writes the default Tauri origins:

```env
DESKTOP_APP_ORIGINS=tauri://localhost,http://tauri.localhost,https://tauri.localhost
```

These origins are used only for the desktop client CORS/CSRF boundary. The web admin panel remains available only through the server web interface.

## Updating

Use the one-command updater:

```bash
curl -fsSL https://github.com/liklaysh/sori/raw/main/update.sh | sudo bash
```

If you are already inside the installed checkout:

```bash
sudo bash update.sh
```

Pin a branch/tag/ref:

```bash
curl -fsSL https://github.com/liklaysh/sori/raw/main/update.sh | sudo bash -s -- --ref v1.2.0
```

The updater pulls the selected ref, reapplies migrations/bootstrap, rebuilds services, restarts the stack, waits for health, validates client discovery, and prints the platform links again.

## Troubleshooting

If install fails during HTTPS or health checks, verify:

- DNS records point to this server public IPv4.
- Provider/cloud firewall allows `80/tcp` and `443/tcp`.
- Provider/cloud firewall allows LiveKit ports `7881/tcp` and `7882/udp`.
- No other service is already binding `80` or `443`.
- The server can reach Let's Encrypt.

If the client bootstrap check fails, verify:

```bash
curl -fsS https://example.com/.well-known/sori/client.json | jq
```

The response should include `version`, `endpoints`, `auth`, `realtime`, and `server` metadata.
