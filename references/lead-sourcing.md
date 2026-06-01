# Lead sourcing & segmentation

Garbage list → garbage results (and wrecked deliverability from bounces). Sourcing and
**segmentation** are where most of the leverage is.

## Where to get B2B leads

- **Apollo.io** — the workhorse. Filter by title, headcount, industry, geo; export CSV
  with verified emails. Rich columns (Title, Seniority, Employee Count, Industry, Country).
- **Scrapers** (Apollo scrapers, LinkedIn Sales Nav exporters) — higher volume, messier.
- **Purchased / niche lists** — quality varies; always re-verify.
- **Your own** — webinar signups, site visitors (enriched), past leads.

Always **verify emails** before sending (MillionVerifier, NeverBounce, ZeroBounce). Bounces
above ~3–5% will tank your inboxes.

## Segment to a sharp ICP

Don't blast everyone — pick a tight Ideal Customer Profile. Typical axes:

- **Geography** (country, sometimes city)
- **Company size** (employee count band — e.g. 1-10 for founder-led)
- **Title / seniority** (decision-maker: CEO, Founder, Owner, Managing Director…)
- **Industry / keywords** (your niche — e.g. agencies, SaaS, e-commerce, clinics)

A tight ICP lifts reply rates *and* protects deliverability (relevant mail gets fewer spam
complaints).

## The extractor

`templates/scripts/extract-leads.py` turns a folder of heterogeneous CSVs into one clean
send-list. It:

- parses **by column name with aliases** → handles every export schema in one pass,
- filters by your ICP (country + size + decision-maker title + industry),
- drops **role addresses** (`info@`, `contact@`) and junk/placeholder domains,
- de-dupes by email, flags your **priority segment** (e.g. service businesses),
- emits a full list **and** a `1-contact-per-company-domain` send-list for that segment.

```bash
python3 extract-leads.py ./leads ./out/leads.csv
# → out/leads.csv  +  out/leads_SERVICE_send.csv (your priority send-list)
```

**Customise the matchers** at the top of the script for your ICP: `is_target_country`,
`CEO_RE` (titles), `size_in_range`, `SERVICE_RE` (industry keywords). The shipped example
targets *France · 1-10 employees · founder/CEO · agencies & consultants*.

## Personalization data

Keep `first_name` and `company` if present — they power `{{firstName}}` / `{{company}}` in
sequences. `first_name` is usually reliable; `company` is often sparse, so don't build copy
that *requires* it.

## Hygiene

- One contact per company (the send-list already dedupes by domain) — don't double-touch a
  company from two inboxes.
- Re-verify any list older than a few months.
- Suppress past customers / current pipeline / opt-outs before enrolling.
