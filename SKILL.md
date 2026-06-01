---
name: outbound-strategy
description: >-
  Build your own in-house cold email / outbound infrastructure instead of renting Smartlead, Instantly or Lemlist.
  Use when someone wants to set up self-hosted cold outreach: connecting their own SMTP/IMAP inboxes, sourcing and
  segmenting B2B leads, writing multi-step sequences, sending at scale with deliverability-safe caps and warmup ramps,
  classifying replies, and running everything autonomously with monitoring. Triggers on: "cold email infrastructure",
  "self-hosted outreach", "build my own Smartlead", "outbound system", "send cold email sequences", "lead segmentation",
  "email deliverability", "warmup", "inbox rotation", "reply tracking".
---

# Outbound Strategy — Build Your Own Cold Email Infrastructure

A complete, opinionated playbook for building a **self-hosted outbound email system** — the same stack agencies pay
$300–$2,000/mo for (Smartlead, Instantly, Lemlist), owned end to end for the price of your inboxes.

You drive it with an AI agent. No per-seat SaaS, no data lock-in, no sending limits but the ones you choose.

> **What you get:** multi-inbox sending with rotation, multi-step A/B sequences, automatic reply classification,
> deliverability-safe daily caps + warmup ramp, a monitoring dashboard, and a cron that runs it all 24/7.

---

## When to use this skill

- You have (or will buy) cold-email domains + inboxes and want to **own the sending layer**.
- You want an **agent-operable backend** (create campaigns, enroll leads, read replies) instead of clicking a SaaS UI.
- You care about **deliverability** and want full control over volume, ramp, and rotation.
- You're an agency/consultant who wants to **resell** outbound or run it for clients at near-zero marginal cost.

If you just need to send 50 newsletters to opted-in subscribers, use a newsletter tool (listmonk, Keila). This is for
**cold B2B outreach at scale**.

---

## The mental model

```
DOMAINS (5–10 throwaway .com/.info)
  └─ INBOXES (3 per domain)  ── SMTP (send) + IMAP (read/replies)
        └─ ENGINE  (outbound-tools: MCP server + CLI, IMAP = database)
              ├─ Campaigns  (multi-step sequences, A/B variants, threaded follow-ups)
              ├─ Audiences  (your segmented leads, 1 contact = 1 inbox)
              └─ Replies    (auto-classified: interested / meeting / bounced / unsubscribe)
        └─ ORCHESTRATOR  (cron → run all campaigns, per-inbox daily cap + warmup ramp)
        └─ MONITORING    (run-log + dashboard + daily Telegram report + bounce alerts)
```

**Why IMAP-as-database?** The engine stores campaigns, contacts, and reply statuses as IMAP keywords/drafts inside
your own mailboxes. No external DB to host, your data lives where your email lives, and any campaign state survives
even if the app is wiped.

---

## The 7 steps (follow in order)

Each step links to a deep-dive in `references/`. Templates to copy are in `templates/`.

### Step 0 — Infrastructure & deliverability (do NOT skip)
Buy 5–10 secondary domains (never your main domain). Create ~3 inboxes per domain. Configure **SPF, DKIM, DMARC** on
every domain. **Warm up** for 2–4 weeks before real sends. Deliverability is 80% of outbound success — see
[`references/deliverability.md`](references/deliverability.md).

### Step 1 — Stand up the engine
Clone the open-source **outbound-tools** MCP server (TypeScript, IMAP/SMTP, zero DB). It ships coupled to a paid inbox
broker — **decouple it** to use your own raw SMTP/IMAP credentials. The full decoupling (one file) is in
[`references/engine-setup.md`](references/engine-setup.md) and [`templates/scripts/accounts.ts`](templates/scripts/accounts.ts).

### Step 2 — Connect your inboxes
Put your credentials in a local `accounts.json` (see [`templates/accounts.example.json`](templates/accounts.example.json)).
Two gotchas every self-hoster hits — a TLS apex-cert mismatch, and fresh inboxes shipping with no `Sent`/`Drafts`
folders — are solved in [`references/engine-setup.md`](references/engine-setup.md). Verify with the connectivity test
script before anything else.

