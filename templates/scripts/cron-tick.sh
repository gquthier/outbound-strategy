#!/usr/bin/env bash
# Cron entrypoint. Run hourly during business hours; the orchestrator self-checks
# the send window. A separate daily cron should call report.mjs.
#
#   Crontab examples (VPS, server time = UTC; window check uses Europe/Paris):
#     0 6-17 * * 1-5  /path/outbound-tools/scripts/cron-tick.sh
#     30 16  * * 1-5  cd /path/outbound-tools && node scripts/report.mjs >> data/cron.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

# load env (.env.local: API_KEY, ACCOUNTS_FILE, TELEGRAM_*)
set -a
[ -f .env.local ] && . ./.env.local
set +a
export ACCOUNTS_FILE="${ACCOUNTS_FILE:-$PWD/accounts.json}"

mkdir -p data
echo "=== $(date -u +%FT%TZ) tick ===" >> data/cron.log
node scripts/orchestrator.mjs "$@" >> data/cron.log 2>&1
