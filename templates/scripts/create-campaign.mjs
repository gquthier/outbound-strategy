// Creates a campaign (same name + audience segment) on each inbox, from a
// sequence JSON file. Each inbox then sends to the contacts enrolled on it.
//
//   ACCOUNTS_FILE=... node scripts/create-campaign.mjs --campaign <name> --sequence <seq.json>

import { readFileSync } from "node:fs";
import { create_campaign } from "../packages/toolkit/dist/index.js";
import { loadConfig, inboxesForCampaign, argVal, cliInboxes } from "./_shared.mjs";

const name = argVal("--campaign");
const seqPath = argVal("--sequence");
if (!name || !seqPath) {
  console.error("Usage: node scripts/create-campaign.mjs --campaign <name> --sequence <seq.json>");
  process.exit(1);
}

const sequence = JSON.parse(readFileSync(seqPath, "utf-8"));
const config = loadConfig();
const camp = config.campaigns.find((c) => c.name === name) || { name };
const inboxes = cliInboxes() || inboxesForCampaign(camp, config);

for (const inbox of inboxes) {
  try {
    const res = await create_campaign({ email: inbox, name, audience_segment: name, sequence });
    console.log(`  ✓ ${inbox.padEnd(40)} "${name}" — ${res.steps} steps, ${res.totalVariants} variants`);
  } catch (e) {
    console.log(`  ✖ ${inbox.padEnd(40)} ${String(e?.message || e).split("\n")[0]}`);
  }
}
console.log(`Created/updated "${name}" on ${inboxes.length} inboxes.`);
