#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${SORI_INSTALL_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.production.yml)

if [[ ! -f "${REPO_DIR}/docker-compose.production.yml" ]]; then
  COMPOSE_FILES=(-f docker-compose.yml)
fi

if [[ ! -f "${REPO_DIR}/.env" ]]; then
  printf '[FAIL] .env not found at %s\n' "${REPO_DIR}/.env" >&2
  exit 1
fi

cd "${REPO_DIR}"

pass_count=0
warn_count=0
fail_count=0

env_value() {
  local key="$1"
  awk -F= -v k="${key}" '$1 == k {print substr($0, index($0, "=") + 1)}' "${REPO_DIR}/.env" | tail -n1
}

compose() {
  docker compose --env-file "${REPO_DIR}/.env" "${COMPOSE_FILES[@]}" "$@"
}

print_result() {
  local level="$1"
  local message="$2"

  case "${level}" in
    PASS)
      pass_count=$((pass_count + 1))
      printf '✅ %-8s %s\n' "${level}" "${message}"
      ;;
    WARN)
      warn_count=$((warn_count + 1))
      printf '⚠️  %-8s %s\n' "${level}" "${message}"
      ;;
    FAIL)
      fail_count=$((fail_count + 1))
      printf '❌ %-8s %s\n' "${level}" "${message}"
      ;;
  esac
}

check_command() {
  local command_name="$1"
  if command -v "${command_name}" >/dev/null 2>&1; then
    print_result PASS "${command_name} is installed"
  else
    print_result FAIL "${command_name} is missing"
  fi
}

check_url() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"
  local status

  if [[ -z "${url}" ]]; then
    print_result FAIL "${label}: URL is empty"
    return
  fi

  status="$(curl -k -sS -o /dev/null -w '%{http_code}' "${url}" 2>/dev/null || true)"
  if [[ "${status}" == "${expected}" ]]; then
    print_result PASS "${label}: ${url} (${status})"
  else
    print_result FAIL "${label}: ${url} expected ${expected}, got ${status:-curl failed}"
  fi
}

check_json_url() {
  local label="$1"
  local url="$2"
  local filter="$3"
  local payload

  if ! command -v jq >/dev/null 2>&1; then
    print_result WARN "${label}: jq missing, JSON validation skipped"
    return
  fi

  payload="$(curl -k -fsS "${url}" 2>/dev/null || true)"
  if [[ -z "${payload}" ]]; then
    print_result FAIL "${label}: request failed"
    return
  fi

  if printf '%s' "${payload}" | jq -e "${filter}" >/dev/null; then
    print_result PASS "${label}: valid"
  else
    print_result FAIL "${label}: invalid payload"
  fi
}

check_compose_services() {
  local services=(postgres valkey sori-media sori-livekit sori-backend sori-web sori-gateway)
  local service
  local state

  for service in "${services[@]}"; do
    state="$(compose ps --format json "${service}" 2>/dev/null | jq -r 'if type == "array" then .[0].State else .State end // empty' 2>/dev/null || true)"
    if [[ "${state}" == "running" ]]; then
      print_result PASS "${service} is running"
    elif [[ -n "${state}" ]]; then
      print_result FAIL "${service} state is ${state}"
    else
      print_result WARN "${service} is not present in current compose status"
    fi
  done
}

check_database_schema() {
  local db_user db_name missing
  db_user="$(env_value POSTGRES_USER)"
  db_name="$(env_value POSTGRES_DB)"

  missing="$(compose exec -T postgres psql -U "${db_user}" -d "${db_name}" -Atc "
    select string_agg(expected.column_name, ',')
    from (
      values
        ('min_bitrate'),
        ('max_packet_loss'),
        ('max_jitter_ms'),
        ('max_rtt_ms'),
        ('avg_connection_quality'),
        ('excellent_samples'),
        ('good_samples'),
        ('poor_samples'),
        ('lost_samples')
    ) as expected(column_name)
    left join information_schema.columns actual
      on actual.table_schema = 'public'
     and actual.table_name = 'calls'
     and actual.column_name = expected.column_name
    where actual.column_name is null;
  " 2>/dev/null || true)"

  if [[ -z "${missing}" ]]; then
    print_result PASS "calls telemetry schema is current"
  else
    print_result FAIL "calls telemetry schema missing columns: ${missing}"
  fi
}

printf '\nSORI Doctor\n'
printf 'Repository: %s\n\n' "${REPO_DIR}"

check_command docker
check_command curl
check_command jq

if docker compose version >/dev/null 2>&1; then
  print_result PASS "docker compose is available"
else
  print_result FAIL "docker compose is not available"
fi

if compose config >/dev/null 2>&1; then
  print_result PASS "compose config is valid"
else
  print_result FAIL "compose config is invalid"
fi

check_compose_services
check_database_schema

api_url="$(env_value PUBLIC_API_URL)"
web_url="$(env_value PUBLIC_WEB_URL)"
check_url "Backend health" "${api_url%/}/health" 200
check_json_url "Client bootstrap" "${web_url%/}/.well-known/sori/client.json" '(.endpoints.api | type == "string") and (.endpoints.livekit | type == "string")'
check_json_url "System version" "${api_url%/}/api/system/version" '(.version | type == "string") and (.apiVersion == "v1")'

printf '\nSummary: %s pass, %s warn, %s fail\n' "${pass_count}" "${warn_count}" "${fail_count}"

if [[ "${fail_count}" -gt 0 ]]; then
  exit 1
fi
