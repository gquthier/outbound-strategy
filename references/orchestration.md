# Autonomous orchestration

The engine sends only when called. The orchestration layer turns that into a hands-off
system: a cron runs every active campaign across all inboxes, under a per-inbox daily cap
and a warmup ramp, and logs every run.

## The model

- **1 contact = 1 inbox.** `enroll.mjs` distributes a send-list round-robin across inboxes;
  each contact's marker lives on one inbox (segment = campaign name). `start_campaign`
  reads only that inbox's segment → isolated, fast, no duplicate sends.
- **Daily cap is per inbox, shared across campaigns.** If two campaigns share an inbox, the
  orchestrator splits that inbox's daily quota between them.
- **Warmup ramp.** Cap per inbox = `min(maxPerInbox, startPerInbox + stepPerWeek × weeks)`
  since `startDate`. Start low, climb weekly.

## Control plane — `orchestrator.config.json`

```json
{ "timezone": "Europe/Paris", "sendDays": [1,2,3,4,5], "sendHours": {"start":8,"end":18},
  "ramp": {"startPerInbox":8,"stepPerWeek":4,"maxPerInbox":20,"startDate":"2025-01-01"},
  "campaigns": [ {"name":"campaign_1","active":true} ] }
```

`active:false` parks a campaign. `inboxes` defaults to all in `accounts.json`.

## Launch a campaign

```bash
export ACCOUNTS_FILE=$PWD/accounts.json

# 1. create the campaign on every inbox (same name + audience segment)
node scripts/create-campaign.mjs --campaign campaign_1 --sequence ./sequence.json

# 2. enroll your send-list (round-robin across inboxes)
node scripts/enroll.mjs --campaign campaign_1 --file ./out/leads_SERVICE_send.csv --limit 1500

# 3. flip active:true in orchestrator.config.json  → the cron takes over
```

## Run / preview

```bash
node scripts/orchestrator.mjs --dry-run --ignore-window   # preview what would send now
node scripts/orchestrator.mjs                             # live (respects window + cap)
```

The engine's `start_campaign` gained two params used here:
- **`max_sends`** — hard ceiling on sends this run (the cap mechanic).
- **`dry_run`** — compute what *would* send without sending (preview & tests).

Flags: `--campaign <name>`, `--inboxes a@x,b@y` (subset), `--ignore-window`.

## State & idempotency

- `data/orchestrator-state.json` — today's sent count per inbox (the live quota counter).
- `data/run-log.jsonl` — every run appended (timestamp, inbox, campaign, sent, errors).
- `start_campaign` is idempotent: re-running never double-sends; it only advances *due*
  contacts and respects step delays + terminal reply statuses.

## Cron

`cron-tick.sh` is the entrypoint; it loads env and calls the orchestrator, which self-checks
the send window — so a simple hourly cron is safe (see `deployment.md`).
