/**
 * Prospection — Clé de déduplication d'une personne (T5, pur).
 *
 * `personKey` = normalisation canonique de (nom + prénoms) **SANS la fonction**
 * (01-DATA-MODEL P0-4 : la fonction est multi-valuée → l'inclure créait de faux
 * doublons). Accents/casse retirés, prénoms triés (ordre indifférent).
 * Contrainte DB : UNIQUE(companyId, personKey). Même personne sur 2 entreprises
 * = 2 lignes reliées par `personKey` (jamais fusionnées).
 */

function normalizeToken(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Clé canonique (nom|prénoms triés). Déterministe, stable. */
export function personKey(nom: string, prenoms?: string | null): string {
  const nomN = normalizeToken(nom).replace(/\s+/g, "");
  const prenomTokens = normalizeToken(prenoms ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .sort();
  return `${nomN}|${prenomTokens.join(" ")}`;
}

/** Sépare un « nom complet » scrapé en {prenoms, nom} (heuristique FR : dernier mot = nom). */
export function splitFullName(full: string): { prenoms: string; nom: string } {
  const tokens = full.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { prenoms: "", nom: "" };
  if (tokens.length === 1) return { prenoms: "", nom: tokens[0] as string };
  // Heuristique : un nom en MAJUSCULES est le nom de famille (convention FR).
  const upper = tokens.filter((t) => t === t.toUpperCase() && /[A-ZÀ-Ÿ]/.test(t));
  if (upper.length >= 1 && upper.length < tokens.length) {
    const nom = upper.join(" ");
    const prenoms = tokens.filter((t) => !upper.includes(t)).join(" ");
    return { prenoms, nom };
  }
  // Défaut : dernier token = nom.
  const nom = tokens[tokens.length - 1] as string;
  const prenoms = tokens.slice(0, -1).join(" ");
  return { prenoms, nom };
}
