// /.well-known/security.txt — RFC 9116 security disclosure policy.
//
// Référentiel : https://www.rfc-editor.org/rfc/rfc9116
// Permet aux chercheurs en sécurité de trouver le contact responsable en cas
// de découverte de vulnérabilité (signal de maturité sécurité pour scanners
// + bug bounty platforms).

const SECURITY_TXT = `Contact: mailto:contact@axion-ia.com
Expires: 2027-05-16T23:59:59.000Z
Preferred-Languages: fr, en
Canonical: https://axion-ia.com/.well-known/security.txt
Policy: https://axion-ia.com/fr/politique-confidentialite
`;

export const dynamic = "force-static";
export const revalidate = false;

export function GET(): Response {
  return new Response(SECURITY_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