### Step 3 — Source & segment leads
Pull B2B leads (Apollo.io export, scrapers, lists). Then **segment hard** to your ICP — country, company size, title,
industry. The [`templates/scripts/extract-leads.py`](templates/scripts/extract-leads.py) parses heterogeneous CSVs by
column name (with aliases), filters by your criteria, dedupes, drops role/junk addresses, and flags your priority
segment. See [`references/lead-sourcing.md`](references/lead-sourcing.md).

### Step 4 — Write sequences that get replies
3 steps, A/B on step 1, follow-ups threaded in the same conversation, light personalization. Short > clever.
Templates + the copy framework in [`references/sequences.md`](references/sequences.md) and
[`templates/sequence.example.json`](templates/sequence.example.json).

### Step 5 — Go autonomous
Enroll leads across inboxes (1 contact = 1 inbox), create the campaign on each inbox, then let an **orchestrator** run
every active campaign under a **per-inbox daily cap + warmup ramp**. Cron calls it hourly; it self-checks the send
window. See [`references/orchestration.md`](references/orchestration.md) and the scripts in `templates/scripts/`.

### Step 6 — Monitor & know it's working
A run-log (every send timestamped), a read-only **dashboard**, and a **daily Telegram report** (sent / replies /
interested / bounce rate) with an **alert if bounces spike**. See [`references/monitoring.md`](references/monitoring.md).

### Step 7 — Deploy 24/7
Drop it on a cheap VPS (€5/mo) next to your mail server, add two cron lines, and it runs itself. See
[`references/deployment.md`](references/deployment.md).

---

## Deliverability — the 10 rules that decide everything

1. **Never send from your primary domain.** Use lookalike secondaries.
2. **SPF + DKIM + DMARC on every domain**, before the first send.
3. **Warm up 2–4 weeks.** New domains sending cold = instant spam.
4. **Cap 20–40/inbox/day.** More inboxes for volume, never more per inbox.
5. **Ramp up**, don't jump: start ~8/inbox/day, +a few per week.
6. **Rotate inboxes.** Spread volume; one campaign ≠ one inbox at scale.
7. **No tracking pixels / link tracking on cold.** They tank deliverability and most pros disable them.
8. **Plain text, 1 link max, no images, no attachments** on the first touch.
9. **Honor opt-outs instantly.** Tag `unsubscribed`/`do_not_contact` as terminal — never email again.
10. **Watch the bounce rate.** Above ~3–5% → pause, the list or the inboxes are bad.

Full detail: [`references/deliverability.md`](references/deliverability.md).

---

## Cost reality

| | SaaS (Smartlead/Instantly) | This (self-hosted) |
|---|---|---|
| Sending tool | $39–$300+/mo | $0 (open source) |
| Inboxes (15) | included / metered | ~$3/inbox/mo at a provider, or self-host |
| Leads | extra | bring your own |
| Data ownership | theirs | **yours (in your mailboxes)** |
| Agent-operable | limited API | **native (MCP + CLI)** |
| Marginal cost / client | per-seat | **~zero** |

---

## How to drive it (once built)

The agent operates the system through the CLI or the MCP tools:

```
enroll leads      → distribute a segmented CSV across inboxes (1 contact = 1 inbox)
create campaign   → multi-step sequence on each inbox
orchestrator      → run all active campaigns under daily cap + ramp (cron)
report            → daily Telegram summary + bounce alert
classify replies  → auto-tag interested / meeting / bounced / unsubscribe
```

Concrete commands: [`references/orchestration.md`](references/orchestration.md) and `templates/scripts/`.

---

## Files in this skill

- `references/` — deep-dives: architecture, deliverability, engine-setup, lead-sourcing, sequences, orchestration, monitoring, deployment.
- `templates/` — copy-paste configs + a generic, runnable version of every script (accounts provider, lead extractor, enroll, create-campaign, orchestrator, report).
- `PRESENTATION.md` — a ready-to-record video script explaining the whole build.

**Engine credit:** built on the open-source [`outbound-tools`](https://github.com/arnaudjnn/outbound-tools) MCP server.
This skill adds the decoupling, lead segmentation, autonomous orchestration, monitoring, and deployment layers.
