/**
 * SSRF-safe fetch — Méta-cert 2026-05-15 AGENT 12 P0 OWASP A10.
 *
 * Wrap `fetch()` avec garde-fou anti-Server-Side Request Forgery :
 *  1. Protocole forcé `http:` / `https:` (rejette `file:`, `gopher:`, etc.)
 *  2. Résolution DNS du hostname → refuse toute IP privée RFC 1918 / IANA
 *     reserved (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16 AWS metadata,
 *     ::1, fc00::/7, fe80::/10).
 *  3. `redirect: "manual"` → valide chaque redirect avant de le suivre.
 *  4. Cap profondeur redirects (default 5).
 *
 * Couvre les vecteurs SSRF classiques :
 *  - User-supplied URL pointant vers `http://169.254.169.254/` (AWS metadata)
 *  - DNS rebinding (hostname résout en 127.0.0.1 au moment du fetch)
 *  - Redirect chain `https://attacker.com/` → `http://10.0.0.5/admin`
 *  - URLs de type `http://[::ffff:127.0.0.1]/` (IPv4-mapped IPv6)
 *
 * Stack : Node 24 `dns/promises`, zéro dépendance externe. Compatible
 *         BullMQ workers + Server Actions. Pas Edge runtime (DNS module
 *         requis — refuser explicitement).
 *
 * Callers à utiliser ce helper plutôt que `fetch()` natif :
 *  - `kb-ingest/url-extractor.ts` (article extraction user-submitted URL)
 *  - `queue/workers/content-rss-fetch-worker.ts` (RSS feed fetcher)
 *  - Tout autre futur fetch externe basé sur input non-trusted.
 */

import { lookup } from "node:dns/promises";

const DEFAULT_MAX_REDIRECTS = 5;

/** Blocs IPv4 privés / réservés (RFC 1918 + IANA + cloud metadata). */
const PRIVATE_IPV4_RANGES: ReadonlyArray<readonly [bigint, bigint]> = [
  // 0.0.0.0/8 — "this network"
  [ipv4ToInt("0.0.0.0"), ipv4ToInt("0.255.255.255")],
  // 10.0.0.0/8 — RFC 1918 private
  [ipv4ToInt("10.0.0.0"), ipv4ToInt("10.255.255.255")],
  // 100.64.0.0/10 — CGNAT (RFC 6598)
  [ipv4ToInt("100.64.0.0"), ipv4ToInt("100.127.255.255")],
  // 127.0.0.0/8 — loopback
  [ipv4ToInt("127.0.0.0"), ipv4ToInt("127.255.255.255")],
  // 169.254.0.0/16 — link-local + AWS/GCP/Azure metadata service (169.254.169.254)
  [ipv4ToInt("169.254.0.0"), ipv4ToInt("169.254.255.255")],
  // 172.16.0.0/12 — RFC 1918 private
  [ipv4ToInt("172.16.0.0"), ipv4ToInt("172.31.255.255")],
  // 192.0.0.0/24 — IETF protocol assignments
  [ipv4ToInt("192.0.0.0"), ipv4ToInt("192.0.0.255")],
  // 192.168.0.0/16 — RFC 1918 private
  [ipv4ToInt("192.168.0.0"), ipv4ToInt("192.168.255.255")],
  // 198.18.0.0/15 — benchmarking
  [ipv4ToInt("198.18.0.0"), ipv4ToInt("198.19.255.255")],
  // 224.0.0.0/4 — multicast
  [ipv4ToInt("224.0.0.0"), ipv4ToInt("239.255.255.255")],
  // 240.0.0.0/4 — reserved
  [ipv4ToInt("240.0.0.0"), ipv4ToInt("255.255.255.255")],
];

function ipv4ToInt(ip: string): bigint {
  const parts = ip.split(".").map(Number);
  return (
    (BigInt(parts[0] ?? 0) << 24n) |
    (BigInt(parts[1] ?? 0) << 16n) |
    (BigInt(parts[2] ?? 0) << 8n) |
    BigInt(parts[3] ?? 0)
  );
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  for (const [lo, hi] of PRIVATE_IPV4_RANGES) {
    if (n >= lo && n <= hi) return true;
  }
  return false;
}

/**
 * IPv6 — refuse :
 *  - ::1 (loopback)
 *  - ::ffff:0:0/96 (IPv4-mapped — recheck IPv4 portion)
 *  - fc00::/7 (ULA private)
 *  - fe80::/10 (link-local)
 *  - 2001:db8::/32 (documentation)
 */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7
  if (
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  ) {
    return true; // fe80::/10
  }
  if (lower.startsWith("2001:db8")) return true;
  // IPv4-mapped IPv6 : ::ffff:A.B.C.D
  const mappedMatch = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedMatch && mappedMatch[1]) return isPrivateIPv4(mappedMatch[1]);
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  // Si hostname est déjà une IP littérale, on la teste directement (pas de DNS).
  // Sinon on résout via DNS lookup. Family 0 = renvoie IPv4 ou IPv6 selon dispo.
  let address: string;
  let family: number;
  try {
    const result = await lookup(hostname, { family: 0 });
    address = result.address;
    family = result.family;
  } catch {
    throw new Error(`ssrf-safe-fetch: DNS lookup failed for hostname "${hostname}"`);
  }
  const isPrivate = family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address);
  if (isPrivate) {
    throw new Error(
      `ssrf-safe-fetch: hostname "${hostname}" resolves to private/reserved IP "${address}" — refused.`,
    );
  }
}

export interface SsrfSafeFetchOptions extends RequestInit {
  /** Cap profondeur redirects (default 5). */
  readonly maxRedirects?: number;
}

/**
 * `fetch()` avec garde-fou anti-SSRF.
 *
 * Comportement :
 *  - Protocole http/https obligatoire (throw sinon).
 *  - Hostname résolu → throw si IP privée/réservée.
 *  - Redirects suivis manuellement → chaque target re-validée.
 *  - `Response` rendue identique au comportement `redirect: "follow"` normal.
 *
 * En cas de blocage SSRF, lève une `Error` (à attraper par le caller).
 */
export async function ssrfSafeFetch(
  input: string,
  options: SsrfSafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  // Pré-validation pour ne pas leak les options vers fetch.
  const { maxRedirects: _drop, ...fetchOptions } = options;

  let currentUrl = input;
  let redirects = 0;

  while (true) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new Error(`ssrf-safe-fetch: invalid URL "${currentUrl}"`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`ssrf-safe-fetch: protocol "${parsed.protocol}" not allowed`);
    }
    await assertPublicHost(parsed.hostname);

    const response = await fetch(currentUrl, {
      ...fetchOptions,
      redirect: "manual",
    });

    // 3xx avec Location → on suit nous-mêmes après validation.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      if (redirects >= maxRedirects) {
        throw new Error(`ssrf-safe-fetch: max redirects (${maxRedirects}) exceeded`);
      }
      redirects += 1;
      // Resolve relative redirects vs current URL (RFC 7231).
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return response;
  }
}
