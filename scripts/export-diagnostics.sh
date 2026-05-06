#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${SORI_INSTALL_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
OUTPUT_DIR="${SORI_DIAGNOSTICS_DIR:-${REPO_DIR}/diagnostics}"
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.production.yml)
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
WORK_DIR="${OUTPUT_DIR}/sori-diagnostics-${TIMESTAMP}"

if [[ ! -f "${REPO_DIR}/docker-compose.production.yml" ]]; then
  COMPOSE_FILES=(-f docker-compose.yml)
fi

if [[ ! -f "${REPO_DIR}/.env" ]]; then
  printf '[ERROR] .env not found at %s\n' "${REPO_DIR}/.env" >&2
  exit 1
fi

mkdir -p "${WORK_DIR}"
cd "${REPO_DIR}"

env_value() {
  local key="$1"
  awk -F= -v k="${key}" '$1 == k {print substr($0, index($0, "=") + 1)}' "${REPO_DIR}/.env" | tail -n1
}

compose() {
  docker compose --env-file "${REPO_DIR}/.env" "${COMPOSE_FILES[@]}" "$@"
}

capture() {
  local name="$1"
  shift
  {
    printf '$ %s\n\n' "$*"
    "$@"
  } >"${WORK_DIR}/${name}" 2>&1 || true
}

redact_env() {
  sed -E '
    s/^(([^#=]*)(PASSWORD|SECRET|TOKEN|KEY|PRIVATE|COOKIE|JWT)[^=]*=).*/\1[REDACTED]/I;
    s#(postgres://[^:]+:)[^@]+@#\1[REDACTED]@#g;
  ' "${REPO_DIR}/.env" >"${WORK_DIR}/env.redacted"
}

curl_json() {
  local url="$1"
  local target="$2"
  if command -v jq >/dev/null 2>&1; then
    curl -k -fsS "${url}" | jq '.' >"${target}" 2>"${target}.error" || true
  else
    curl -k -fsS "${url}" >"${target}" 2>"${target}.error" || true
  fi
}

capture_admin_calls() {
  local api_url admin_login admin_pass cookie_jar
  api_url="$(env_value PUBLIC_API_URL)"
  admin_login="$(env_value ADMIN_PANEL_LOGIN)"
  admin_pass="$(env_value ADMIN_PANEL_PASSWORD)"

  if [[ -z "${api_url}" || -z "${admin_login}" || -z "${admin_pass}" ]]; then
    printf 'Admin telemetry export skipped: admin credentials or PUBLIC_API_URL are missing.\n' >"${WORK_DIR}/admin-calls.skipped.txt"
    return
  fi

  cookie_jar="$(mktemp)"
  if curl -k -fsS -c "${cookie_jar}" \
    -H 'Content-Type: application/json' \
    -H "Origin: ${web_url:-${api_url}}" \
    -d "{\"email\":\"${admin_login}\",\"password\":\"${admin_pass}\"}" \
    "${api_url%/}/auth/login" >/dev/null 2>"${WORK_DIR}/admin-login.error"; then
    curl -k -fsS -b "${cookie_jar}" "${api_url%/}/admin/calls" \
      | jq '.' >"${WORK_DIR}/admin-calls.json" 2>"${WORK_DIR}/admin-calls.error" || true
    curl -k -fsS -b "${cookie_jar}" "${api_url%/}/admin/diagnostics" \
      | jq '.' >"${WORK_DIR}/admin-diagnostics.json" 2>"${WORK_DIR}/admin-diagnostics.error" || true
  fi
  rm -f "${cookie_jar}"
}

api_url="$(env_value PUBLIC_API_URL)"
web_url="$(env_value PUBLIC_WEB_URL)"
db_user="$(env_value POSTGRES_USER)"
db_name="$(env_value POSTGRES_DB)"

printf 'SORI diagnostics export\nGenerated at: %s\nRepository: %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "${REPO_DIR}" >"${WORK_DIR}/README.txt"
redact_env

capture system.txt uname -a
capture disk.txt df -h
capture memory.txt sh -c 'free -m 2>/dev/null || vm_stat 2>/dev/null || true'
capture git.txt git status --short
capture git-head.txt git log -1 --oneline
capture docker-version.txt docker version
capture docker-compose-version.txt docker compose version
capture compose-ps.json compose ps --format json
capture compose-config.redacted.yml sh -c "docker compose --env-file '${REPO_DIR}/.env' ${COMPOSE_FILES[*]} config | sed -E 's/(PASSWORD|SECRET|TOKEN|KEY|JWT)(: |:).*$/\\1: [REDACTED]/I'"

capture backend-logs.txt compose logs --tail=300 sori-backend
capture gateway-logs.txt compose logs --tail=300 sori-gateway
capture livekit-logs.txt compose logs --tail=200 sori-livekit
capture web-logs.txt compose logs --tail=120 sori-web

if [[ -n "${api_url}" ]]; then
  curl_json "${api_url%/}/health" "${WORK_DIR}/health.json"
  curl_json "${api_url%/}/api/system/version" "${WORK_DIR}/version.json"
fi

if [[ -n "${web_url}" ]]; then
  curl_json "${web_url%/}/.well-known/sori/client.json" "${WORK_DIR}/client-bootstrap.json"
fi

if [[ -n "${db_user}" && -n "${db_name}" ]]; then
  capture db-migrations.tsv compose exec -T postgres psql -U "${db_user}" -d "${db_name}" -Atc "select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc;"
  capture db-telemetry-columns.tsv compose exec -T postgres psql -U "${db_user}" -d "${db_name}" -Atc "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='calls' order by ordinal_position;"
fi

if [[ -x "${REPO_DIR}/scripts/doctor.sh" ]]; then
  capture doctor.txt "${REPO_DIR}/scripts/doctor.sh"
fi

capture_admin_calls

archive="${OUTPUT_DIR}/sori-diagnostics-${TIMESTAMP}.tar.gz"
tar -C "${OUTPUT_DIR}" -czf "${archive}" "sori-diagnostics-${TIMESTAMP}"
rm -rf "${WORK_DIR}"

printf 'Diagnostics archive created:\n%s\n' "${archive}"
