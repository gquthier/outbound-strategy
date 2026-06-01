// Enrolls contacts from a CSV into a campaign's audience, distributed
// round-robin across the inboxes (one contact = one sending inbox).
// Batched: one IMAP session per inbox. Idempotent (skips existing markers).
//
//   ACCOUNTS_FILE=... node scripts/enroll.mjs --campaign <name> --file <csv> [--limit N] [--offset N]

import { readFileSync } from "node:fs";
import { getMailboxByEmail, bulkUpsertContactMarkers } from "../packages/toolkit/dist/index.js";
import { loadConfig, inboxesForCampaign, argVal, cliInboxes } from "./_shared.mjs";

const name = argVal("--campaign");
const file = argVal("--file");
const limit = argVal("--limit") ? Number(argVal("--limit")) : Infinity;
const offset = argVal("--offset") ? Number(argVal("--offset")) : 0;
if (!name || !file) {
  console.error("Usage: node scripts/enroll.mjs --campaign <name> --file <csv> [--limit N] [--offset N]");
  process.exit(1);
}

// Minimal quote-aware CSV parser.
function parseCsv(text) {
  const rows = [];
  let i = 0, field = "", row = [], inQ = false;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(readFileSync(file, "utf-8"));
const header = rows.shift().map((h) => h.trim().toLowerCase());
const ie = header.indexOf("email");
const ifn = header.indexOf("first_name");
const iln = header.indexOf("last_name");
const ico = header.indexOf("company");
if (ie < 0) { console.error("CSV has no 'email' column"); process.exit(1); }

let contacts = rows
  .filter((r) => r[ie] && r[ie].includes("@"))
  .map((r) => ({
    email: r[ie].trim().toLowerCase(),
    firstName: ifn >= 0 ? (r[ifn] || "").trim() : "",
    lastName: iln >= 0 ? (r[iln] || "").trim() : "",
    company: ico >= 0 ? (r[ico] || "").trim() : "",
  }));
contacts = contacts.slice(offset, limit === Infinity ? undefined : offset + limit);

const config = loadConfig();
const camp = config.campaigns.find((c) => c.name === name) || { name };
const inboxes = cliInboxes() || inboxesForCampaign(camp, config);

// round-robin distribution
const buckets = inboxes.map(() => []);
contacts.forEach((c, idx) => buckets[idx % inboxes.length].push(c));

let added = 0, skipped = 0;
for (let k = 0; k < inboxes.length; k++) {
  if (!buckets[k].length) continue;
  const mb = await getMailboxByEmail(inboxes[k]);
  const r = await bulkUpsertContactMarkers(mb, buckets[k], [name]);
  added += r.added; skipped += r.skipped;
  console.log(`  ${inboxes[k].padEnd(40)} +${r.added} (skip ${r.skipped})`);
}
console.log(`Enrolled ${added} contacts into "${name}" across ${inboxes.length} inboxes (skipped ${skipped} already present).`);
