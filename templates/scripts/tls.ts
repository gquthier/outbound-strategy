import tls from "node:tls";

// Registrable apex for a mail host. Strips a leading service label
// (smtp./imap./mail./mx./pop.) when present:
//   imap.acme.com  -> acme.com
//   smtp.gmail.com -> gmail.com
//   acme.com       -> acme.com
export function tlsServerName(host: string): string {
  const parts = host.split(".");
  const svc = ["smtp", "imap", "mail", "mx", "pop", "pop3", "submission"];
  if (parts.length > 2 && svc.includes(parts[0].toLowerCase())) {
    return parts.slice(1).join(".");
  }
  return host;
}

// Returns a checkServerIdentity function that accepts a certificate valid for
// EITHER the connection host or its registrable apex.
//
// Certificate-chain validation is still enforced by the TLS layer
// (rejectUnauthorized stays true) — only the hostname identity check is
// widened. This supports cold-email inbox providers whose certificate covers
// the apex domain (e.g. example.com) while each inbox is reached via
// an smtp./imap. subdomain, without weakening security against MITM (a valid
// CA-signed cert for the apex is still required).
export function checkServerIdentityHostOrApex(host: string) {
  const apex = tlsServerName(host);
  return (
    _servername: string,
    cert: tls.PeerCertificate
  ): Error | undefined => {
    const direct = tls.checkServerIdentity(host, cert);
    if (!direct) return undefined;
    if (apex !== host) {
      const viaApex = tls.checkServerIdentity(apex, cert);
      if (!viaApex) return undefined;
    }
    return direct;
  };
}
