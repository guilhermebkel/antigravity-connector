#!/usr/bin/env bash
# Image smoke test for issue #19 (AC1, AC2, AC4, AC5). CI cannot log in to Google, so the containers run the fake agy
# from the repository, mounted read-only: the no-session case runs the fake that always answers "not logged in".
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# SMOKE_IMAGE skips the build and tests an image that is already built (for example behind a TLS proxy).
IMAGE="${SMOKE_IMAGE:-antigravity-connector:smoke}"
CONTAINER="antigravity-connector-smoke"
PORT="18787"
TESTING_DIR="${ROOT}/packages/agy/src/Testing"
WORK="$(mktemp -d)"
HEALTH_ATTEMPTS=60
HEALTH_INTERVAL_SECONDS=1

fail() {
  echo "image-smoke: FAIL: $*" >&2
  exit 1
}

cleanup() {
  docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
  rm -rf "${WORK}"
}
trap cleanup EXIT

wait_for_health() {
  for _ in $(seq "${HEALTH_ATTEMPTS}"); do
    if [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/health")" == "200" ]]; then
      return 0
    fi
    sleep "${HEALTH_INTERVAL_SECONDS}"
  done
  docker logs "${CONTAINER}" >&2 || true
  fail "the container did not answer /health with 200"
}

start_container() {
  local agy_binary="$1"
  docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
  printf 'API_KEY=smoke-test-api-key-0123456789abcdef\nAGY_BIN=%s\n' "${agy_binary}" > "${WORK}/run.env"
  docker run -d --name "${CONTAINER}" --env-file "${WORK}/run.env" \
    -v "${TESTING_DIR}:/opt/fake-agy:ro" -p "127.0.0.1:${PORT}:8787" "${IMAGE}" >/dev/null
}

if [[ -z "${SMOKE_IMAGE:-}" ]]; then
  docker build -q -f "${ROOT}/apps/server/Dockerfile" -t "${IMAGE}" "${ROOT}" >/dev/null
fi

# AC5: a missing API_KEY stops the container at startup, with a message that names it.
printf 'HOST=0.0.0.0\n' > "${WORK}/no-key.env"
set +e
output="$(docker run --rm --env-file "${WORK}/no-key.env" "${IMAGE}" 2>&1)"
code=$?
set -e
[[ ${code} -ne 0 ]] || fail "AC5: the container started without API_KEY"
[[ "${output}" == *API_KEY* ]] || fail "AC5: the startup message does not name API_KEY"
echo "AC5 ok: missing API_KEY stops the container and is named"

# AC1 and AC4: /health answers 200 and the process runs as a non-root user, with no .env and no login token in the image.
start_container /opt/fake-agy/FakeAgy.mjs
wait_for_health
[[ "$(curl -s "http://127.0.0.1:${PORT}/health")" == '{"status":"ok","agy":"connected"}' ]] \
  || fail "AC1: /health does not report agy connected"
echo "AC1 ok: /health returns 200"
[[ "$(docker exec "${CONTAINER}" id -u)" != "0" ]] || fail "AC4: the process runs as root"
docker exec "${CONTAINER}" sh -c 'test ! -e /app/.env && test ! -e /home/agy/.gemini/antigravity-cli/antigravity-oauth-token' \
  || fail "AC4: the image contains a .env file or a token file"
echo "AC4 ok: non-root user, no .env and no token file"
# AC6 of #23: Chrome runs for the runtime user, and the call log directory is writable by it (#28).
docker exec "${CONTAINER}" google-chrome --version >/dev/null || fail "AC6: google-chrome does not run as the runtime user"
docker exec "${CONTAINER}" sh -c 'test -w /data' || fail "AC6: DATA_DIR /data is not writable by the runtime user"
echo "AC6 ok: google-chrome runs and /data is writable by the runtime user"
cleanup
WORK="$(mktemp -d)"
trap cleanup EXIT

# AC2: without a session, the logs show the login block and /health reports login_required.
start_container /opt/fake-agy/FakeAgyNoSession.mjs
wait_for_health
[[ "$(curl -s "http://127.0.0.1:${PORT}/health")" == '{"status":"ok","agy":"login_required"}' ]] \
  || fail "AC2: /health does not report login_required"
logs="$(docker logs "${CONTAINER}" 2>&1)"
[[ "${logs}" == *"docker exec -it antigravity-connector agy"* && "${logs}" == *"loginUrl"* ]] \
  || fail "AC2: the logs do not show the login block"
echo "AC2 ok: login block in the logs, /health reports login_required"

echo "image-smoke: all checks passed"
