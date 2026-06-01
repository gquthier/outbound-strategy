# Sequences & copywriting

The goal of a cold email is **one reply**, not a sale. Optimize for "worth a conversation."

## Structure that works

3 steps, spaced out, follow-ups threaded into the same conversation:

| Step | Day | Purpose |
|------|-----|---------|
| 1 | 0 | The pitch. A/B two angles. |
| 2 | +3 | Bump — short, "in case it slipped." Reply in the same thread. |
| 3 | +5 | Breakup — "closing this out." Often the best performer. |

In the engine, an **empty `subject` on step 2+** means "reply in the same thread" (proper
`In-Reply-To`/`References` headers), so it threads in the recipient's inbox.

## The copy framework

A first touch is 4 lines max:

1. **Hook / relevance** — why them, why now (no "I hope this finds you well").
2. **Value** — the outcome you create, in their words. Not features.
3. **Proof** — one concrete, credible result (number > adjective).
4. **Soft CTA** — low friction: "worth 15 min?" or "reply 'yes'". One ask.

Rules:
- **Short.** If it scrolls, it's too long.
- **Plain text**, ≤1 link, no images on touch 1 (deliverability).
- **Light personalization** — `{{firstName}}` always; `{{company}}`/industry if reliable.
- **No hype, no jargon.** Write like a human emailing one person.
- **A/B the angle, not just words** — e.g. problem-led vs outcome-led.

## A/B variants

Step 1 ships two variants at `weight: 50` each (≈50/50 split). The engine tags each send
with its variant, so `get_campaign_analytics` shows reply rate **per variant** — keep the
winner, kill the loser.

## Personalization tokens

`{{firstName}}` · `{{lastName}}` · `{{company}}` · `{{email}}` — replaced per contact from
the audience. Missing values render empty, so write copy that still reads fine without them.

## Template

`templates/sequence.example.json` is a ready 3-step / A/B sequence with `[PLACEHOLDERS]` for
your offer, proof, and CTA. Create it on every inbox with `create-campaign.mjs`.

## CTAs that convert on cold

- "Worth a quick 15 min?" (+ calendar link) — classic.
- "Reply 'yes' and I'll send details." — lowest friction, great for warmup-phase volume.
- "Open to me sending a 60-sec Loom?" — soft, high reply.

Avoid "Book a demo" on a first cold touch — too much commitment from a stranger.
