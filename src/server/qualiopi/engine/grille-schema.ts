/**
 * Qualiopi — Formation Engine T4 : Schéma Zod de la grille qualité pédagogique.
 *
 * Module PUR — aucun import Prisma/Next/DB. Importable depuis seeds et tests
 * sans tirer de dépendances server-side.
 *
 * Règles métier :
 * - Chaque critère : id, libelle (≥10 chars), poids (0-100), scoreMin (0-100).
 * - La somme des poids DOIT être 100 (validée par superRefine).
 * - DEFAULT_GRILLE_CRITERES : 6 critères pédagogiques, somme poids = 100.
 */

import { z } from "zod";

// ── Schéma d'un critère ───────────────────────────────────────────────────────

export const CritereQualiteSchema = z.object({
  id: z.string().min(1),
  libelle: z.string().min(10, "Le libellé doit contenir au moins 10 caractères"),
  poids: z.number().int().min(0).max(100),
  scoreMin: z.number().int().min(0).max(100),
  descriptif: z.string().optional(),
});

/**
 * Type manuel avec exactOptionalPropertyTypes : `descriptif?` est soit absent
 * soit `string` (jamais `undefined` explicitement). Compatible avec le type
 * attendu par le worker BullMQ (ligne 353).
 */
export type CritereQualite = {
  id: string;
  libelle: string;
  poids: number;
  scoreMin: number;
  descriptif?: string;
};

// ── Schéma du tableau de critères (avec validation somme=100) ─────────────────

export const GrilleCriteresSchema = z.array(CritereQualiteSchema).superRefine((criteres, ctx) => {
  const somme = criteres.reduce((acc, c) => acc + c.poids, 0);
  if (somme !== 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `La somme des poids doit être 100 (obtenu : ${somme})`,
    });
  }
});

/**
 * Tableau de critères — type manuel pour `exactOptionalPropertyTypes`.
 * Compatibilité avec l'assignation worker (lignes 353+).
 */
export type GrilleCriteres = CritereQualite[];

// ── Grille par défaut (6 critères pédagogiques, somme=100) ───────────────────
//
// Critères alignés sur le Référentiel National Qualité (indicateurs 1-6) :
// — objectifs_mesurables        : résultats attendus clairs et mesurables (ind. 6)
// — alignement_objectifs        : cohérence objectifs-contenu-évaluation (ind. 7)
// — progression_pedagogique     : progression logique du simple au complexe (ind. 8)
// — ratio_pratique              : ≥60% activités pratiques / mises en situation (ind. 9)
// — clarte_structure            : clarté du plan, titres explicites (accessibilité)
// — faisabilite_exercices       : exercices réalisables dans les temps impartis
//
// scoreMin = 60 (sur 100) → plancher acceptable par critère avant rejet.

export const DEFAULT_GRILLE_CRITERES: GrilleCriteres = [
  {
    id: "objectifs_mesurables",
    libelle: "Objectifs d'apprentissage mesurables",
    descriptif:
      "Les objectifs sont formulés avec des verbes d'action (taxonomie Bloom), quantifiables et vérifiables à l'issue de la formation.",
    poids: 20,
    scoreMin: 60,
  },
  {
    id: "alignement_objectifs_contenu_eval",
    libelle: "Alignement objectifs-contenu-évaluation",
    descriptif:
      "Chaque objectif est couvert par au moins un module de contenu ET un exercice ou évaluation associé (backward design).",
    poids: 20,
    scoreMin: 60,
  },
  {
    id: "progression_pedagogique",
    libelle: "Progression pédagogique cohérente",
    descriptif:
      "Le plan suit une progression logique du simple vers le complexe, respectant les prérequis déclarés et la charge cognitive.",
    poids: 15,
    scoreMin: 60,
  },
  {
    id: "ratio_pratique",
    libelle: "Ratio activités pratiques suffisant",
    descriptif:
      "Les activités pratiques, mises en situation et exercices représentent au moins 60 % du temps total (indicateur 9 RNQ).",
    poids: 15,
    scoreMin: 60,
  },
  {
    id: "clarte_structure",
    libelle: "Clarté et structure du support",
    descriptif:
      "Le plan est lisible, les titres explicites, le vocabulaire adapté au public cible, le support accessible (indicateur accessibilité).",
    poids: 15,
    scoreMin: 60,
  },
  {
    id: "faisabilite_exercices",
    libelle: "Faisabilité des exercices dans le temps imparti",
    descriptif:
      "Les exercices proposés sont réalisables dans le temps alloué par module, avec des ressources accessibles aux apprenants.",
    poids: 15,
    scoreMin: 60,
  },
];

// La somme des poids est vérifiée explicitement dans les tests `grille-schema.spec.ts`.
