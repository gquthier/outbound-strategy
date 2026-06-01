# Outbound Strategy — Build Your Own Cold Email Infrastructure

> The self-hosted alternative to Smartlead / Instantly / Lemlist. Own your sending layer,
> drive it with an AI agent, pay only for inboxes.

This is a **Claude Code skill** + a complete playbook (with runnable templates) for building
an in-house cold-email / outbound system: connect your own SMTP/IMAP inboxes, source and
segment leads, write sequences, send at scale with deliverability-safe caps + warmup ramp,
auto-classify replies, and run it all autonomously with monitoring.

You don't rent a SaaS. You own the stack, the data lives in your own mailboxes, and an AI
agent operates it for you.

## What's inside

```
SKILL.md                     ← the master guide (start here)
references/                  ← deep-dives
  architecture.md  deliverability.md  engine-setup.md  lead-sourcing.md
  sequences.md     orchestration.md   monitoring.md    deployment.md
templates/
  accounts.example.json              orchestrator.config.example.json
  sequence.example.json
  scripts/  accounts.ts  tls.ts  extract-leads.py  enroll.mjs
            create-campaign.mjs  orchestrator.mjs  report.mjs
            test-connections.mjs  bootstrap-folders.mjs  cron-tick.sh  _shared.mjs
PRESENTATION.md              ← ready-to-record video script
```

## The stack

| Layer | Tech |
|-------|------|
| Engine | [outbound-tools](https://github.com/arnaudjnn/outbound-tools) (MCP server + CLI, TypeScript) |
| Transport | nodemailer (SMTP) · imapflow (IMAP) |
| State | IMAP keywords/drafts — **no database** |
| Lead segmentation | Python (`csv`, column-alias parsing) |
| Orchestration | Node scripts + cron (caps, warmup ramp, run-log) |
| Monitoring | Express dashboard + Telegram daily report |
| Reply classification | optional, Claude (Anthropic API) |

## Quickstart

1. **Infra** — buy secondary domains + inboxes, set SPF/DKIM/DMARC, warm up. → `references/deliverability.md`
2. **Engine** — clone `outbound-tools`, decouple it from the paid broker (one file). → `references/engine-setup.md`
3. **Connect** — `accounts.json` + `node test-connections.mjs` (all inboxes ✅).
4. **Leads** — `python3 extract-leads.py ./leads ./out/leads.csv` → segmented send-list. → `references/lead-sourcing.md`
5. **Sequence** — adapt `templates/sequence.example.json`. → `references/sequences.md`
6. **Go autonomous** — `enroll` → `create-campaign` → flip `active:true` → cron. → `references/orchestration.md`
7. **Monitor** — dashboard + daily Telegram report + bounce alerts. → `references/monitoring.md`
8. **Deploy** — €5/mo VPS + two cron lines. → `references/deployment.md`

## Install as a Claude Code skill

Drop this folder into your skills directory (e.g. `~/.claude/skills/outbound-strategy/`) and
ask your agent to "build my outbound infrastructure." It will follow `SKILL.md` step by step.

## Responsible use

Cold email is regulated (CAN-SPAM, GDPR, etc.). Only email people you may lawfully contact,
always offer an opt-out, honor it instantly, and follow the laws of your and your
recipients' jurisdictions. This project is for legitimate B2B outreach — not spam.

## Credits & license

Engine: the open-source [outbound-tools](https://github.com/arnaudjnn/outbound-tools) MCP
server. This skill adds the decoupling, lead segmentation, autonomous orchestration,
monitoring, and deployment layers. Not affiliated with Smartlead, Instantly, Lemlist, or
Apollo. MIT licensed — see `LICENSE`.
