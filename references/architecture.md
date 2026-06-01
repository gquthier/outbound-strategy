# Architecture

The system is five layers. You can swap any one without touching the others.

```
┌─ INFRASTRUCTURE ─────────────────────────────────────────────┐
│ Domains (secondaries) → Inboxes → SPF/DKIM/DMARC → warmup     │
└──────────────────────────────────────────────────────────────┘
            │ SMTP (send) + IMAP (read)
┌─ ENGINE (outbound-tools) ────────────────────────────────────┐
│ MCP server + CLI · nodemailer (SMTP) · imapflow (IMAP)        │
│ State = IMAP keywords/drafts (no external database)           │
│   campaigns · audiences/contacts · reply statuses             │
└──────────────────────────────────────────────────────────────┘
            │ start_campaign(inbox, name, max_sends, dry_run)
┌─ ORCHESTRATION ──────────────────────────────────────────────┐
│ orchestrator.mjs · per-inbox daily cap · warmup ramp          │
│ enroll.mjs (1 contact = 1 inbox) · create-campaign.mjs        │
│ orchestrator.config.json (control plane) · state + run-log    │
└──────────────────────────────────────────────────────────────┘
            │ cron-tick.sh (hourly, self-checks send window)
┌─ MONITORING ─────────────────────────────────────────────────┐
│ run-log.jsonl · dashboard (Express, read-only) · report.mjs   │
│ daily Telegram summary · bounce-rate alert                    │
└──────────────────────────────────────────────────────────────┘
```

## Key design decisions

**IMAP as the database.** Campaign configs are stored as drafts; contacts as marker
messages in a `Contacts` folder; reply statuses as IMAP keywords on each message.
Benefits: zero DB to run, data lives in your own mailboxes, state is portable and
survives an app wipe. Trade-off: analytics are computed on-demand (cache them).

**1 contact = 1 sending inbox.** Each lead is enrolled on exactly one inbox (segment =
campaign name). `start_campaign` reads only that inbox's segment. Result: campaigns are
isolated, no two inboxes ever email the same lead, and runs are fast (no N×N scans).

**Idempotent runner.** `start_campaign` advances each contact to its next *due* step and
is safe to call repeatedly. The orchestrator just calls it on a schedule with a per-run
`max_sends` cap. This is what makes "set it and forget it" safe.

**Caps live in the orchestrator, not the engine.** The engine will send to everyone due;
the orchestrator enforces the per-inbox daily ceiling and the warmup ramp. Keeps the
deliverability policy in one place.

## Why self-host vs SaaS

You own the data, pay only for inboxes, and the whole thing is **agent-operable** — an AI
agent creates campaigns, enrolls leads, reads and classifies replies through the MCP tools
or CLI. Marginal cost per extra client ≈ the cost of their inboxes.
