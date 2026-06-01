// Ensures standard IMAP folders (Sent, Drafts) exist on every inbox.
// Fresh cold-email inboxes often ship with only INBOX. Self-contained.
//
//   node bootstrap-folders.mjs ./accounts.json

import { readFileSync } from "node:fs";
import { ImapFlow } from "imapflow";

const accounts = JSON.parse(readFileSync(process.argv[2] || "./accounts.json", "utf-8")).accounts;
const WANT = ["Sent", "Drafts"];
function serverName(host) {
  const p = host.split(".");
  return (p.length > 2 && ["smtp", "imap", "mail", "mx", "pop"].includes(p[0])) ? p.slice(1).join(".") : host;
}

for (const a of accounts) {
  const c = new ImapFlow({
    host: a.imapHost, port: a.imapPort, secure: a.imapPort === 993,
    servername: serverName(a.imapHost),
    auth: { user: a.email, pass: a.password }, logger: false,
  });
  await c.connect();
  const have = (await c.list()).map((f) => f.path);
  const made = [];
  for (const f of WANT) {
    if (!have.includes(f)) { try { await c.mailboxCreate(f); made.push(f); } catch {} }
  }
  console.log(`${a.email.padEnd(42)} ${[...new Set([...have, ...made])].join(", ")}${made.length ? `  (+${made.join(", ")})` : ""}`);
  await c.logout();
}
