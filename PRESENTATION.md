# Video script — "We built our own cold email infrastructure (and you can too)"

A ready-to-record walkthrough (~6–8 min). Screen-record the terminal + dashboard; read the
voiceover lines; show the on-screen cues. Adapt numbers to your own.

---

## 0:00 — Hook (15s)
> "Agencies pay 300 to 2,000 dollars a month for tools like Smartlead and Instantly to send
> cold email. I'm going to show you the exact stack we built in-house — same capabilities,
> we own everything, and an AI agent runs it. Let's go."

**Show:** the dashboard at a glance (15 inboxes, caps, run timeline).

## 0:15 — The problem (45s)
> "Three problems with the SaaS route: it's expensive per seat, you don't own your data, and
> you can't really automate it end-to-end. We wanted an outbound backend an agent could
> drive — create campaigns, enroll leads, read and classify replies — without clicking a UI."

**Show:** a pricing page of a cold-email SaaS, then cut to the repo.

## 1:00 — The architecture (60s)
> "Five layers. Domains and inboxes at the bottom — that's just SMTP to send and IMAP to
> read. On top, an open-source engine called outbound-tools: it's an MCP server, and clever
> part — it uses your IMAP mailboxes AS the database. No database to run. Above that, our
> orchestration layer handles caps and warmup. And monitoring on top."

**Show:** `references/architecture.md` diagram.

## 2:00 — Standing up the engine (75s)
> "We cloned outbound-tools. It ships wired to a paid inbox broker, so we decoupled it — one
> file — to read our own credentials from a local accounts.json. Two gotchas everyone hits:
> a TLS certificate mismatch because providers put the cert on the apex domain, and fresh
> inboxes that have no Sent or Drafts folder. Both fixed in the engine-setup guide. Then a
> connectivity test — every inbox has to come back green before we send anything."

**Show:** `node test-connections.mjs` → 15/15 SMTP ✅ IMAP ✅.

## 3:15 — Leads & segmentation (75s)
> "Outbound lives or dies on the list. We took a big pile of B2B exports — Apollo, scrapers —
> and ran one Python script that parses every schema by column name, then filters to our
> exact ICP: France, 1 to 10 employees, founders and CEOs, agencies and consultants. It
> drops role addresses like info@, dedupes to one contact per company, and spits out a clean
> send-list."

**Show:** `python3 extract-leads.py …` → the summary counts + a peek at the send-list.

## 4:30 — Sequences (45s)
> "Three steps. Step one A/B-tests two angles. Steps two and three are follow-ups threaded
> into the same conversation — that empty-subject trick. Short, plain text, one link, one
> ask. The engine tags each send with its variant so we get reply rate per variant."

**Show:** `templates/sequence.example.json`.

## 5:15 — Going autonomous (60s)
> "Here's the part that makes it a real system. We enroll leads across all inboxes — one
> contact, one inbox. We create the campaign on each inbox. Then an orchestrator runs every
> active campaign under a per-inbox daily cap and a warmup ramp — start low, climb weekly. A
> cron calls it hourly; it checks the send window itself. Every run is logged. Watch the
> dry-run: it previews exactly what would send, capped."

**Show:** `node orchestrator.mjs --dry-run` → "would-send" output respecting the cap.

## 6:15 — Monitoring (45s)
> "And we know it's working. This dashboard reads the run-log instantly — sent versus cap per
> inbox, the run timeline, interested replies. Every morning a Telegram report lands: sent,
> replies, interested, bounce rate — with an alert if bounces spike. That's our early warning."

**Show:** the dashboard + a sample Telegram report.

## 7:00 — Cost & close (45s)
> "Cost? The tool is free and open source. We pay only for inboxes — a few dollars each. The
> data lives in our own mailboxes. And the whole thing is operated by an agent. I packaged
> every step — the scripts, the deliverability rules, the segmentation, the orchestration —
> into one open skill. Link below. Clone it, follow it, and you'll have your own outbound
> infrastructure running this week. Own your pipeline."

**Show:** the GitHub repo + the SKILL.md.

---

### B-roll / cutaways
- terminal: build, connectivity test, dry-run
- the dashboard auto-refreshing
- the architecture diagram
- a Telegram report notification

### One-line description (for the upload)
> How we replaced a $300/mo cold-email SaaS with a self-hosted, agent-operated outbound stack
> — full open-source playbook + skill in the description.
