#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_VERSION="1.0.0"
DEFAULT_INSTALL_DIR="/opt/sori"
DEFAULT_REPO_URL="https://github.com/liklaysh/sori.git"
DEFAULT_GIT_REF="main"
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.production.yml)

log() {
  printf '[INFO] %s\n' "$*"
}

warn() {
  printf '[WARN] %s\n' "$*" >&2
}

die() {
  printf '[ERROR] %s\n' "$*" >&2
  exit 1
}

on_error() {
  local line="$1"
  local command="${2:-unknown}"
  die "Installation failed near line ${line}: ${command}"
}

trap 'on_error $LINENO "$BASH_COMMAND"' ERR

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Run install.sh as root on Ubuntu 22.04+."
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

read_from_tty() {
  local prompt="$1"
  local value

  if [[ -r /dev/tty ]]; then
    read -r -p "${prompt}" value </dev/tty || true
  else
    read -r -p "${prompt}" value || true
  fi

  printf '%s' "${value}"
}

prompt_if_empty() {
  local var_name="${1:-}"
  local prompt="${2:-}"
  local default_value="${3:-}"
  local current_value

  [[ -n "${var_name}" ]] || die "prompt_if_empty requires a variable name."
  [[ -n "${prompt}" ]] || die "prompt_if_empty requires a prompt for ${var_name}."

  current_value="${!var_name:-}"

  if [[ -n "${current_value}" ]]; then
    return 0
  fi

  if [[ -n "${default_value}" ]]; then
    current_value="$(read_from_tty "${prompt} [${default_value}]: ")"
    current_value="${current_value:-$default_value}"
  else
    current_value="$(read_from_tty "${prompt}: ")"
  fi

  [[ -n "${current_value}" ]] || die "${var_name} is required."
  printf -v "${var_name}" '%s' "${current_value}"
}

prompt_yes_no() {
  local prompt="$1"
  local default_value="${2:-N}"
  local answer

  answer="$(read_from_tty "${prompt} [y/N]: ")"
  answer="${answer:-$default_value}"
  [[ "${answer}" =~ ^[Yy]$ ]]
}

generate_hex() {
  openssl rand -hex "${1:-32}"
}

generate_password() {
  openssl rand -base64 36 | tr -d '\n' | tr '/+' 'AB' | cut -c1-32
}

generate_admin_login() {
  printf 'admin-%s' "$(openssl rand -hex 3)"
}

apt_install() {
  DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
}

install_system_dependencies() {
  log "Installing base system dependencies..."
  apt-get update -y
  apt_install ca-certificates curl gnupg lsb-release git jq ufw openssl

  if ! command_exists docker; then
    log "Installing Docker Engine and Docker Compose plugin..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    local arch codename
    arch="$(dpkg --print-architecture)"
    codename="$(. /etc/os-release && printf '%s' "${VERSION_CODENAME}")"
    printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
      "${arch}" "${codename}" >/etc/apt/sources.list.d/docker.list

    apt-get update -y
    apt_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
  else
    log "Docker already installed, skipping package install."
  fi

  docker version >/dev/null
  docker compose version >/dev/null
}

ensure_supported_os() {
  [[ -f /etc/os-release ]] || die "Unsupported Linux distribution."
  . /etc/os-release
  [[ "${ID}" == "ubuntu" ]] || die "This installer currently supports Ubuntu 22.04+ only."
  local major="${VERSION_ID%%.*}"
  [[ "${major}" -ge 22 ]] || die "Ubuntu 22.04+ is required."
}

