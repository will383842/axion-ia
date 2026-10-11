/**
 * Lieu d'exercice d'un formateur — règles PURES (lot L15a, ADR 0066).
 *
 * Un code postal peut couvrir plusieurs communes (38190 → au moins six) : on
 * prend celle dont le nom correspond à la ville saisie ; sinon la plus peuplée,
 * marquée « approximatif ». Seule la COMMUNE est retenue, jamais l'adresse.
 *
 * Aucun import : sûr partout.
 */

export interface CommuneCandidate {
  readonly codeInsee: string;
  readonly nom: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly departement: string;
  readonly population: number | null;
}

export type CommuneChoisie<C extends CommuneCandidate = CommuneCandidate> = {
  readonly commune: C;
  /** Vrai quand plusieurs communes partagent le code postal et qu'aucune ne porte le nom saisi. */
  readonly approximatif: boolean;
};

const RE_CODE_POSTAL = /^\d{5}$/;

/** « 74 000 » → « 74000 » ; tout autre format → `null`. */
export function normaliserCodePostal(saisie: string | null | undefined): string | null {
  if (typeof saisie !== "string") return null;
  const compact = saisie.replace(/\s+/g, "");
  return RE_CODE_POSTAL.test(compact) ? compact : null;
}

/**
 * Le code postal d'une adresse libre : la DERNIÈRE suite de 5 chiffres isolée
 * (« 12 rue des Alpes, 74000 Annecy » → « 74000 »). Un numéro de rue à 5
 * chiffres n'existe pas en France ; un SIRET (14 chiffres) n'est pas isolé.
 */
export function extraireCodePostal(adresse: string | null | undefined): string | null {
  if (typeof adresse !== "string") return null;
  const trouves = [...adresse.matchAll(/(?<!\d)(\d{2}) ?(\d{3})(?!\d)/g)].map(
    (m) => `${m[1]}${m[2]}`,
  );
  return trouves.length > 0 ? (trouves[trouves.length - 1] as string) : null;
}

/** Nom de commune comparable : sans accents, casse, tirets ni « Saint/St ». */
export function nomComparable(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\bst(e?)\b\.?/g, "saint$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Choisit la commune d'un code postal. Aucune candidate → `null`. */
export function choisirCommune<C extends CommuneCandidate>(
  candidates: ReadonlyArray<C>,
  ville: string | null | undefined,
): CommuneChoisie<C> | null {
  if (candidates.length === 0) return null;
  const voulu = typeof ville === "string" && ville.trim() ? nomComparable(ville) : null;
  if (voulu) {
    const exacte = candidates.find((c) => nomComparable(c.nom) === voulu);
    if (exacte) return { commune: exacte, approximatif: false };
  }
  const triees = [...candidates].sort(
    (a, b) => (b.population ?? -1) - (a.population ?? -1) || a.codeInsee.localeCompare(b.codeInsee),
  );
  return { commune: triees[0] as C, approximatif: candidates.length > 1 };
}
