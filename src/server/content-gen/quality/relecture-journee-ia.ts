/**
 * Content Generator — relecture humaine obligatoire pour l'offre « Journée IA ».
 *
 * Un contenu qui parle de la Journée IA (mention de l'offre, de son prix, de sa garantie,
 * lien vers sa fiche, ou rattachement à une campagne Journée IA) n'est JAMAIS publié
 * automatiquement, quelle que soit sa note : il reste en attente dans la console
 * (`needs_review` / revue `pending`, statuts existants). L'approbation manuelle par un
 * admin reste possible (elle pose `reviewedBy`).
 *
 * Module PUR : aucune base, aucun Next, aucun Redis.
 */

import type { BarriereRelecture } from "./barrieres-publication";

export interface ContenuARelire {
  /** `ContentGenJob.outputJsonRaw` (ou la sortie du générateur). */
  readonly output: unknown;
  /** `ContentGenJob.inputPayload`. */
  readonly inputPayload?: unknown;
  /** Nom de la campagne parente, si le job en a une. */
  readonly campaignName?: string | null | undefined;
}

/** Accents, casse, apostrophes et séparateurs ramenés à des mots séparés par une espace. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, " ");
}

// « journee ia », « journee d ia », « journee de l ia », « journees ia », « /journee-ia » (normalisé).
const RE_JOURNEE_IA = /journees?(?:\s+(?:de\s+l|de|d))?\s*ia\b/;
// 1 490 € HT, 1490€, 1.490 EUR (prix public de l'offre, SSOT pricing.ts).
const RE_PRIX = /\b1[\s  .,]?490\s*(?:€|eur\b)/i;
const RE_GARANTIE = /satisfait\s+ou\s+rembours/;

/** Vrai si le texte parle de la Journée IA : nom, lien, prix ou garantie. */
export function mentionneJourneeIA(texte: string): boolean {
  if (!texte) return false;
  if (RE_PRIX.test(texte)) return true;
  const n = normaliser(texte);
  return RE_JOURNEE_IA.test(n) || RE_GARANTIE.test(n);
}

const MAX_PROFONDEUR = 6;

/** Toutes les chaînes d'une valeur JSON libre (profondeur bornée). */
function chaines(valeur: unknown, profondeur = 0, acc: string[] = []): string[] {
  if (typeof valeur === "string") acc.push(valeur);
  else if (profondeur < MAX_PROFONDEUR && Array.isArray(valeur)) {
    for (const v of valeur) chaines(v, profondeur + 1, acc);
  } else if (profondeur < MAX_PROFONDEUR && typeof valeur === "object" && valeur !== null) {
    for (const v of Object.values(valeur)) chaines(v, profondeur + 1, acc);
  }
  return acc;
}

/**
 * Champs publiés de la sortie. On ne lit pas tout le JSON : `judgeIssues` et autres
 * annotations internes ne sont pas du contenu public.
 */
const CHAMPS_PUBLICS = [
  "title",
  "metaTitle",
  "metaDescription",
  "slug",
  "directAnswer",
  "bodyHtml",
  "bodyText",
  "keyTakeaway",
  "faq",
  "tags",
  "expertQuote",
  "primaryKeyword",
] as const;

function textesPublics(output: unknown): string[] {
  if (typeof output !== "object" || output === null) return [];
  const o = output as Record<string, unknown>;
  return CHAMPS_PUBLICS.flatMap((c) => chaines(o[c]));
}

/** Vrai si ce contenu doit être relu par un humain avant toute publication. */
export function exigeRelectureHumaine(contenu: ContenuARelire): boolean {
  const textes = [
    ...textesPublics(contenu.output),
    ...chaines(contenu.inputPayload),
    ...(contenu.campaignName ? [contenu.campaignName] : []),
  ];
  return textes.some(mentionneJourneeIA);
}

/** Barrière de relecture pour le worker de génération (`null` = rien à signaler). */
export function barriereJourneeIA(contenu: ContenuARelire): BarriereRelecture | null {
  return exigeRelectureHumaine(contenu)
    ? {
        code: "journee-ia",
        libelle: "Contenu qui parle de la Journée IA : relecture humaine obligatoire",
      }
    : null;
}
