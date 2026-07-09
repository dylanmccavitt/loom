#!/usr/bin/env bash
# Readiness check for cloud-agent eval runs.
#
# Exit 0 when structural gates pass (node/npm/agent/codex + loom repo root).
# Missing LOOM_JUDGE_BACKEND or CLI auth print hints and do not fail — the
# judge skips gracefully when unset, and login is a one-time operator step.
#
# Usage (from loom repo root):
#   npm run verify:eval-tools
#   bash .cursor/verify-eval-tools.sh
#   bash .cursor/verify-eval-tools.sh --with-check   # also run npm run check

set -euo pipefail

export PATH="${HOME}/.local/bin:${PATH}"
FAIL=0
WITH_CHECK=0
HINTS=0

for arg in "$@"; do
  case "${arg}" in
    --with-check) WITH_CHECK=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "unknown argument: ${arg} (use --with-check)" >&2
      exit 2
      ;;
  esac
done

check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "ok: $1 ($("$1" --version 2>&1 | head -1))"
  else
    echo "missing: $1 (run bash .cursor/install-eval-tools.sh)" >&2
    FAIL=1
  fi
}

echo "=== Loom eval tool verification ==="
check_cmd node
check_cmd npm
check_cmd agent
check_cmd codex

if [[ -f package.json ]]; then
  echo "ok: loom repo root ($(pwd))"
else
  echo "missing: package.json — run from the loom repo root" >&2
  FAIL=1
fi

echo ""
echo "=== Judge backend ==="
# bench reads LOOM_JUDGE_BACKEND directly (benchmarks/judge/judge.mjs); no
# sourcing needed. Non-fatal: the judge skips gracefully when unset.
case "${LOOM_JUDGE_BACKEND:-}" in
  cursor)
    echo 'ok: LOOM_JUDGE_BACKEND=cursor → agent -p --mode ask --model auto --output-format text "$(cat)"'
    ;;
  codex)
    echo 'ok: LOOM_JUDGE_BACKEND=codex → codex exec --ephemeral --sandbox read-only -m gpt-5.5 -c model_reasoning_effort=xhigh -'
    ;;
  "")
    echo "hint: set LOOM_JUDGE_BACKEND=cursor or codex in Cloud Agents Secrets"
    HINTS=1
    ;;
  *)
    echo "warn: unknown LOOM_JUDGE_BACKEND=${LOOM_JUDGE_BACKEND} (use cursor or codex) — bench --judge will fail loudly" >&2
    HINTS=1
    ;;
esac

echo ""
echo "=== Auth hints (non-fatal) ==="
# Both CLIs may print "Not logged in" while still exiting 0, so check output too.
AGENT_STATUS="$(agent status 2>&1)" && ! grep -qi 'not logged in' <<<"${AGENT_STATUS}" \
  && echo "ok: agent CLI is logged in (Cursor subscription)" \
  || { echo "hint: run 'agent login' once in this VM, then snapshot the environment (Dashboard -> Cloud Agents -> Environments)"; HINTS=1; }
CODEX_STATUS="$(codex login status 2>&1)" && ! grep -qi 'not logged in' <<<"${CODEX_STATUS}" \
  && echo "ok: codex CLI is logged in (ChatGPT/Codex subscription)" \
  || { echo "hint: run 'codex login' once in this VM (device-auth flow), then snapshot the environment"; HINTS=1; }

if [[ "${WITH_CHECK}" -eq 1 ]]; then
  echo ""
  echo "=== Structural gate (npm run check) ==="
  if npm run check >/dev/null 2>&1; then
    echo "ok: npm run check"
  else
    echo "fail: npm run check — fix before trusting eval output" >&2
    FAIL=1
  fi
fi

echo ""
if [[ "${FAIL}" -ne 0 ]]; then
  echo "not ready: install missing tools first (or fix npm run check)" >&2
  exit 1
fi

if [[ "${HINTS}" -eq 0 ]]; then
  echo "ready: CLIs installed, judge backend set, auth present."
else
  echo "ready: CLIs installed. Judge may still skip until LOOM_JUDGE_BACKEND + CLI login are set."
fi
echo "  npm run bench -- --judge roboports"
exit 0
