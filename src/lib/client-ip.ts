// Helper centralise getClientIp() — Sprint 15 fix Fork 3 W2-3.
//
// Avant : duplique dans 6 fichiers, x-forwarded-for accepte brut (spoofable
// hors trusted proxy). Ce module valide :
//   0. `cf-connecting-ip` SEULEMENT si la connexion vient d'une plage Cloudflare
//      (cf. le bloc 🔴 ci-dessous) ;
//   1. x-forwarded-for SEULEMENT si la requete vient d'un proxy de confiance
//      (Coolify local en prod ; tout permis en dev).
//   2. Sinon fallback sur x-real-ip (Traefik pose ce header).
//   3. Sinon "unknown".
//
// ── 🔴 2026-09-25 : CE MODULE RENDAIT L'IP DE CLOUDFLARE, PAS CELLE DU VISITEUR ──
//
// Mesuré en production : un envoi fait depuis 37.65.10.24 a été enregistré sous
// 162.159.122.108 — une adresse Cloudflare. La chaîne réelle est :
//
//     visiteur → Cloudflare → Traefik (coolify-proxy) → Next
//
// Traefik n'a AUCUNE plage de confiance configurée (`forwardedHeaders`) : il
// pose `x-real-ip` = l'adresse qui lui parle, donc le relais Cloudflare, et
// remplace `x-forwarded-for` par cette même adresse. Aucune n'est privée,
// l'étape 1 ne s'appliquait jamais, et l'étape 2 rendait Cloudflare.
//
// Conséquence : chaque limite de débit « N envois par IP » comptait PAR RELAIS
// CLOUDFLARE — des visiteurs sans rapport se partageaient un même quota, et un
// visiteur bloqué l'était quel que soit son navigateur. Les empreintes d'IP et
// les journaux d'audit ne désignaient personne.
//
// Seul `cf-connecting-ip` porte l'adresse du visiteur. MAIS le serveur répond
// aussi en direct, sans Cloudflare (vérifié : HTTPS sur 178.105.55.15 → 200).
// Cet en-tête est donc FORGEABLE par quiconque contourne Cloudflare. On ne le
// croit que si la connexion elle-même (`x-real-ip`, que Traefik écrase toujours)
// provient d'une plage publiée par Cloudflare. Sinon, on garde l'adresse de
// connexion — qui est alors, justement, celle du visiteur.

import { headers } from "next/headers";

/** IP des proxies de confiance (Coolify local : loopback + réseaux privés). */
const TRUSTED_PROXY_PREFIXES: ReadonlyArray<string> = [
  "127.", // loopback
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

/**
 * Plages publiées par Cloudflare — https://www.cloudflare.com/ips-v4 et /ips-v6,
 * relevées le 2026-09-25. Elles changent rarement ; si Cloudflare en ajoute une,
 * le seul effet est que les visiteurs servis par cette plage retombent sur
 * l'adresse du relais (l'état d'avant ce correctif), jamais une ouverture.
 */
export const CLOUDFLARE_RANGES: ReadonlyArray<string> = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

const isProd = process.env.NODE_ENV === "production";

/** Adresse IPv4 ou IPv6 → entier + largeur en bits, ou null si illisible. */
function versEntier(ip: string): { valeur: bigint; bits: 32 | 128 } | null {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    if (octets.some((o) => o > 255)) return null;
    return { valeur: octets.reduce((acc, o) => (acc << 8n) | BigInt(o), 0n), bits: 32 };
  }
  if (!ip.includes(":") || ip.includes(".")) return null;
  const moities = ip.toLowerCase().split("::");
  if (moities.length > 2) return null;
  const gauche = moities[0] ? moities[0].split(":") : [];
  const droite = moities.length === 2 && moities[1] ? moities[1].split(":") : [];
  const manquants = 8 - gauche.length - droite.length;
  if (moities.length === 1 ? manquants !== 0 : manquants < 1) return null;
  const groupes = [
    ...gauche,
    ...Array<string>(moities.length === 2 ? manquants : 0).fill("0"),
    ...droite,
  ];
  if (groupes.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return {
    valeur: groupes.reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n),
    bits: 128,
  };
}

/** L'adresse appartient-elle à la plage CIDR ? Faux pour toute entrée illisible. */
export function dansLaPlage(ip: string, cidr: string): boolean {
  const [reseau, longueurTexte] = cidr.split("/");
  const a = versEntier(ip.trim());
  const r = reseau ? versEntier(reseau) : null;
  const longueur = Number(longueurTexte);
  if (!a || !r || a.bits !== r.bits || !Number.isInteger(longueur)) return false;
  if (longueur < 0 || longueur > a.bits) return false;
  const decalage = BigInt(a.bits - longueur);
  return a.valeur >> decalage === r.valeur >> decalage;
}

export function estUnRelaisCloudflare(ip: string | null): boolean {
  return !!ip && CLOUDFLARE_RANGES.some((plage) => dansLaPlage(ip, plage));
}

function isTrustedSource(remoteAddr: string | null): boolean {
  if (!isProd) return true; // dev/staging : on fait confiance
  if (!remoteAddr) return false;
  return TRUSTED_PROXY_PREFIXES.some((p) => remoteAddr.startsWith(p));
}

/**
 * Résout l'IP du visiteur à partir des en-têtes. Séparée de `getClientIp` pour
 * être testable sans le contexte de requête de Next.
 */
export function ipDepuisEntetes(h: Pick<Headers, "get">): string {
  // remoteAddr = l'adresse qui parle à Traefik (écrasée par lui, non forgeable)
  const remoteAddr = h.get("x-real-ip")?.trim() || null;

  // 0. Derrière Cloudflare : seul `cf-connecting-ip` désigne le visiteur, et on
  //    ne le croit que si la connexion vient VRAIMENT de Cloudflare.
  if (estUnRelaisCloudflare(remoteAddr)) {
    const cf = h.get("cf-connecting-ip")?.trim();
    if (cf && versEntier(cf)) return cf;
  }

  if (isTrustedSource(remoteAddr)) {
    const fwd = h.get("x-forwarded-for");
    if (fwd) {
      const first = fwd.split(",")[0]?.trim();
      if (first) return first;
    }
  }
  return remoteAddr ?? "unknown";
}

/**
 * Extrait l'IP client depuis les headers Next.js (Server Action / Server Comp).
 * En prod, exige que le proxy upstream soit dans la liste de confiance.
 * En dev, accepte n'importe quel x-forwarded-for (utile pour test local).
 */
export async function getClientIp(): Promise<string> {
  return ipDepuisEntetes(await headers());
}

/** Agent du navigateur (Server Action), pour le contexte d'une preuve de consentement. */
export async function getClientUserAgent(): Promise<string | null> {
  const ua = (await headers()).get("user-agent");
  return ua ? ua.slice(0, 500) : null;
}
