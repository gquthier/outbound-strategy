# Deliverability

Deliverability is ~80% of outbound. The best copy in the spam folder converts at 0%.

## Domains & inboxes

- **Never use your primary domain.** Burn secondaries (lookalikes of your brand). If a
  domain gets torched, you throw it away, not your business.
- **5–10 domains, ~3 inboxes each.** Volume comes from *more inboxes*, never from pushing
  one inbox harder.
- Buy domains that resemble your brand (`get-brand.com`, `brand-hq.com`, `try-brand.com`).

## Authentication (before the first send)

Every domain needs all three, or you go straight to spam:

- **SPF** — TXT record authorizing your sending host.
- **DKIM** — cryptographic signature; publish the public key as a TXT record.
- **DMARC** — policy record (`v=DMARC1; p=none; rua=...` to start, tighten later).

Verify with a tool like mail-tester or MXToolbox. Don't send a single cold email until all
three pass on all domains.

## Warmup

New domains/inboxes sending cold = instant spam flags. Warm up **2–4 weeks**:

- Use a warmup service or warmup pool (inboxes email each other, open, reply, mark "not spam").
- Ramp warmup volume gradually (e.g. start 5/day, build to 30–40/day).
- Only start real campaigns once warmup is healthy and inboxes sit in the inbox, not spam.

## Sending hygiene

| Rule | Why |
|------|-----|
| 20–40 emails/inbox/day, hard cap | Mailbox providers flag high-volume new senders |
| Ramp up (e.g. 8 → +4/week → 20) | Sudden volume looks like a spam cannon |
| Rotate inboxes | Spreads reputation risk |
| **No open-pixel / link tracking** | Tracking domains hurt placement; pros disable them on cold |
| Plain text, ≤1 link, no images/attachments (touch 1) | Image-heavy / link-heavy = spammy |
| Spin subjects & bodies (A/B variants) | Identical bulk content trips filters |
| Honor opt-outs instantly | Legal (CAN-SPAM/GDPR) + reputation |
| Watch bounce rate (<3–5%) | High bounces = bad list or bad inboxes → pause |

## Reply handling = reputation

Replies (especially positive) are a strong inbox signal. The engine auto-classifies
replies; treat `bounced` and `unsubscribed`/`do_not_contact` as **terminal** — never email
those contacts again. The orchestrator already skips terminal-status contacts.

## The single biggest mistake

Scaling volume before deliverability is proven. Send 20/day clean for two weeks, check
placement, *then* ramp. Slow is fast.
