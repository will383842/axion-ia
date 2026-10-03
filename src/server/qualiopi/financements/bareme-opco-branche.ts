/**
 * Qualiopi — Choix du barème OPCO par BRANCHE (IDCC) et par TAILLE (lot A4).
 *
 * Module PUR (aucune base) : partagé par `resolveBaremeOpco`, l'estimation du
 * devis et l'alerte `aucun_bareme_opco`.
 *
 * Ordre de priorité, du plus précis au plus général :
 *   1. (opco, idcc, tranche exacte)  2. (opco, idcc, tous)
 *   3. (opco, sans idcc, tranche exacte)  4. (opco, sans idcc, tous)
 * Effectif inconnu → seules les lignes `tous` sont candidates.
 */

/** Seuil des fonds légaux du plan de développement des compétences (art. L6332-17 C. trav.). */
export const SEUIL_FONDS_LEGAUX_PDC = 50;

export type TrancheEffectif = "moins_11" | "de_11_a_49" | "tous";

export const AVERTISSEMENT_SANS_BAREME =
  "Estimation indicative : aucun barème relevé pour cet OPCO et cette branche, à confirmer auprès de l'OPCO.";

export const AVERTISSEMENT_BAREME_INCOMPLET =
  "Estimation indicative : le barème relevé pour cet OPCO est incomplet (taux horaire ou plafond annuel manquant), complété par les réglages par défaut. À confirmer auprès de l'OPCO.";

export const AVERTISSEMENT_HORS_FONDS_LEGAUX =
  "Entreprise de 50 salariés ou plus : pas de financement OPCO sur les fonds légaux du plan de développement des compétences (hors versements volontaires ou conventionnels).";

/** Tranche EXACTE d'un effectif, ou `null` s'il est inconnu ou hors fonds légaux. */
export function trancheEffectifDe(effectif: number | null | undefined): TrancheEffectif | null {
  if (effectif == null || effectif < 0) return null;
  if (effectif < 11) return "moins_11";
  if (effectif < SEUIL_FONDS_LEGAUX_PDC) return "de_11_a_49";
  return null;
}

/** Tranches candidates pour la recherche : la tranche exacte (si connue) puis `tous`. */
export function tranchesCandidates(effectif: number | null | undefined): TrancheEffectif[] {
  const exacte = trancheEffectifDe(effectif);
  return exacte ? [exacte, "tous"] : ["tous"];
}

/** Vrai si l'effectif est CONNU et ≥ 50 : aucun financement sur les fonds légaux. */
export function horsFondsLegaux(effectif: number | null | undefined): boolean {
  return effectif != null && effectif >= SEUIL_FONDS_LEGAUX_PDC;
}

/** `Client.idcc` est un VarChar libre : on ne retient qu'un code d'exactement 4 chiffres. */
export function idccValide(idcc: string | null | undefined): string | null {
  const v = idcc?.trim();
  return v && /^[0-9]{4}$/.test(v) ? v : null;
}

/**
 * Effectif d'un client, lu de façon OPTIONNELLE : le champ `Client.effectif` est
 * ajouté par une PR parallèle (opco/a1-schema-effectif-opco). Tant qu'il n'existe
 * pas, la lecture rend `undefined` et l'effectif est traité comme inconnu.
 */
export function effectifDuClient(client: object | null | undefined): number | undefined {
  if (!client || !("effectif" in client)) return undefined;
  const v = (client as { effectif?: unknown }).effectif;
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined;
}

interface LigneBareme {
  idcc: string | null;
  trancheEffectif: string;
  dateEffet: Date;
}

/** Applique l'ordre de priorité ; à rang égal, la date d'effet la plus récente gagne. */
export function choisirBaremeBranche<T extends LigneBareme>(
  lignes: readonly T[],
  critere: { idcc?: string | null; effectif?: number | null },
): T | null {
  const idcc = idccValide(critere.idcc);
  const exacte = trancheEffectifDe(critere.effectif);
  const rang = (l: T): number | null => {
    const brancheOk = l.idcc === null ? 2 : idcc !== null && l.idcc === idcc ? 0 : null;
    const trancheOk =
      l.trancheEffectif === "tous" ? 1 : exacte !== null && l.trancheEffectif === exacte ? 0 : null;
    return brancheOk === null || trancheOk === null ? null : brancheOk + trancheOk;
  };
  let meilleur: T | null = null;
  let meilleurRang = Infinity;
  for (const l of lignes) {
    const r = rang(l);
    if (r === null) continue;
    if (
      r < meilleurRang ||
      (r === meilleurRang && meilleur && l.dateEffet.getTime() > meilleur.dateEffet.getTime())
    ) {
      meilleur = l;
      meilleurRang = r;
    }
  }
  return meilleur;
}
