/**
 * Qualiopi — Référentiel OPCO (module PUR, Lot 5).
 *
 * Liste canonique des 11 OPCO agréés + libellés d'affichage + garde de type.
 * Aucun import Prisma/next : importable par seeds, tests, UI et workers.
 *
 * ⚠️ Les identifiants DOIVENT rester identiques à l'enum Prisma `Opco` et aux
 * valeurs émises par `inferOpcoFromNaf` (naf-opco.ts). Les 5 premiers
 * (atlas, akto, opco2i, constructys, opcommerce) sont déjà en base via
 * `Client.opcoIdentifie` — ne PAS les renommer.
 */

/** Les 11 OPCO agréés (2026). Ordre d'affichage. */
export const OPCO_IDS = [
  "atlas",
  "opco_ep",
  "akto",
  "opco2i",
  "mobilites",
  "afdas",
  "uniformation",
  "ocapiat",
  "constructys",
  "opcommerce",
  "opco_sante",
] as const;

export type OpcoId = (typeof OPCO_IDS)[number];

/** Libellés d'affichage FR (SERP/console). */
export const OPCO_LABELS: Record<OpcoId, string> = {
  atlas: "Atlas",
  opco_ep: "OPCO EP",
  akto: "Akto",
  opco2i: "OPCO 2i",
  mobilites: "OPCO Mobilités",
  afdas: "Afdas",
  uniformation: "Uniformation",
  ocapiat: "Ocapiat",
  constructys: "Constructys",
  opcommerce: "OPCOMMERCE",
  opco_sante: "OPCO Santé",
};

/** Garde de type : vrai si la chaîne est un identifiant OPCO connu. */
export function isOpcoId(value: string | null | undefined): value is OpcoId {
  return value != null && (OPCO_IDS as readonly string[]).includes(value);
}

/** Libellé d'affichage ; renvoie la chaîne brute si l'OPCO est inconnu. */
export function opcoLabel(id: string | null | undefined): string {
  return isOpcoId(id) ? OPCO_LABELS[id] : (id ?? "—");
}

/**
 * Un barème est « périmé » si son relevé portail (`releveLe`) date de plus de
 * `moisValidite` mois par rapport à `now`. Un barème sans `releveLe` est traité
 * comme périmé (relevé jamais horodaté → non fiable pour un auditeur).
 *
 * Module pur : réutilisé par l'alerte `bareme_opco_perime` et par le badge UI.
 */
export function estBaremePerime(
  releveLe: Date | null | undefined,
  moisValidite: number,
  now: Date = new Date(),
): boolean {
  if (releveLe == null) return true;
  const seuil = new Date(now);
  seuil.setMonth(seuil.getMonth() - moisValidite);
  return releveLe.getTime() < seuil.getTime();
}
