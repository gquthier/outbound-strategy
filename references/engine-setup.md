# Engine setup

The engine is the open-source **[outbound-tools](https://github.com/arnaudjnn/outbound-tools)**
MCP server (TypeScript, IMAP/SMTP, no database). It ships coupled to a paid inbox broker.
We decouple it to run on **your own** SMTP/IMAP credentials.

## 1. Clone & inspect

```bash
git clone https://github.com/arnaudjnn/outbound-tools.git
cd outbound-tools
```

Layout: `packages/toolkit` (core: `smtp.ts`, `imap.ts`, `functions.ts`, the broker client),
`packages/api` (MCP server + REST), `packages/cli`.

## 2. Decouple from the broker (one file)

The broker is only an **account-credentials provider** — three functions returning a
`MailboxDetails` shape (host/port/user/pass for SMTP + IMAP). Replace it with a local
provider that reads `accounts.json`:

1. Add **`templates/scripts/accounts.ts`** as `packages/toolkit/src/accounts.ts`.
2. Repoint the two imports from `./mailpool.js` → `./accounts.js`
   (in `functions.ts` and `index.ts`), then delete `mailpool.ts`.
3. In `config.ts`, drop the required `MAILPOOL_API_KEY`; add optional `ACCOUNTS_FILE`.

Everything downstream consumes `MailboxDetails`, so the SMTP/IMAP code is untouched.

## 3. Two gotchas every self-hoster hits

**TLS apex-cert mismatch.** Many inbox providers serve a certificate for the *apex* domain
(`yourdomain.com`) while you connect to `smtp.`/`imap.` subdomains → Node rejects the cert.
Fix it the secure way (don't disable verification): validate against the apex.
Add **`templates/scripts/tls.ts`** as `packages/toolkit/src/tls.ts` and wire it into the
SMTP transport and the IMAP client:

```ts
// smtp.ts — nodemailer transport
tls: { servername: tlsServerName(mailbox.smtpHost),
       checkServerIdentity: checkServerIdentityHostOrApex(mailbox.smtpHost) }
// imap.ts — ImapFlow client
servername: tlsServerName(mailbox.imapHost),
tls: { checkServerIdentity: checkServerIdentityHostOrApex(mailbox.imapHost) },
```

**Fresh inboxes have no `Sent`/`Drafts` folders.** New mailboxes ship with only `INBOX`, so
appending a sent copy or a campaign draft fails (`TRYCREATE`). Make the IMAP helpers create
the folder if missing (`ensureMailbox(client, path)` before every append/lock), and add
robustness to the IMAP client so one slow inbox can't crash a run:

```ts
const client = new ImapFlow({ /* ... */, connectionTimeout: 30000, greetingTimeout: 20000, socketTimeout: 300000 });
client.on("error", () => {}); // unhandled 'error' events would kill the process
```

## 4. Connect your inboxes

Create `accounts.json` from **`templates/accounts.example.json`** (one entry per inbox:
email, password, imapHost/Port, smtpHost/Port, optional `maxEmailPerDay`). Keep it out of
git. Point `ACCOUNTS_FILE` at it in `.env.local`.

> Migrating from a SaaS? Most export a bulk CSV of inboxes — write a tiny importer to map
> its columns to `accounts.json`.

## 5. Build & verify

```bash
pnpm install && pnpm build
node test-connections.mjs ./accounts.json    # SMTP auth + IMAP login on every inbox
```

All inboxes must show `SMTP ✅ IMAP ✅` before you go further. Then bootstrap folders
(create `Sent`/`Drafts` on each inbox) and you're ready to enroll leads.
