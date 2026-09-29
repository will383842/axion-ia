/**
 * Briques communes des schémas de sortie du circuit visio (ADR 0055 ;
 * `compte-rendu-et-extraction.md` §3).
 *
 * RÈGLES DES SCHÉMAS ENVOYÉS À OPENAI (sortie structurée `strict: true`) :
 *   · AUCUN `.optional()` : tout champ est requis ; une valeur absente s'écrit
 *     `.nullable()` (garde `aucun-schema-n-a-de-champ-optionnel.spec.ts`) ;
 *   · aucun schéma récursif, aucune borne (`min`, `max`) : les bornes sont
 *     contrôlées par le CODE (vérification V1), pas par le schéma ;
 *   · le JSON Schema produit est FIGÉ dans `*.schema.json` et comparé par un
 *     test (`le-schema-envoye-est-fige.spec.ts`) : toute modification se voit
 *     en revue et incrémente la version.
 *
 * Module PUR.
 */

import { z } from "zod";

import { TYPES_DE_FAITS } from "../types-de-faits";

/** Les 12 rubriques couvertes par l'extraction (la 12ᵉ du gabarit, les signaux, est calculée). */
export const RUBRIQUES_COUVERTURE = [
  "entreprise",
  "decision",
  "problemes",
  "besoins",
  "perimetre",
  "budget_financement",
  "calendrier",
  "objections_concurrence",
  "engagements",
  "offres",
  "questions_ouvertes",
  "prochaine_etape",
] as const;
export type RubriqueCouverture = (typeof RUBRIQUES_COUVERTURE)[number];

/** Numéro de rubrique du gabarit (`TYPES_DE_FAITS[type].rubrique`) → clé de couverture. */
export const RUBRIQUE_PAR_NUMERO: Readonly<Record<number, RubriqueCouverture>> = {
  1: "entreprise",
  2: "decision",
  3: "problemes",
  4: "besoins",
  5: "perimetre",
  6: "budget_financement",
  7: "calendrier",
  8: "objections_concurrence",
  9: "engagements",
  10: "offres",
  11: "questions_ouvertes",
  13: "prochaine_etape",
};

/** La rubrique de couverture d'un type de fait (`null` = « divers »). */
export function rubriqueDuType(type: keyof typeof TYPES_DE_FAITS): RubriqueCouverture | null {
  const r = TYPES_DE_FAITS[type].rubrique;
  return r === "divers" ? null : (RUBRIQUE_PAR_NUMERO[r] ?? null);
}

/** Types de faits : DÉRIVÉS de la table unique, jamais recopiés. */
export const TYPES_FAITS_SCHEMA = Object.keys(TYPES_DE_FAITS) as [
  keyof typeof TYPES_DE_FAITS,
  ...(keyof typeof TYPES_DE_FAITS)[],
];

export const statutRubrique = z.enum(["aborde", "evoque_sans_precision", "non_aborde"]);

export const activite = z.enum(["formation", "un_a_un", "audit", "implementation", "site_web"]);

export const confiance = z.enum(["haute", "moyenne", "faible"]);

/** Une preuve : 1 à 3 segments consécutifs du même locuteur, et une citation mot pour mot. */
export const preuve = z.object({
  segment_ids: z.array(z.string()),
  citation: z.string(),
});
export type Preuve = z.infer<typeof preuve>;

/** Un paragraphe rédigé, relié aux faits sur lesquels il repose. */
export const paragraphe = z.object({
  texte: z.string(),
  faits_refs: z.array(z.string()),
});
export type Paragraphe = z.infer<typeof paragraphe>;
