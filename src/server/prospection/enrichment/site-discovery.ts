/**
 * Prospection — Découverte du site web d'une entreprise (T5, production).
 *
 * Le Stock Sirene ne contient AUCUNE URL. Sans site, l'enrichissement (emails/
 * responsables) ne produit rien (vérif backend). On DEVINE des domaines candidats
 * à partir de la dénomination (slug + TLD .fr/.com), on récupère la page d'accueil
 * et on ne RETIENT le domaine QUE si `confirmDomainOwnership` valide (SIREN ou
 * dénomination sur la page) — jamais un domaine parked/homonyme. 100 % gratuit,
 * borné (peu de candidats), robots respecté en aval par l'enrichissement.
 */

import { confirmDomainOwnership } from "./domain-confirm";
import type { EnrichPage } from "./enrich-service";

// Mots à ne pas injecter dans un domaine (formes juridiques / génériques).
const STOP = new Set([
  "sarl",
  "sas",
  "sasu",
  "sa",
  "eurl",
  "sci",
  "scop",
  "snc",
  "selarl",
  "selas",
  "et",
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "aux",
  "au",
  "groupe",
  "holding",
]);

export function slugifyName(denomination: string): string {
  return denomination
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Génère les domaines candidats (bornés) à partir de la dénomination. */
export function candidateDomains(denomination: string | null | undefined): string[] {
  if (!denomination) return [];
  const words = slugifyName(denomination)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
  if (words.length === 0) return [];
  const joined = words.join(""); // isereconstruction
  const hyphen = words.join("-"); // isere-construction
  const bases = [...new Set([joined, hyphen])];
  const tlds = [".fr", ".com"];
  const out: string[] = [];
  for (const b of bases) for (const t of tlds) out.push(`https://${b}${t}`);
  return out.slice(0, 4); // plafond dur (au plus 4 essais HTTP par entreprise)
}

/**
 * Tente de découvrir + confirmer le site d'une entreprise. Retourne l'URL
 * confirmée (SIREN/dénomination présents), ou null. `fetchPage` injecté (testable,
 * rate-limité/robots en amont par l'appelant).
 */
export async function discoverSiteWeb(
  company: { siren: string; denomination?: string | null },
  fetchPage: (url: string) => Promise<EnrichPage | null>,
): Promise<string | null> {
  for (const url of candidateDomains(company.denomination)) {
    let res: EnrichPage | null;
    try {
      res = await fetchPage(url);
    } catch {
      continue;
    }
    if (!res || !res.ok || !res.text) continue;
    if (confirmDomainOwnership(res.text, company).confirmed) return url;
  }
  return null;
}
