// Autonomous campaign runner. Called on a schedule (cron). For each active
// campaign it advances due contacts on each inbox, respecting a warmup-safe
// per-inbox daily cap. Idempotent: safe to call as often as you like.
//
//   ACCOUNTS_FILE=... node scripts/orchestrator.mjs [--dry-run] [--ignore-window] [--campaign <name>]

import { start_campaign } from "../packages/toolkit/dist/index.js";
import {
  loadConfig, readJson, writeJson, appendJsonl, STATE_PATH, RUNLOG_PATH,
  tzParts, rampCap, inboxesForCampaign, argVal, cliInboxes,
} from "./_shared.mjs";

const DRY = process.argv.includes("--dry-run");
const IGNORE_WINDOW = process.argv.includes("--ignore-window");
const ONLY = argVal("--campaign");

const config = loadConfig();
const tz = config.timezone || "Europe/Paris";
const { dateStr, hour, dow } = tzParts(tz);

const sendDays = config.sendDays || [1, 2, 3, 4, 5];
const sh = config.sendHours || { start: 8, end: 18 };
if (!IGNORE_WINDOW && (!sendDays.includes(dow) || hour < sh.start || hour >= sh.end)) {
  console.log(`[orchestrator] ${dateStr} ${hour}h ${tz}: outside send window — no-op`);
  process.exit(0);
}

const cap = rampCap(config, dateStr);
const state = readJson(STATE_PATH, {});
if (!state[dateStr]) state[dateStr] = {};
const today = state[dateStr];

const campaigns = config.campaigns.filter((c) => c.active && (!ONLY || c.name === ONLY));
if (!campaigns.length) {
  console.log("[orchestrator] no active campaigns" + (ONLY ? ` matching "${ONLY}"` : ""));
  process.exit(0);
}

const only = cliInboxes();
const inboxSet = new Set();
for (const c of campaigns) {
  for (const ib of inboxesForCampaign(c, config)) {
    if (!only || only.includes(ib)) inboxSet.add(ib);
  }
}

const runTs = new Date().toISOString();
let totalSent = 0;
let totalErr = 0;

for (const inbox of inboxSet) {
  let remaining = cap - (today[inbox] || 0);
  if (remaining <= 0) continue;

  for (const c of campaigns) {
    if (remaining <= 0) break;
    if (!inboxesForCampaign(c, config).includes(inbox)) continue;

    let res;
    try {
      res = await start_campaign({
        email: inbox, campaign: c.name, max_sends: remaining, dry_run: DRY,
      });
    } catch (e) {
      totalErr++;
      const msg = String(e?.message || e).split("\n")[0];
      appendJsonl(RUNLOG_PATH, { ts: runTs, date: dateStr, inbox, campaign: c.name, dryRun: DRY, error: msg });
      console.log(`  ✖ ${inbox} / ${c.name}: ${msg}`);
      continue;
    }

    const sent = DRY ? (res.summary.wouldSend || 0) : (res.summary.sent || 0);
    const errs = res.summary.errors || 0;
    if (!DRY) today[inbox] = (today[inbox] || 0) + sent;
    remaining -= sent;
    totalSent += sent;
    totalErr += errs;

    appendJsonl(RUNLOG_PATH, { ts: runTs, date: dateStr, inbox, campaign: c.name, dryRun: DRY, sent, errors: errs, cap });
    if (sent || errs) {
      console.log(`  ${DRY ? "~" : "→"} ${inbox} / ${c.name}: ${sent} ${DRY ? "would-send" : "sent"}` +
        `${errs ? `, ${errs} err` : ""} (cap ${cap}, used ${today[inbox] || 0})`);
    }
  }
}

if (!DRY) writeJson(STATE_PATH, state);
console.log(`[orchestrator] ${DRY ? "DRY " : ""}done ${dateStr} ${hour}h ${tz} — ` +
  `${totalSent} ${DRY ? "would-send" : "sent"}, ${totalErr} err, cap/inbox=${cap}, inboxes=${inboxSet.size}`);
