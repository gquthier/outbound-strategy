// Shared helpers for the orchestration scripts.
import {
  readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA = join(ROOT, "data");
export const CONFIG_PATH = process.env.ORCH_CONFIG || join(ROOT, "orchestrator.config.json");
export const STATE_PATH = join(DATA, "orchestrator-state.json");
export const RUNLOG_PATH = join(DATA, "run-log.jsonl");

export function ensureData() {
  if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });
}
export function readJson(p, d) {
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return d; }
}
export function writeJson(p, o) {
  ensureData();
  writeFileSync(p, JSON.stringify(o, null, 2));
}
export function appendJsonl(p, o) {
  ensureData();
  appendFileSync(p, JSON.stringify(o) + "\n");
}

export function loadConfig() {
  const c = readJson(CONFIG_PATH, null);
  if (!c) throw new Error(`Missing ${CONFIG_PATH}`);
  return c;
}
export function loadAccounts() {
  const f = process.env.ACCOUNTS_FILE;
  if (!f) throw new Error("ACCOUNTS_FILE not set");
  return JSON.parse(readFileSync(f, "utf-8")).accounts;
}
export function allInboxes() {
  return loadAccounts().map((a) => a.email);
}

// Current date/hour/day-of-week in a given timezone.
export function tzParts(tz) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false, weekday: "short",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
  return { dateStr: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, dow };
}

// Warmup-safe per-inbox daily cap based on weeks since startDate.
export function rampCap(config, dateStr) {
  const r = config.ramp || {};
  const start = r.startPerInbox ?? 10;
  const step = r.stepPerWeek ?? 5;
  const max = r.maxPerInbox ?? 20;
  if (!r.startDate) return max;
  const t0 = new Date(r.startDate + "T00:00:00Z").getTime();
  const t = new Date(dateStr + "T00:00:00Z").getTime();
  const weeks = Math.max(0, Math.floor((t - t0) / (7 * 24 * 3600 * 1000)));
  return Math.min(max, start + step * weeks);
}

export function inboxesForCampaign(camp, config) {
  if (camp.inboxes && camp.inboxes.length) return camp.inboxes;
  if (config.inboxes && config.inboxes.length) return config.inboxes;
  return allInboxes();
}

export function argVal(name, def = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}

// Optional `--inboxes a@x,b@y` override (subset / single-inbox testing).
export function cliInboxes() {
  const v = argVal("--inboxes");
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null;
}
