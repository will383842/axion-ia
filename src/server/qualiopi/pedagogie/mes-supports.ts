/**
 * Lot L08 — « Mes supports » dans l'espace stagiaire. Module PUR.
 *
 * Quels supports de formation un stagiaire reçoit, et sous quelle clé le
 * journal `remises_retours` les retrouve. La liste des types est FERMÉE : un
 * type ajouté plus tard à l'énumération ne se retrouve pas chez le stagiaire
 * par accident (le guide d'animation et la grille du formateur n'ont rien à y
 * faire).
 */

export const TYPES_SUPPORT_STAGIAIRE: ReadonlyArray<string> = [
  "livret_stagiaire",
  "memo",
  "exercices",
  "slides_stagiaire",
];

export function estSupportPourStagiaire(type: string): boolean {
  return TYPES_SUPPORT_STAGIAIRE.includes(type);
}

export interface SupportCandidat {
  readonly id: string;
  readonly formationId: string;
  readonly type: string;
  readonly titre: string;
  readonly version: number;
  readonly statut: string;
  readonly pdfKey: string | null;
}

/**
 * La dernière version VALIDE de chaque (formation, type) : `genere`, avec un PDF.
 *
 * Un support `archive` n'est jamais remis, qu'il soit une ancienne version ou un
 * support retiré par l'administrateur. Un brouillon sans PDF (rendu en échec)
 * ne masque pas la version précédente : elle reste `genere` et reste remise
 * sous son propre numéro de version.
 */
export function supportsRemis<T extends SupportCandidat>(lignes: ReadonlyArray<T>): T[] {
  const retenus = new Map<string, T>();
  for (const l of lignes) {
    if (l.statut !== "genere" || l.pdfKey === null || !estSupportPourStagiaire(l.type)) continue;
    const cle = `${l.formationId}|${l.type}`;
    const actuel = retenus.get(cle);
    if (actuel === undefined || l.version > actuel.version) retenus.set(cle, l);
  }
  return [...retenus.values()];
}

/** Code stable de `remises_retours.objet`. */
export function objetRemise(type: string): string {
  return `support_${type}`;
}

/** `remises_retours.libelle` (300 car. au plus) : le titre et la version remise. */
export function libelleRemise(titre: string, version: number): string {
  const suffixe = ` (v${version})`;
  return `${titre.slice(0, 300 - suffixe.length)}${suffixe}`;
}
