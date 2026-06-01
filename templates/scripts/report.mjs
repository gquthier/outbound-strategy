// Builds a daily execution + performance summary across active campaigns and
// sends it to Telegram (if TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID are set).
// Includes a deliverability alert if bounce rate or errors spike.
//
//   ACCOUNTS_FILE=... node scripts/report.mjs

import { readFileSync } from "node:fs";
import { get_campaign_analytics } from "../packages/toolkit/dist/index.js";
import { loadConfig, inboxesForCampaign, RUNLOG_PATH, tzParts } from "./_shared.mjs";

const config = loadConfig();
const tz = config.timezone || "Europe/Paris";
const { dateStr } = tzParts(tz);

// today's executed sends from the run log
let log = [];
try {
  log = readFileSync(RUNLOG_PATH, "utf-8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
} catch {}
const today = log.filter((e) => e.date === dateStr && !e.dryRun);
const sentToday = today.reduce((s, e) => s + (e.sent || 0), 0);
const errToday = today.reduce((s, e) => s + (e.errors || 0) + (e.error ? 1 : 0), 0);

const lines = [];
let totSent = 0, totBounced = 0;
for (const c of config.campaigns.filter((c) => c.active)) {
  let sent = 0, replied = 0, interested = 0, meeting = 0, bounced = 0;
  for (const inbox of inboxesForCampaign(c, config)) {
    try {
      const a = await get_campaign_analytics({ email: inbox, campaign: c.name });
      sent += a.totalSent || 0;
      replied += a.totalReplied || 0;
      interested += a.statuses?.interested || 0;
      meeting += a.statuses?.meeting_request || 0;
      bounced += a.statuses?.bounced || 0;
    } catch {}
  }
  totSent += sent; totBounced += bounced;
  const rr = sent ? ((replied / sent) * 100).toFixed(1) : "0.0";
  lines.push(`• ${c.name}: ${sent} envoyés · ${replied} rép. (${rr}%) · 🔥${interested} interested · 📅${meeting} RDV · ⚠️${bounced} bounce`);
}

const bounceRate = totSent ? (totBounced / totSent) * 100 : 0;
const alert = (bounceRate > 3 || errToday > 10)
  ? `\n\n🚨 ALERTE: bounce ${bounceRate.toFixed(1)}% · ${errToday} err aujourd'hui — vérifier la deliverability.`
  : "";

const msg =
  `📬 Outbound — ${dateStr}\n` +
  `Aujourd'hui : ${sentToday} envoyés${errToday ? ` · ${errToday} err` : ""}\n` +
  `\nCumul campagnes :\n${lines.join("\n") || "  (aucune campagne active)"}${alert}`;

console.log(msg);

const TG = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
if (TG && CHAT) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text: msg }),
    });
    console.log(`\n[telegram] ${r.status}`);
  } catch (e) {
    console.log(`\n[telegram] failed: ${String(e?.message || e)}`);
  }
} else {
  console.log("\n[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — printed only");
}
