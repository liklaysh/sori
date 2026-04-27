#!/usr/bin/env bash
set -Eeuo pipefail

DEFAULT_INSTALL_DIR="/opt/sori"
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
  local exit_code="${3:-1}"

  if [[ "${exit_code}" == "130" || "${exit_code}" == "143" ]]; then
    warn "Update interrupted by user."
    exit "${exit_code}"
  fi

  die "Update failed near line ${line} (exit ${exit_code}): ${command}"
}

on_interrupt() {
  warn "Update interrupted by user."
  exit 130
}

trap 'on_error $LINENO "$BASH_COMMAND" "$?"' ERR
trap 'on_interrupt' INT TERM

require_root() {
  [[ "${EUID}" -eq 0 ]] || die "Run update.sh as root."
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

parse_args() {
  REPO_DIR="${SORI_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
  GIT_REF="${SORI_GIT_REF:-}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --install-dir)
        REPO_DIR="$2"
        shift 2
        ;;
      --ref)
        GIT_REF="$2"
        shift 2
        ;;
      --help|-h)
        cat <<'EOF'
Usage: bash update.sh [options]

Options:
  --install-dir <path>  Existing Sori install directory (default: /opt/sori)
  --ref <ref>           Git ref or release tag to deploy
EOF
        exit 0
        ;;
      *)
        die "Unknown argument: $1"
        ;;
    esac
  done
}

compose() {
  docker compose --env-file "${REPO_DIR}/.env" "${COMPOSE_FILES[@]}" "$@"
}

compose_with_timeout() {
  local seconds="$1"
  shift
  timeout "${seconds}" docker compose --env-file "${REPO_DIR}/.env" "${COMPOSE_FILES[@]}" "$@"
}

update_git_checkout() {
  [[ -d "${REPO_DIR}/.git" ]] || die "Git repository not found at ${REPO_DIR}"
  [[ -f "${REPO_DIR}/.env" ]] || die "Sori .env not found at ${REPO_DIR}/.env"
  cd "${REPO_DIR}"
  git fetch --tags --prune origin

  if [[ -n "${GIT_REF}" ]]; then
    log "Checking out ${GIT_REF}..."
    git checkout "${GIT_REF}"
    if git show-ref --verify --quiet "refs/remotes/origin/${GIT_REF}"; then
      git reset --hard "origin/${GIT_REF}"
    fi
    return 0
  fi

  local current_branch
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "${current_branch}" == "HEAD" ]]; then
    die "Install checkout is detached. Run update.sh --ref <branch-or-tag>."
  fi

  log "Updating current branch ${current_branch}..."
  git pull --ff-only origin "${current_branch}"
}

wait_for_postgres() {
  local attempt
  for attempt in $(seq 1 60); do
    if compose exec -T postgres pg_isready -U sori -d sori >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  die "PostgreSQL did not become ready in time."
}

run_update() {
  log "Starting infrastructure services..."
  compose up -d postgres valkey sori-media sori-livekit
  log "Waiting for PostgreSQL..."
  wait_for_postgres

  log "Running database migrations..."
  compose run --rm --build sori-db-migrate

  log "Reapplying install bootstrap..."
  compose_with_timeout 180s run --rm --build sori-install-bootstrap

  log "Building and restarting Sori services..."
  compose up -d --build sori-backend sori-web sori-gateway postgres-backup
}

env_value() {
  local key="$1"
  awk -F= -v k="${key}" '$1 == k {print substr($0, index($0, "=") + 1)}' "${REPO_DIR}/.env" | tail -n1
}

health_check() {
  local api_url
  api_url="$(env_value "PUBLIC_API_URL")"
  [[ -n "${api_url}" ]] || die "PUBLIC_API_URL is missing in ${REPO_DIR}/.env"

  log "Waiting for backend health endpoint..."
  local attempt
  for attempt in $(seq 1 60); do
    if curl -fsS "${api_url}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
  done
  die "Backend health check failed after update."
}

validate_client_bootstrap() {
  local web_url bootstrap_url payload
  web_url="$(env_value "PUBLIC_WEB_URL")"
  [[ -n "${web_url}" ]] || die "PUBLIC_WEB_URL is missing in ${REPO_DIR}/.env"

  bootstrap_url="${web_url}/.well-known/sori/client.json"
  log "Validating client bootstrap discovery endpoint..."

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
  local services_status web_url admin_login
  services_status="$(compose ps --format json 2>/dev/null || true)"
  web_url="$(env_value "PUBLIC_WEB_URL")"
  admin_login="$(env_value "ADMIN_PANEL_LOGIN")"

  printf '\n'
  printf '📦 Service status\n'
  if [[ -n "${services_status}" ]] && command_exists jq; then
    printf '%-24s %s\n' "SERVICE" "STATE"
    printf '%s\n' "${services_status}" | jq -r '
      if type == "array" then .[] else . end
      | [.Service, .State]
      | @tsv
    ' | awk -F '\t' '{ printf "%-24s %s\n", $1, $2 }'
  else
    compose ps
  fi

  printf '\n'
  printf '========================================\n'
  printf '✅ SORI updated successfully\n'
  printf '========================================\n'
  printf '🌐 URL: %s\n' "${web_url}"
  printf '⚙️  Admin: %s/admin\n' "${web_url}"
  printf '🖥️  Client server address: %s\n' "${web_url}"
  printf '🧭 Client bootstrap: %s/.well-known/sori/client.json\n' "${web_url}"
  if [[ -n "${admin_login}" ]]; then
    printf '🔐 Admin login: %s\n' "${admin_login}"
  fi
  printf '📄 Credentials file: %s\n' "${REPO_DIR}/.install/admin-credentials.txt"
  printf '========================================\n'
}

main() {
  parse_args "$@"
  require_root
  update_git_checkout
  run_update
  health_check
  validate_client_bootstrap
  print_summary
}

main "$@"
