#!/usr/bin/env bash
# API heartbeat: probes the live Supabase API the way the app uses it and
# appends one CSV row per check to the file given as $1.
#
# Checks, in order:
#   auth            sign in as the heartbeat user        -> 200 + access_token
#   rest_exercises  read the global exercise library      -> 200 + at least MIN_EXERCISES rows
#                   as that user (gateway, PostgREST, RLS, Postgres)
#
# The exercises read policy is `to authenticated`, so an anonymous request
# returns 200 with an empty list. That is why the probe signs in first.
#
# Required env: SUPABASE_URL, SUPABASE_KEY (publishable key),
#               HEARTBEAT_EMAIL, HEARTBEAT_PASSWORD
# Optional env: MIN_EXERCISES (default 15), REQUEST_TIMEOUT seconds (default 15)
# Exit code:    0 if every check passed, 1 otherwise.
set -uo pipefail

out="${1:?usage: heartbeat.sh <output.csv>}"
: "${SUPABASE_URL:?SUPABASE_URL is not set}"
: "${SUPABASE_KEY:?SUPABASE_KEY is not set}"
: "${HEARTBEAT_EMAIL:?HEARTBEAT_EMAIL is not set}"
: "${HEARTBEAT_PASSWORD:?HEARTBEAT_PASSWORD is not set}"

base="${SUPABASE_URL%/}"
min_exercises="${MIN_EXERCISES:-15}"
timeout="${REQUEST_TIMEOUT:-15}"
run_id="${GITHUB_RUN_ID:-local}"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
body="$(mktemp)"
trap 'rm -f "$body"' EXIT
failed=0
status=000
latency_ms=0

[ -s "$out" ] || echo 'timestamp_utc,run_id,check,http_status,latency_ms,ok,detail' > "$out"

# record <check> <http_status> <latency_ms> <ok> <detail>
record() {
  local detail="${5//,/;}"
  printf '%s,%s,%s,%s,%s,%s,%s\n' "$ts" "$run_id" "$1" "$2" "$3" "$4" "$detail" >> "$out"
  [ "$4" = true ] || failed=1
}

# request <curl args...>: sets $status and $latency_ms; response body goes to $body.
# A network error or timeout is recorded as HTTP status 000.
request() {
  local w
  w="$(curl -sS -o "$body" -w '%{http_code} %{time_total}' --max-time "$timeout" "$@" 2>/dev/null)" || true
  status="${w%% *}"
  [ -n "$status" ] || status=000
  latency_ms="$(awk -v t="${w##* }" 'BEGIN { printf "%d", t * 1000 + 0.5 }')"
}

# 1. Sign in. The payload goes through stdin so the password is not in the process list.
token=""
payload="$(jq -n '{email: env.HEARTBEAT_EMAIL, password: env.HEARTBEAT_PASSWORD}')"
request -X POST "$base/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_KEY" -H 'Content-Type: application/json' --data-binary @- <<< "$payload"
if [ "$status" = 200 ]; then
  token="$(jq -r '.access_token // empty' "$body" 2>/dev/null)"
fi
if [ -n "$token" ]; then
  [ -z "${GITHUB_ACTIONS:-}" ] || echo "::add-mask::$token"
  record auth "$status" "$latency_ms" true ""
else
  err="$(jq -r '.error_description // .msg // .error_code // .error // empty' "$body" 2>/dev/null | head -c 120)"
  record auth "$status" "$latency_ms" false "${err:-no access_token}"
fi

# 2. Read the exercise library as the signed-in user.
if [ -z "$token" ]; then
  record rest_exercises "" "" false "skipped: auth failed"
else
  request "$base/rest/v1/exercises?select=id" \
    -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $token"
  rows="$(jq 'if type == "array" then length else -1 end' "$body" 2>/dev/null)"
  rows="${rows:--1}"
  if [ "$status" = 200 ] && [ "$rows" -ge "$min_exercises" ]; then
    record rest_exercises "$status" "$latency_ms" true "rows=$rows"
  else
    record rest_exercises "$status" "$latency_ms" false "rows=$rows"
  fi
fi

exit "$failed"
