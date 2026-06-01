// Verify SMTP auth + IMAP login for every inbox in accounts.json.
// Sends NO email. Never prints passwords. Self-contained (only needs
// imapflow + nodemailer, which the outbound-tools engine already installs).
//
//   node test-connections.mjs ./accounts.json

import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

const accounts = JSON.parse(readFileSync(process.argv[2] || "./accounts.json", "utf-8")).accounts;
const firstLine = (e) => String((e && e.message) || e).split("\n")[0];

// Many cold-email inbox providers issue a cert for the APEX domain only, while
// inboxes are reached via smtp./imap. subdomains → validate against the apex.
function serverName(host) {
  const p = host.split(".");
  return (p.length > 2 && ["smtp", "imap", "mail", "mx", "pop"].includes(p[0])) ? p.slice(1).join(".") : host;
}

let smtpOk = 0, imapOk = 0;
for (const a of accounts) {
  let s, i;
  try {
    await nodemailer.createTransport({
      host: a.smtpHost, port: a.smtpPort, secure: a.smtpPort === 465,
      auth: { user: a.email, pass: a.password },
      tls: { servername: serverName(a.smtpHost) },
      connectionTimeout: 20000, greetingTimeout: 20000,
    }).verify();
    s = "SMTP ✅"; smtpOk++;
  } catch (e) { s = `SMTP ❌ ${firstLine(e)}`; }
  let client;
  try {
    client = new ImapFlow({
      host: a.imapHost, port: a.imapPort, secure: a.imapPort === 993,
      servername: serverName(a.imapHost),
      auth: { user: a.email, pass: a.password }, logger: false,
    });
    await client.connect(); await client.logout();
    i = "IMAP ✅"; imapOk++;
  } catch (e) { i = `IMAP ❌ ${firstLine(e)}`; try { await client?.close?.(); } catch {} }
  console.log(`${a.email.padEnd(42)} ${s.padEnd(18)} ${i}`);
}
console.log(`\n${smtpOk}/${accounts.length} SMTP · ${imapOk}/${accounts.length} IMAP`);
process.exit(smtpOk === accounts.length && imapOk === accounts.length ? 0 : 1);
