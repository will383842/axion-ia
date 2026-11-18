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

import {
  detecterInterditsSurface,
  normaliserPourControle,
} from "@/lib/contenu/interdits-publication";

import {
  contientMontant,
  contientPourcentage,
  contientPromesse,
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

const MOTIF_COURRIEL = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

/**
 * Courriel masqué, lu sur le texte normalisé : « [at] », « (at) », « {at} », « arobase »,
 * « @ » entouré d'espaces, ou « @ » suivi d'un domaine écrit « point » / « [dot] ».
 */
const MOTIF_COURRIEL_MASQUE =
  /[[({]\s?at\s?[\])}]|\barobase\b|@|\s(?:at|chez|a)\s[a-z0-9-]{2,40}\s(?:dot|point)\s[a-z]{2,}|\s(?:dot|point)\s(?:com|fr|net|org|io|eu|info|biz|be|ch|invalid)\b/;

/** Numéro français (national, +33 ou 0033) ou international en « + » suivi de 8 chiffres ou plus. */
const MOTIF_TELEPHONE =
  /(?:\(\s?(?:\+|00)?33\s?\)[\s.-]?\(?0?\)?[1-9](?:[\s.-]?\d{2}){4}|\(\s?0[1-9]\s?\)(?:[\s.-]?\d{2}){4}|\(0\)\s?[1-9](?:[\s.-]?\d{2}){4}|(?:\(?\+33\)?|0033)[\s.-]?\(?0?\)?[1-9](?:[\s.-]?\d{2}){4}|(?<![\d.,])0[1-9](?:[\s.-]?\d{2}){4}(?![\d])|\+\d{1,3}[\s.-]?\d(?:[\s.-]?\d){7,})/;

/** Dix chiffres commençant par 0 avec n'importe quels séparateurs, ou neuf chiffres en paires sans le 0. */
const MOTIF_TELEPHONE_LARGE =
  /(?<![\d.,])0[1-9](?:[\s.\/-]?\d){8}(?!\d)|(?<![\d.,])[1-9](?:[\s.\/-]\d{2}){4}(?!\d)|(?<![\d.,])0[\s.-]?[1-9](?:[\s.\/-]?\d){8}(?!\d)/;

export function contientCourriel(texte: string): boolean {
  const nfkc = texte.normalize("NFKC");
  return MOTIF_COURRIEL.test(nfkc) || MOTIF_COURRIEL_MASQUE.test(normaliserPourControle(nfkc));
}

export function contientTelephone(texte: string): boolean {
  const nfkc = texte.normalize("NFKC");
  return MOTIF_TELEPHONE.test(nfkc) || MOTIF_TELEPHONE_LARGE.test(nfkc);
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
  if (contientPromesse(champs)) return "promesse";
  if (contientPourcentage(champs)) return "pourcentage";
  return null;
}

/** Garde, dans l'ordre, les seules fiches sans motif de refus. */
export function filtrerPourSortie<T extends FicheFiltrable>(fiches: readonly T[]): T[] {
  return fiches.filter((f) => motifRefus(f) === null);
}
