/**
 * Qualiopi — Seed de la grille qualité pédagogique v2 (T5 Excellence).
 *
 * 10 critères alignés sur le Référentiel National Qualité + Backward Design.
 * Somme poids = 100 (vérifiée par commentaire ci-dessous + tests).
 *
 * Idempotent : crée `grille_qualite_v2` si absente, préserve si présente.
 * Passe toutes les OTHER grilles `actif=false` après création.
 */

import type { PrismaClient, Prisma } from "../../generated/client";
import type { GrilleCriteres } from "../../../src/server/qualiopi/engine/grille-schema";

// ── Critères v2 ───────────────────────────────────────────────────────────────
//
// Somme des poids :
//   objectifs_mesurables              15
//   bloom_progression                 10
//   moments_cles                       5
//   alignement_objectifs_contenu_eval 15
//   progression_pedagogique           10  (ajusté de 12→10 pour Σ=100)
//   ratio_pratique                    15
//   kirkpatrick_l2                     5
//   clarte_structure                  10  (ajusté de 12→10 pour Σ=100)
//   faisabilite_exercices              8
//   fil_rouge_narratif                 7
//                                    ───
//   TOTAL                            100  ✓

export const GRILLE_V2_CRITERES: GrilleCriteres = [
  {
    id: "objectifs_mesurables",
    libelle: "Objectifs d'apprentissage mesurables (Bloom)",
    descriptif:
      "Les objectifs sont formulés avec des verbes d'action issus de la taxonomie de Bloom, quantifiables et vérifiables à l'issue de la formation.",
    poids: 15,
    scoreMin: 70,
  },
  {
    id: "bloom_progression",
    libelle: "Progression taxonomique Bloom (mémoriser → créer)",
    descriptif:
      "La séquence des activités respecte une montée en complexité cohérente avec les niveaux de la taxonomie de Bloom (mémoriser, comprendre, appliquer, analyser, évaluer, créer).",
    poids: 10,
    scoreMin: 70,
  },
  {
    id: "moments_cles",
    libelle: "Moments clés de synthèse et d'évaluation",
    descriptif:
      "La formation intègre des moments explicites de synthèse et d'évaluation formative à intervalles réguliers (toutes les 45 min maximum) pour ancrer les apprentissages.",
    poids: 5,
    scoreMin: 65,
  },
  {
    id: "alignement_objectifs_contenu_eval",
    libelle: "Alignement objectifs-contenu-évaluation",
    descriptif:
      "Chaque objectif est couvert par au moins un module de contenu ET un exercice ou évaluation associé (backward design constructif).",
    poids: 15,
    scoreMin: 70,
  },
  {
    id: "progression_pedagogique",
    libelle: "Progression pédagogique cohérente",
    descriptif:
      "Le plan suit une progression logique du simple vers le complexe, respectant les prérequis déclarés et la charge cognitive des apprenants.",
    poids: 10,
    scoreMin: 70,
  },
  {
    id: "ratio_pratique",
    libelle: "Ratio activités pratiques suffisant (≥ 60 %)",
    descriptif:
      "Les activités pratiques, mises en situation et exercices représentent au moins 60 % du temps total (indicateur 9 RNQ Qualiopi).",
    poids: 15,
    scoreMin: 70,
  },
  {
    id: "kirkpatrick_l2",
    libelle: "Évaluation Kirkpatrick niveau 2 (apprentissage)",
    descriptif:
      "La formation prévoit une mesure des acquis (pré/post test, QCM, mise en situation évaluée) permettant d'attester du niveau 2 de Kirkpatrick.",
    poids: 5,
    scoreMin: 65,
  },
  {
    id: "clarte_structure",
    libelle: "Clarté et structure du support pédagogique",
    descriptif:
      "Le plan est lisible, les titres explicites, le vocabulaire adapté au public cible, le support accessible (RGAA niveau AA, indicateur accessibilité Qualiopi).",
    poids: 10,
    scoreMin: 70,
  },
  {
    id: "faisabilite_exercices",
    libelle: "Faisabilité des exercices dans le temps imparti",
    descriptif:
      "Les exercices proposés sont réalisables dans le temps alloué par module, avec des ressources accessibles aux apprenants sans matériel spécifique non annoncé.",
    poids: 8,
    scoreMin: 65,
  },
  {
    id: "fil_rouge_narratif",
    libelle: "Fil rouge narratif et livrables apprenant",
    descriptif:
      "La formation dispose d'un fil conducteur narratif (cas pratique, métaphore, projet) et de livrables concrets remis à l'apprenant (J0, J+1, J+30).",
    poids: 7,
    scoreMin: 65,
  },
];

// Somme vérifiée : 15+10+5+15+10+15+5+10+8+7 = 100  ✓

// ── Seed ──────────────────────────────────────────────────────────────────────

export async function seedGrilleV2(prisma: Prisma.TransactionClient | PrismaClient): Promise<void> {
  const CLE = "grille_qualite_v2";

  const existing = await prisma.grilleQualiteConfig.findUnique({
    where: { cleUnique: CLE },
  });

  if (existing) {
    console.log(`ℹ️  [qualiopi:seed] grille "${CLE}" déjà présente — préservée.`);
    return;
  }

  await prisma.grilleQualiteConfig.create({
    data: {
      cleUnique: CLE,
      criteres: GRILLE_V2_CRITERES as unknown as Prisma.InputJsonValue,
      scorePlancher: 80,
      nbPassesMax: 3,
      actif: true,
      promptVersion: 2,
    },
  });

  console.log(
    `✅ [qualiopi:seed] grille "${CLE}" créée (scorePlancher=80, nbPassesMax=3, promptVersion=2, actif=true).`,
  );

  // Passe toutes les autres grilles à actif=false
  const result = await prisma.grilleQualiteConfig.updateMany({
    where: { cleUnique: { not: CLE } },
    data: { actif: false },
  });

  if (result.count > 0) {
    console.log(`ℹ️  [qualiopi:seed] ${result.count} autre(s) grille(s) passée(s) à actif=false.`);
  }
}
