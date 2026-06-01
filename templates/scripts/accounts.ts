import { readFileSync } from "node:fs";
import { z } from "zod";
import type { Mailbox, MailboxDetails, Domain } from "./types.js";

// Local, self-hosted account provider.
//
// Replaces the original Mailpool API client: instead of fetching mailbox
// credentials from an external SaaS, we load them from a local JSON file
// pointed to by the ACCOUNTS_FILE env var. Each entry is mapped to the same
// `MailboxDetails` shape the rest of the toolkit consumes, so all SMTP/IMAP
// logic stays untouched.
//
// See accounts.example.json for the file format.

const AccountSchema = z.object({
  email: z.string().email(),
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  password: z.string().min(1),
  imapHost: z.string().min(1),
  imapPort: z.number().int().positive().default(993),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().positive().default(587),
  // Optional — consumed by higher-level rotation / daily-cap logic, not by
  // the SMTP/IMAP transports themselves.
  maxEmailPerDay: z.number().int().positive().optional(),
  domain: z.string().optional(),
});

const AccountsFileSchema = z.object({
  accounts: z.array(AccountSchema).min(1, "accounts must contain at least one entry"),
});

export type Account = z.infer<typeof AccountSchema>;

let cache: MailboxDetails[] | null = null;

function buildDomain(id: number, domainName: string): Domain {
  return {
    id,
    createdAt: "",
    expireAt: "",
    domain: domainName,
    domainOwner: {
      id,
      company: "",
      firstName: "",
      lastName: "",
      email: "",
      streetAddress1: "",
      streetAddress2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    },
    redirectUrl: "",
    type: "custom",
    status: "active",
  };
}

function toMailboxDetails(account: Account, index: number): MailboxDetails {
  const id = index + 1;
  const domainName = account.domain ?? account.email.split("@")[1] ?? "";
  return {
    id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    status: "active",
    domain: buildDomain(id, domainName),
    signature: "",
    forwardTo: "",
    password: account.password,
    avatar: "",
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapTLS: account.imapPort === 993, // 993 = implicit TLS
    imapUsername: account.email,
    imapPassword: account.password,
    smtpHost: account.smtpHost,
    smtpPort: account.smtpPort,
    smtpTLS: account.smtpPort === 465, // 465 = implicit TLS, 587 = STARTTLS
    smtpUsername: account.email,
    smtpPassword: account.password,
    type: "smtp",
    isAdmin: false,
  };
}

function loadAccounts(): MailboxDetails[] {
  if (cache) return cache;

  const file = process.env.ACCOUNTS_FILE;
  if (!file) {
    throw new Error(
      "ACCOUNTS_FILE is not set. Point it at your accounts JSON file (see accounts.example.json)."
    );
  }

  let raw: string;
  try {
    raw = readFileSync(file, "utf-8");
  } catch (error) {
    throw new Error(
      `Could not read ACCOUNTS_FILE at "${file}": ${(error as Error).message}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `ACCOUNTS_FILE at "${file}" is not valid JSON: ${(error as Error).message}`
    );
  }

  const data = AccountsFileSchema.parse(parsed);
  cache = data.accounts.map(toMailboxDetails);
  return cache;
}

export async function listMailboxes(): Promise<Mailbox[]> {
  return loadAccounts().map((m) => ({
    id: m.id,
    email: m.email,
    firstName: m.firstName,
    lastName: m.lastName,
    status: m.status,
    domain: m.domain,
  }));
}

export async function getMailboxById(id: number): Promise<MailboxDetails> {
  const mailbox = loadAccounts().find((m) => m.id === id);
  if (!mailbox) throw new Error(`Mailbox not found for id: ${id}`);
  return mailbox;
}

export async function getMailboxByEmail(email: string): Promise<MailboxDetails> {
  const mailbox = loadAccounts().find(
    (m) => m.email.toLowerCase() === email.toLowerCase()
  );
  if (!mailbox) throw new Error(`Mailbox not found for email: ${email}`);
  return mailbox;
}
