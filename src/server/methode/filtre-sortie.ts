/**
 * Couche « Méthode » — FILTRE DE SORTIE UNIQUE (ADR 0076).
 *
 * Module PUR : aucune base, aucun réseau. Tout ce que la couche rend à un appelant
 * (le noyau ET les extraits) traverse `filtrerPourSortie`. Une fiche est refusée dès
 * qu'un seul motif la touche ; on préfère refuser une fiche saine que laisser passer
 * une fiche douteuse.
 *
 * Refus :
 *   - étiquette `chiffres-exercice`, `doctrine:a-revoir` ou `secteur:sante` ;
 *   - un montant en euros (titre ou texte) ;
 *   - un courriel ou un numéro de téléphone ;
 *   - un motif de `detecterInterditsSurface` : promesse ou garantie de gain,
 *     témoignage ou statistique Axion-IA, citation de témoin, ancrage local…
 */

import { detecterInterditsSurface } from "@/lib/contenu/interdits-publication";

import {
  contientMontant,
  ETIQUETTE_CHIFFRES,
  ETIQUETTE_DOCTRINE,
  ETIQUETTE_SANTE,
} from "./decoupage";

/** Étiquettes qui interdisent la sortie, quel que soit le texte. */
export const ETIQUETTES_REFUSEES: readonly string[] = [
  ETIQUETTE_CHIFFRES,
  ETIQUETTE_DOCTRINE,
  ETIQUETTE_SANTE,
];

/** Ce que le filtre lit d'une fiche. */
export interface FicheFiltrable {
  readonly slug: string;
  readonly titre: string;
  readonly texte: string;
  readonly etiquettes?: readonly string[];
}

const MOTIF_COURRIEL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

/** Numéro français (national, +33 ou 0033) ou international en « + » suivi de 8 chiffres ou plus. */
const MOTIF_TELEPHONE =
  /(?:(?:\+33|0033)[\s.-]?\(?0?\)?[1-9](?:[\s.-]?\d{2}){4}|(?<![\d.,])0[1-9](?:[\s.-]?\d{2}){4}(?![\d])|\+\d{1,3}[\s.-]?\d(?:[\s.-]?\d){7,})/;

export function contientCourriel(texte: string): boolean {
  return MOTIF_COURRIEL.test(texte);
}

export function contientTelephone(texte: string): boolean {
  return MOTIF_TELEPHONE.test(texte);
}

/**
 * Motif du refus, ou `null` si la fiche peut sortir. Le motif est un CODE court
 * (jamais un extrait du texte) : il peut être journalisé sans rien divulguer.
 */
export function motifRefus(fiche: FicheFiltrable): string | null {
  for (const e of fiche.etiquettes ?? []) {
    if (ETIQUETTES_REFUSEES.includes(e)) return `etiquette:${e}`;
  }
  const champs = `${fiche.titre}\n${fiche.texte}`;
  if (contientMontant(champs)) return "montant";
  if (contientCourriel(champs)) return "courriel";
  if (contientTelephone(champs)) return "telephone";
  const interdits = detecterInterditsSurface(
    { titre: fiche.titre, texte: fiche.texte },
    { actualite: false, financementPublicAutorise: false },
  );
  if (interdits.length > 0) {
    return `doctrine:${Array.from(new Set(interdits.map((i) => i.code))).sort()[0]!}`;
  }
  return null;
}

/** Garde, dans l'ordre, les seules fiches sans motif de refus. */
export function filtrerPourSortie<T extends FicheFiltrable>(fiches: readonly T[]): T[] {
  return fiches.filter((f) => motifRefus(f) === null);
}
