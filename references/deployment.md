# Deployment (24/7)

For sequences to advance unattended, the orchestrator must run on an always-on host. A
€4–6/mo VPS is plenty — ideally next to (or the same box as) your mail server.

## Provision

```bash
# on the VPS
git clone <your outbound-tools fork>.git /opt/outbound
cd /opt/outbound
pnpm install && pnpm build

# secrets (never committed)
scp accounts.json  vps:/opt/outbound/accounts.json     # or recreate it there
cat > .env.local <<'EOF'
API_KEY=<random>
ACCOUNTS_FILE=/opt/outbound/accounts.json
ANTHROPIC_API_KEY=<optional, for AI reply classification>
TELEGRAM_BOT_TOKEN=<optional, for daily report>
TELEGRAM_CHAT_ID=<optional>
EOF
chmod 600 accounts.json .env.local
node test-connections.mjs ./accounts.json   # confirm before going live
```

## Cron

`cron-tick.sh` loads `.env.local`, sets `ACCOUNTS_FILE`, and calls the orchestrator (which
self-checks the send window, so an hourly tick is safe):

```cron
# send window is enforced in-app; run hourly on weekdays (server time UTC here)
0 6-17 * * 1-5  /opt/outbound/scripts/cron-tick.sh
# daily report once in the afternoon
30 16  * * 1-5  cd /opt/outbound && node scripts/report.mjs >> data/cron.log 2>&1
```

## Optional: dashboard + MCP server

Run the engine's server for the dashboard and agent access:

```bash
PORT=4747 node --env-file=.env.local packages/api/dist/index.js   # or pm2 / systemd
```

- Dashboard at `http://<vps>:4747/` — **firewall it** or bind to localhost + SSH tunnel.
  It exposes campaign stats; don't leave it open to the internet.
- MCP endpoint `POST /mcp` (Bearer `API_KEY`) lets an AI agent drive campaigns remotely.

## Security checklist

- [ ] `accounts.json`, `.env.local`, `data/` are **git-ignored** (they hold credentials/PII).
- [ ] File perms `600` on secrets.
- [ ] Dashboard not exposed publicly (firewall / localhost-only).
- [ ] `API_KEY` is a real random secret if the server is reachable.
- [ ] Backups of `accounts.json` (your inbox credentials) and `orchestrator.config.json`.

## Keeping it healthy

- Watch the daily Telegram report; act on bounce alerts.
- Re-verify lists periodically; rotate in fresh domains as you scale volume.
- Keep per-inbox caps conservative — add inboxes for more volume, never push one harder.
