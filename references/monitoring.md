# Monitoring — know it's actually working

"Set it and forget it" only works if you'd *notice* when it breaks. Three layers:

## 1. Run-log (source of truth)

Every orchestrator run appends a line to `data/run-log.jsonl`:

```json
{"ts":"2025-…","date":"2025-…","inbox":"a@dom.com","campaign":"campaign_1","sent":8,"errors":0,"cap":8}
```

Cheap, append-only, survives restarts. Everything else is derived from it + the engine's
`get_campaign_analytics`.

## 2. Dashboard (read-only)

Serve a small page from the engine's Express server (it already runs for the MCP/REST API):

- `GET /` → an HTML mission-control page.
- `GET /dashboard/data` → **fast** JSON from `run-log` + `state` + `accounts.json` (no IMAP):
  sent-today vs cap per inbox, totals, run timeline, active campaigns.
- `POST /dashboard/refresh` → **slow**, on-demand IMAP query for analytics + interested
  replies; caches to `data/analytics-cache.json`.

Split fast (file) vs slow (IMAP) so the page is instant and only hits IMAP when you click
refresh. Keep the dashboard routes unauthenticated only on localhost / behind your VPS
firewall — never expose campaign data publicly.

## 3. Daily report → Telegram

`report.mjs` aggregates per-campaign analytics + today's run-log and pushes a summary to a
Telegram bot:

```
📬 Outbound — 2025-…
Today: 142 sent
• campaign_1: 980 sent · 47 replies (4.8%) · 🔥12 interested · 📅5 meetings · ⚠️3 bounce
```

Set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` in `.env.local`. Schedule it once a day by cron.

## Alerts that matter

`report.mjs` raises a 🚨 line when **bounce rate > 3%** or errors spike — your two early
warnings that a list or some inboxes have gone bad. When you see it: pause the campaign,
check the inboxes' placement, clean the list, then resume.

## Reply triage

Replies are auto-classified (`interested` / `meeting_request` / `not_interested` /
`bounced` / `unsubscribed` / …). The dashboard's "interested" list and the Telegram counts
tell you where to spend your human time — answering hot leads. Everything else the system
handles (terminal statuses are skipped automatically).