parse_args() {
  REPO_URL="${SORI_REPO_URL:-$DEFAULT_REPO_URL}"
  INSTALL_DIR="${SORI_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
  GIT_REF="${SORI_GIT_REF:-$DEFAULT_GIT_REF}"
  DOMAIN="${SORI_DOMAIN:-}"
  ACME_EMAIL="${SORI_ACME_EMAIL:-}"
  SERVER_NAME="${SORI_SERVER_NAME:-}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo-url)
        REPO_URL="$2"
        shift 2
        ;;
      --install-dir)
        INSTALL_DIR="$2"
        shift 2
        ;;
      --ref)
        GIT_REF="$2"
        shift 2
        ;;
      --domain)
        DOMAIN="$2"
        shift 2
        ;;
      --email)
        ACME_EMAIL="$2"
        shift 2
        ;;
      --server-name)
        SERVER_NAME="$2"
        shift 2
        ;;
      --help|-h)
        cat <<'EOF'
Usage: bash install.sh [options]

Options:
  --repo-url <url>      Git repository URL used for clone/update
  --install-dir <path>  Install directory (default: /opt/sori)
  --ref <ref>           Git ref or release tag to deploy (default: main)
  --domain <domain>     Public root domain (example.com)
  --email <email>       ACME contact email for Caddy
  --server-name <name>  Human-readable server name
EOF
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
}

resolve_repo_dir() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  if [[ -f "${script_dir}/package.json" && -d "${script_dir}/apps/backend" ]]; then
    REPO_DIR="${script_dir}"
    log "Using existing repository at ${REPO_DIR}"
    return 0
  fi

  prompt_if_empty REPO_URL "Git repository URL" "${DEFAULT_REPO_URL}"

  mkdir -p "${INSTALL_DIR}"

  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    REPO_DIR="${INSTALL_DIR}"
    log "Repository already present, fetching updates..."
    git -C "${REPO_DIR}" remote set-url origin "${REPO_URL}"
    git -C "${REPO_DIR}" fetch --tags --prune origin
  else
    log "Cloning repository from ${REPO_URL} into ${INSTALL_DIR}..."
    git clone "${REPO_URL}" "${INSTALL_DIR}"
    REPO_DIR="${INSTALL_DIR}"
  fi

  git -C "${REPO_DIR}" fetch --tags --prune origin
  git -C "${REPO_DIR}" checkout "${GIT_REF}"

  if git -C "${REPO_DIR}" show-ref --verify --quiet "refs/remotes/origin/${GIT_REF}"; then
    git -C "${REPO_DIR}" reset --hard "origin/${GIT_REF}"
  fi
}

