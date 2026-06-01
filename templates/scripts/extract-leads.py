#!/usr/bin/env python3
"""
Segment a messy corpus of B2B lead CSVs into a clean, targeted send-list.

This is the EXAMPLE ICP used in the walkthrough: France + company size 1-10 +
decision-maker title (CEO / Founder / Owner / Gérant / Président) + a "service
business" flag (agency / coach / consultant). ADAPT the matchers below to your
own ICP — country, size band, titles, industry keywords.

Why it's built this way:
  - Lead exports (Apollo.io, scrapers, purchased lists) have wildly different
    column names. We parse by COLUMN NAME with aliases, not by position, so one
    script handles every schema in the folder.
  - Python's csv module is quote/newline safe; we also tolerate bad encodings.
  - We drop role addresses (info@, contact@) and junk domains, dedupe by email,
    and emit a "1 contact per company domain" send-list for the priority segment.

Usage:
  python3 extract-leads.py <leads_dir> <out.csv>
"""

import csv, io, os, re, sys

csv.field_size_limit(10_000_000)

LEADS_DIR = sys.argv[1] if len(sys.argv) > 1 else "./leads"
OUT = sys.argv[2] if len(sys.argv) > 2 else "./out/leads_filtered.csv"

# ── Column aliases (normalised: lower, stripped, de-quoted) ──────────────────
def norm(h): return h.replace("﻿", "").strip().strip('"').strip().lower()

ALIASES = {
    "email":        ["email", "work email", "email address"],
    "first_name":   ["first name", "first_name", "firstname"],
    "last_name":    ["last name", "last_name", "lastname"],
    "full_name":    ["full name", "full_name", "name"],
    "title":        ["title", "job title", "job_title", "jobtitle", "position", "headline"],
    "seniority":    ["seniority"],
    "employees":    ["employee count", "employees", "# employees", "number of employees",
                     "company size", "headcount", "staff count"],
    "lead_country": ["lead country", "country", "person country"],
    "company_country": ["company country"],
    "location":     ["company location", "location", "company address"],
    "industry":     ["industry"],
    "keywords":     ["company keywords", "keywords"],
    "company":      ["company name", "cleaned company name", "company", "company_name", "organization"],
    "city":         ["lead city", "company city", "city"],
    "website":      ["company website short", "company website full", "company domain",
                     "company_domain", "website", "company website", "domain", "company_website"],
    "email_status": ["email status", "millionverifier status", "email_status",
                     "email deliverability", "verifier status"],
}

def build_index(header):
    H = [norm(h) for h in header]
    idx = {}
    for field, names in ALIASES.items():
        idx[field] = next((H.index(n) for n in names if n in H), None)
    if idx["employees"] is None:
        idx["employees"] = next((i for i, h in enumerate(H) if "employee" in h), None)
    return idx

def get(row, i): return "" if i is None or i >= len(row) else (row[i] or "").strip()

# ── ICP matchers — CUSTOMISE THESE ──────────────────────────────────────────
FRANCE_RE = re.compile(r"\bfrance\b", re.I)
def is_target_country(*vals):
    for v in vals:
        if v and (v.strip().lower() in ("fr", "fra", "france") or FRANCE_RE.search(v)):
            return True
    return False

CEO_RE = re.compile(
    r"\b(ceo|chief executive|founder|co[\-\s]?founder|cofounder|owner|propri[ée]taire|"
    r"g[ée]rant|g[ée]rante|pr[ée]sident|pr[ée]sidente|dirigeant|dirigeante|"
    r"directeur g[ée]n[ée]ral|directrice g[ée]n[ée]rale|managing director|"
    r"associ[ée] g[ée]rant|fondateur|fondatrice|patron|business owner)\b", re.I)
NEG_TITLE_RE = re.compile(r"\b(vice|vp|deputy|adjoint|adjointe|assistant|stagiaire|intern|junior|former|ex-)\b", re.I)
SENIORITY_OK = {"owner", "founder", "ceo"}
def is_decision_maker(title, seniority):
    if title and CEO_RE.search(title) and not NEG_TITLE_RE.search(title):
        return True
    return (seniority or "").strip().lower().replace(" ", "_") in SENIORITY_OK

def size_in_range(raw, lo=1, hi=10):
    if not raw: return None
    nums = [int(x) for x in re.findall(r"\d+", raw)]
    if not nums: return None
    return (lo <= nums[0] <= hi) if len(nums) == 1 else (max(nums) <= hi)

