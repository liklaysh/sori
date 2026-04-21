#!/usr/bin/env bash

set -euo pipefail

WEB_HOST="${SORI_WEB_HOST:-sori-web.sori.orb.local}"
API_HOST="${SORI_API_HOST:-sori-backend.sori.orb.local}"
LIVEKIT_HOST="${SORI_LIVEKIT_HOST:-sori-livekit.sori.orb.local}"
MEDIA_HOST="${SORI_MEDIA_HOST:-sori-media.sori.orb.local}"
LOCAL_IP="${SORI_LOCAL_IP:-127.0.0.1}"

pass() {
  printf 'PASS  %s\n' "$1"
}

fail() {
  printf 'FAIL  %s\n' "$1" >&2
  exit 1
}

check_status() {
  local description="$1"
  local expected="$2"
  local scheme="$3"
  local host="$4"
  local path="$5"

  local status
  status="$(curl -k -sS --resolve "$host:443:$LOCAL_IP" -o /dev/null -w '%{http_code}' "$scheme://$host$path")"

  if [[ "$status" == "$expected" ]]; then
    pass "$description ($status)"
  else
    fail "$description expected $expected, got $status"
  fi
}

check_redirect() {
  local description="$1"
  local host="$2"
  local path="$3"
  local expected_location="$4"

  local headers
  headers="$(curl -sSI --resolve "$host:80:$LOCAL_IP" "http://$host$path")"

  grep -qE '^HTTP/.* 30[18]' <<<"$headers" || fail "$description missing HTTP->HTTPS redirect"
  grep -q "Location: $expected_location" <<<"$headers" || fail "$description unexpected redirect location"
  pass "$description"
}

check_socketio() {
  local host="$1"
  local body

  body="$(curl -k -sS --resolve "$host:443:$LOCAL_IP" "https://$host/socket.io/?EIO=4&transport=polling")"
  grep -q '"sid"' <<<"$body" || fail "Socket.io polling handshake missing sid"
  pass "Socket.io polling handshake"
}

check_not_404() {
  local description="$1"
  local scheme="$2"
  local host="$3"
  local path="$4"
  local status

  status="$(curl -k -sS --resolve "$host:443:$LOCAL_IP" -o /dev/null -w '%{http_code}' "$scheme://$host$path")"
  if [[ "$status" == "404" ]]; then
    fail "$description returned 404"
  fi
  pass "$description ($status)"
}

check_redirect "Web host redirects HTTP to HTTPS" "$WEB_HOST" "/" "https://$WEB_HOST/"
check_redirect "API host redirects HTTP to HTTPS" "$API_HOST" "/health" "https://$API_HOST/health"

check_status "Frontend root is reachable" "200" "https" "$WEB_HOST" "/"
check_status "Frontend /admin route is reachable" "200" "https" "$WEB_HOST" "/admin"
check_status "Backend /health is reachable" "200" "https" "$API_HOST" "/health"
check_socketio "$API_HOST"
check_status "LiveKit host is reachable" "200" "https" "$LIVEKIT_HOST" "/"
check_status "MinIO health endpoint is reachable through Caddy" "200" "https" "$MEDIA_HOST" "/minio/health/live"

printf '\nValidation completed successfully.\n'
