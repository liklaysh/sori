#!/usr/bin/env bash
set -Eeuo pipefail

DEFAULT_INSTALL_DIR="/opt/sori"
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.production.yml)

log() {
  printf '[INFO] %s\n' "$*"
}

die() {
  printf '[ERROR] %s\n' "$*" >&2
  exit 1
}

trap 'die "Update failed near line ${LINENO}."' ERR

require_root() {
  [[ "${EUID}" -eq 0 ]] || die "Run update.sh as root."
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

update_git_checkout() {
  [[ -d "${REPO_DIR}/.git" ]] || die "Git repository not found at ${REPO_DIR}"
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
  compose up -d postgres valkey sori-media sori-livekit
  wait_for_postgres
  compose run --rm sori-db-migrate
  compose run --rm sori-install-bootstrap >/dev/null
  compose up -d --build sori-backend sori-web sori-gateway postgres-backup
}

health_check() {
  local api_url
  api_url="$(awk -F= '$1 == "PUBLIC_API_URL" {print $2}' "${REPO_DIR}/.env" | tail -n1)"
  [[ -n "${api_url}" ]] || die "PUBLIC_API_URL is missing in ${REPO_DIR}/.env"

  local attempt
  for attempt in $(seq 1 60); do
    if curl -fsS "${api_url}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
  done
  die "Backend health check failed after update."
}

main() {
  require_root
  parse_args "$@"
  update_git_checkout
  run_update
  health_check
  compose ps
}

main "$@"