SERVICE_RE = re.compile(
    r"agenc|consult|conseil|coach|marketing|advertis|publicit|communicat|\bbrand|design|"
    r"studio|\bweb\b|seo|growth|freelance|social media|copywrit|formation|training", re.I)
def is_service(*vals): return bool(SERVICE_RE.search(" ".join(v or "" for v in vals)))

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
BAD_STATUS = {"invalid", "bad", "unavailable", "bounce", "bounced", "do_not_mail", "unverifiable", "disposable"}
JUNK_DOMAINS = {"fake-linkedin.com", "linkedin.com", "instagram.com", "facebook.com", "twitter.com",
                "x.com", "example.com", "test.com", "email.com", "domain.com", "company.com"}
ROLE_LOCALS = {"info", "contact", "hello", "hi", "bonjour", "support", "admin", "team", "sales",
               "rh", "recrutement", "jobs", "career", "careers", "press", "presse", "newsletter",
               "noreply", "no-reply", "postmaster", "webmaster", "office", "accounts", "compta",
               "billing", "hey", "mail", "email", "service", "services", "commercial"}
def email_ok(email, status):
    if not email or not EMAIL_RE.match(email): return False
    if (status or "").strip().lower().replace(" ", "_") in BAD_STATUS: return False
    local, _, dom = email.partition("@")
    return dom not in JUNK_DOMAINS and local not in ROLE_LOCALS

def open_text(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try: return io.StringIO(raw.decode(enc))
        except UnicodeDecodeError: continue
    return io.StringIO(raw.decode("latin-1", errors="replace"))

# ── Run ─────────────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
by_email, stats = {}, {"files": 0, "rows": 0, "country": 0, "dm": 0, "size": 0, "service": 0}

for fname in sorted(f for f in os.listdir(LEADS_DIR) if f.lower().endswith(".csv")):
    stats["files"] += 1
    try:
        reader = csv.reader(open_text(os.path.join(LEADS_DIR, fname)))
        header = next(reader, None)
        if not header: continue
        idx = build_index(header)
        if idx["email"] is None or idx["employees"] is None: continue
        for row in reader:
            if not row: continue
            stats["rows"] += 1
            email = get(row, idx["email"]).lower()
            if not email_ok(email, get(row, idx["email_status"])): continue
            if not is_target_country(get(row, idx["lead_country"]), get(row, idx["company_country"]), get(row, idx["location"])): continue
            stats["country"] += 1
            if not is_decision_maker(get(row, idx["title"]), get(row, idx["seniority"])): continue
            stats["dm"] += 1
            if size_in_range(get(row, idx["employees"])) is not True: continue
            stats["size"] += 1
            company, industry, keywords = get(row, idx["company"]), get(row, idx["industry"]), get(row, idx["keywords"])
            svc = is_service(industry, keywords, company, get(row, idx["title"]))
            if svc: stats["service"] += 1
            rec = {"email": email, "first_name": get(row, idx["first_name"]), "last_name": get(row, idx["last_name"]),
                   "title": get(row, idx["title"]), "company": company, "employees": get(row, idx["employees"]),
                   "industry": industry, "city": get(row, idx["city"]), "website": get(row, idx["website"]),
                   "is_service": "yes" if svc else "no", "source_file": fname}
            prev = by_email.get(email)
            if prev is None or (svc and prev["is_service"] == "no"): by_email[email] = rec
    except Exception as e:
        sys.stderr.write(f"ERR {fname}: {e}\n")

cols = ["email", "first_name", "last_name", "title", "company", "employees", "industry", "city", "website", "is_service", "source_file"]
records = sorted(by_email.values(), key=lambda r: (r["is_service"] != "yes", r["company"].lower()))
with open(OUT, "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); [w.writerow(r) for r in records]

# 1 contact per company domain, priority (service) segment
service = [r for r in records if r["is_service"] == "yes"]
by_domain = {}
for r in service:
    d = r["email"].split("@")[-1]
    by_domain.setdefault(d, r)
SEND = OUT.replace(".csv", "_SERVICE_send.csv")
with open(SEND, "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); [w.writerow(r) for r in by_domain.values()]

print(f"files {stats['files']} · rows {stats['rows']:,} · country {stats['country']:,} · "
      f"decision-maker {stats['dm']:,} · size-ok {stats['size']:,}")
print(f"FINAL unique {len(records):,} · service {stats['service']:,} · send-list (1/domain) {len(by_domain):,}")
print(f"out: {OUT}\nsend: {SEND}")
