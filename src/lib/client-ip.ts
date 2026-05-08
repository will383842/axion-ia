// Helper centralise getClientIp() — Sprint 15 fix Fork 3 W2-3.
//
// Avant : duplique dans 6 fichiers, x-forwarded-for accepte brut (spoofable
// hors trusted proxy). Ce module valide :
//   1. x-forwarded-for SEULEMENT si la requete vient d'un proxy de confiance
//      (Cloudflare/Coolify Caddy local en prod ; tout permis en dev).
//   2. Sinon fallback sur x-real-ip (Caddy/nginx pose ce header).
//   3. Sinon "unknown".

import { headers } from "next/headers";

/** IP des proxies de confiance (Caddy local + Cloudflare ranges resumes V1). */
const TRUSTED_PROXY_PREFIXES: ReadonlyArray<string> = [
  "127.", // loopback (Caddy reverse-proxy local Coolify)
  "10.", // private (Coolify internal network)
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.",
  "::1",
  "fc00:", // ULA private
];

const isProd = process.env.NODE_ENV === "production";

function isTrustedSource(remoteAddr: string | null): boolean {
  if (!isProd) return true; // dev/staging : on fait confiance
  if (!remoteAddr) return false;
  return TRUSTED_PROXY_PREFIXES.some((p) => remoteAddr.startsWith(p));
}

/**
 * Extrait l'IP client depuis les headers Next.js (Server Action / Server Comp).
 * En prod, exige que le proxy upstream soit dans la liste de confiance.
 * En dev, accepte n'importe quel x-forwarded-for (utile pour test local).
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  // remoteAddr du proxy direct (set par Caddy/Coolify via X-Real-IP ou socket)
  const remoteAddr = h.get("x-real-ip");

  if (isTrustedSource(remoteAddr)) {
    const fwd = h.get("x-forwarded-for");
    if (fwd) {
      const first = fwd.split(",")[0]?.trim();
      if (first) return first;
    }
  }
  return remoteAddr ?? "unknown";
}