validate_domain() {
  [[ "${DOMAIN}" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "Invalid public domain: ${DOMAIN}"
}

load_existing_env_value() {
  local env_file="$1"
  local key="$2"
  [[ -f "${env_file}" ]] || return 1
  awk -F= -v k="${key}" '$1 == k {print substr($0, index($0, "=") + 1)}' "${env_file}" | tail -n1
}

collect_install_inputs() {
  prompt_if_empty DOMAIN "Primary public domain" ""
  validate_domain
  prompt_if_empty ACME_EMAIL "ACME / Let's Encrypt contact email" "admin@${DOMAIN}"
  prompt_if_empty SERVER_NAME "Server name" "Sori Server"

  WEB_HOST="${DOMAIN}"
  API_HOST="api.${DOMAIN}"
  LIVEKIT_HOST="livekit.${DOMAIN}"
  MEDIA_HOST="media.${DOMAIN}"
}

print_dns_requirements() {
  printf '\n'
  log "Required DNS records for this install:"
  if [[ -n "${PUBLIC_IP:-}" ]]; then
    printf '  A  %-28s -> %s\n' "${WEB_HOST}" "${PUBLIC_IP}"
    printf '  A  %-28s -> %s\n' "${API_HOST}" "${PUBLIC_IP}"
    printf '  A  %-28s -> %s\n' "${LIVEKIT_HOST}" "${PUBLIC_IP}"
    printf '  A  %-28s -> %s\n' "${MEDIA_HOST}" "${PUBLIC_IP}"
  else
    printf '  A  %s -> this server public IPv4\n' "${WEB_HOST}"
    printf '  A  %s -> this server public IPv4\n' "${API_HOST}"
    printf '  A  %s -> this server public IPv4\n' "${LIVEKIT_HOST}"
    printf '  A  %s -> this server public IPv4\n' "${MEDIA_HOST}"
  fi
  printf '\n'
  log "Cloud firewall / provider security group must allow: 22/tcp, 80/tcp, 443/tcp, 7881/tcp, 7882/udp."
}

fetch_public_ip() {
  PUBLIC_IP="$(curl -4fsSL https://api.ipify.org || true)"
}

confirm_dns_or_exit() {
  local host="$1"
  local resolved
  resolved="$(getent ahostsv4 "${host}" | awk '{print $1}' | sort -u | paste -sd',' - || true)"

  if [[ -z "${resolved}" ]]; then
    die "DNS for ${host} is not ready. Create A records for ${WEB_HOST}, ${API_HOST}, ${LIVEKIT_HOST}, and ${MEDIA_HOST}, then rerun install.sh."
  fi

  if [[ -n "${PUBLIC_IP}" && ",${resolved}," != *",${PUBLIC_IP},"* ]]; then
    warn "DNS for ${host} resolves to ${resolved}, while the detected public IP is ${PUBLIC_IP}."
    continue_anyway="$(read_from_tty "Continue anyway? [y/N]: ")"
    [[ "${continue_anyway}" =~ ^[Yy]$ ]] || die "DNS validation aborted."
  fi
}

check_dns() {
  fetch_public_ip
  print_dns_requirements
  confirm_dns_or_exit "${WEB_HOST}"
  confirm_dns_or_exit "${API_HOST}"
  confirm_dns_or_exit "${LIVEKIT_HOST}"
  confirm_dns_or_exit "${MEDIA_HOST}"
}

configure_firewall() {
  if ! command_exists ufw; then
    warn "ufw is not available, skipping host firewall configuration."
    return
  fi

  log "Ensuring firewall rules exist for SSH, HTTP(S), and LiveKit..."
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow 7881/tcp >/dev/null 2>&1 || true
  ufw allow 7882/udp >/dev/null 2>&1 || true

  if ufw status | grep -qi "^Status: active$"; then
    log "ufw is already active."
    return
  fi

  warn "ufw is not active. Rules were added, including OpenSSH and 22/tcp to keep SSH reachable."
  warn "If this server also has a cloud firewall, make sure the same ports are open there."
  if prompt_yes_no "Enable ufw now?" "N"; then
    ufw --force enable >/dev/null
    log "ufw enabled."
  else
    warn "ufw left disabled. Enable it later with: ufw enable"
  fi
}

prepare_runtime_directories() {
  mkdir -p "${REPO_DIR}/backups" "${REPO_DIR}/infrastructure/backup/hooks" "${REPO_DIR}/.install"
}

write_env_file() {
  local env_file="${REPO_DIR}/.env"

  EXISTING_JWT_SECRET="$(load_existing_env_value "${env_file}" "JWT_SECRET" || true)"
  EXISTING_POSTGRES_PASSWORD="$(load_existing_env_value "${env_file}" "POSTGRES_PASSWORD" || true)"
  EXISTING_S3_ACCESS_KEY="$(load_existing_env_value "${env_file}" "S3_ACCESS_KEY" || true)"
  EXISTING_S3_SECRET_KEY="$(load_existing_env_value "${env_file}" "S3_SECRET_KEY" || true)"
  EXISTING_LIVEKIT_API_SECRET="$(load_existing_env_value "${env_file}" "LIVEKIT_API_SECRET" || true)"
  EXISTING_ADMIN_LOGIN="$(load_existing_env_value "${env_file}" "ADMIN_PANEL_LOGIN" || true)"
  EXISTING_ADMIN_PASSWORD="$(load_existing_env_value "${env_file}" "ADMIN_PANEL_PASSWORD" || true)"
  EXISTING_ADMIN_EMAIL="$(load_existing_env_value "${env_file}" "ADMIN_PANEL_EMAIL" || true)"

  JWT_SECRET="${EXISTING_JWT_SECRET:-$(generate_hex 32)}"
  POSTGRES_PASSWORD="${EXISTING_POSTGRES_PASSWORD:-$(generate_password)}"
  S3_ACCESS_KEY="${EXISTING_S3_ACCESS_KEY:-$(generate_hex 10)}"
  S3_SECRET_KEY="${EXISTING_S3_SECRET_KEY:-$(generate_password)}"
  LIVEKIT_API_SECRET="${EXISTING_LIVEKIT_API_SECRET:-$(generate_hex 32)}"
  ADMIN_PANEL_LOGIN="${EXISTING_ADMIN_LOGIN:-$(generate_admin_login)}"
  ADMIN_PANEL_PASSWORD="${EXISTING_ADMIN_PASSWORD:-$(generate_password)}"
  ADMIN_PANEL_EMAIL="${EXISTING_ADMIN_EMAIL:-adminpanel@${DOMAIN}}"

  cat >"${env_file}" <<EOF
# Managed by install.sh (${SCRIPT_VERSION})
INSTALL_DOMAIN=${DOMAIN}
SORI_SERVER_NAME=${SERVER_NAME}

PUBLIC_WEB_URL=https://${WEB_HOST}
PUBLIC_API_URL=https://${API_HOST}
PUBLIC_WS_URL=wss://${API_HOST}
PUBLIC_LIVEKIT_URL=wss://${LIVEKIT_HOST}
PUBLIC_MEDIA_URL=https://${MEDIA_HOST}
PUBLIC_DEFAULT_COMMUNITY_ID=default-community

VITE_API_URL=https://${API_HOST}
VITE_WS_URL=wss://${API_HOST}
VITE_LIVEKIT_URL=wss://${LIVEKIT_HOST}
VITE_MAX_UPLOAD_SIZE_MB=25

SORI_WEB_HOST=${WEB_HOST}
SORI_API_HOST=${API_HOST}
SORI_LIVEKIT_HOST=${LIVEKIT_HOST}
SORI_MEDIA_HOST=${MEDIA_HOST}
SORI_GATEWAY_CADDYFILE=./infrastructure/caddy/Caddyfile.production
SORI_LIVEKIT_CONFIG=./infrastructure/livekit.production.yaml
CADDY_ACME_EMAIL=${ACME_EMAIL}
ALLOWED_ORIGINS=https://${WEB_HOST}

PORT=3000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
MAX_UPLOAD_SIZE_MB=25
LOG_RETENTION_DAYS=7

POSTGRES_USER=sori
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=sori
POSTGRES_PORT=5432
POSTGRES_BIND_ADDRESS=127.0.0.1
DATABASE_URL=postgres://sori:${POSTGRES_PASSWORD}@postgres:5432/sori

VALKEY_URL=redis://valkey:6379
VALKEY_PORT=6379
VALKEY_BIND_ADDRESS=127.0.0.1

S3_ENDPOINT=http://sori-media:9000
S3_PUBLIC_URL=https://${MEDIA_HOST}
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}
S3_BUCKET=sori-media
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_BIND_ADDRESS=127.0.0.1

LIVEKIT_URL=http://sori-livekit:7880
LIVEKIT_API_KEY=sori-livekit
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
LIVEKIT_TCP_PORT=7881
LIVEKIT_UDP_PORT=7882
LIVEKIT_BIND_ADDRESS=0.0.0.0

ADMIN_PANEL_LOGIN=${ADMIN_PANEL_LOGIN}
ADMIN_PANEL_PASSWORD=${ADMIN_PANEL_PASSWORD}
ADMIN_PANEL_EMAIL=${ADMIN_PANEL_EMAIL}
EOF

  chmod 600 "${env_file}"
}

write_install_summary() {
  local summary_file="${REPO_DIR}/.install/admin-credentials.txt"
  cat >"${summary_file}" <<EOF
SORI installation completed on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
URL: https://${WEB_HOST}
Admin: https://${WEB_HOST}/admin
Client server address: https://${WEB_HOST}
Client bootstrap: https://${WEB_HOST}/.well-known/sori/client.json
Admin login: ${ADMIN_PANEL_LOGIN}
Admin password: ${ADMIN_PANEL_PASSWORD}
Admin email: ${ADMIN_PANEL_EMAIL}
EOF
  chmod 600 "${summary_file}"
}

compose() {
  docker compose --env-file "${REPO_DIR}/.env" "${COMPOSE_FILES[@]}" "$@"
}

compose_with_timeout() {
  local seconds="$1"
  shift
  timeout "${seconds}" docker compose --env-file "${REPO_DIR}/.env" "${COMPOSE_FILES[@]}" "$@"
}

wait_for_postgres() {
  log "Waiting for PostgreSQL..."
  local attempt
  for attempt in $(seq 1 60); do
    if compose exec -T postgres pg_isready -U sori -d sori >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  die "PostgreSQL did not become ready in time."
}

validate_gateway_config() {
  log "Validating production Caddy config..."
  compose run --rm sori-gateway caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
}

deploy_stack() {
  log "Starting infrastructure services..."
  compose up -d postgres valkey sori-media sori-livekit
  wait_for_postgres

  log "Running database migrations..."
  compose run --rm sori-db-migrate

  log "Bootstrapping hidden adminpanel user and server metadata..."
  compose_with_timeout 180s run --rm sori-install-bootstrap

  validate_gateway_config

  log "Building and starting Sori services..."
  compose up -d --build sori-backend sori-web sori-gateway postgres-backup
}

wait_for_health() {
  log "Waiting for backend health endpoint..."
  local attempt health_url
  health_url="https://${API_HOST}/health"
  for attempt in $(seq 1 90); do
    if curl -fsS "${health_url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 4
  done
  die "Health check failed for ${health_url}"
}

validate_client_bootstrap() {
  log "Validating client bootstrap discovery endpoint..."
  local bootstrap_url payload
  bootstrap_url="https://${WEB_HOST}/.well-known/sori/client.json"

  payload="$(curl -fsS "${bootstrap_url}")" || die "Client bootstrap check failed for ${bootstrap_url}"

  printf '%s' "${payload}" | jq -e '
    (.version | type == "number")
    and ([
      .server.installMode,
      .server.defaultCommunityId,
      .endpoints.web,
      .endpoints.api,
      .endpoints.ws,
      .endpoints.livekit,
      .endpoints.media,
      .endpoints.health,
      .auth.mode,
      .auth.loginPath,
      .realtime.socketPath
    ] | all(type == "string" and length > 0))
  ' >/dev/null || die "Client bootstrap payload is missing required fields at ${bootstrap_url}"
}

print_summary() {
  local services_status
  services_status="$(compose ps --format json 2>/dev/null || true)"

  printf '\n'
  printf '✅ SORI installed successfully\n'
  printf '🌐 URL: https://%s\n' "${WEB_HOST}"
  printf '⚙️  Admin: https://%s/admin\n' "${WEB_HOST}"
  printf '🖥️  Client server address: https://%s\n' "${WEB_HOST}"
  printf '🧭 Client bootstrap: https://%s/.well-known/sori/client.json\n' "${WEB_HOST}"
  printf '🔐 Login: %s\n' "${ADMIN_PANEL_LOGIN}"
  printf '🔐 Password: %s\n' "${ADMIN_PANEL_PASSWORD}"
  printf '📄 Credentials file: %s\n' "${REPO_DIR}/.install/admin-credentials.txt"
  printf '\n'
  printf '📦 Service status\n'
  if [[ -n "${services_status}" ]]; then
    printf '%s\n' "${services_status}"
  else
    compose ps
  fi
}

main() {
  parse_args "$@"
  require_root
  ensure_supported_os
  install_system_dependencies
  resolve_repo_dir
  collect_install_inputs
  check_dns
  configure_firewall
  prepare_runtime_directories
  write_env_file

  cd "${REPO_DIR}"
  deploy_stack
  wait_for_health
  validate_client_bootstrap
  write_install_summary
  print_summary
}

main "$@"
