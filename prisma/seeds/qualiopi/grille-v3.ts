/**
 * Qualiopi — Seed de la grille qualité pédagogique v3 « Standard Axion-IA ».
 *
 * v2 (Excellence) + les 3 exigences du Standard de contenu pédagogique de
 * Will (document du 2026-08-05) : squelette 5 blocs par module, notes
 * animateur complètes (« n'importe quel formateur peut animer n'importe
 * quelle formation »), et « à emporter » tangible (la promesse commerciale
 * « prompts réutilisables » n'est pas tenue sans livrable).
 *
 * 🔴 promptVersion = 3, OBLIGATOIRE : la clé du cache IA inclut promptVersion —
 * garder 2 servirait des évaluations mises en cache sous la grille v2.
 *
 * Idempotent : crée `grille_qualite_v3` si absente, préserve si présente.
 * Passe toutes les AUTRES grilles `actif=false` après création.
 */

import type { PrismaClient, Prisma } from "../../generated/client";
import type { GrilleCriteres } from "../../../src/server/qualiopi/engine/grille-schema";

// ── Critères v3 ───────────────────────────────────────────────────────────────
//
// Somme des poids :
//   objectifs_mesurables              11
//   bloom_progression                  8
//   moments_cles                       4
//   alignement_objectifs_contenu_eval 11
//   progression_pedagogique            8
//   ratio_pratique                    12
//   kirkpatrick_l2                     4
//   clarte_structure                   8
//   faisabilite_exercices              6
//   fil_rouge_narratif                 5
//   cinq_blocs_module                 10  (nouveau — Standard Axion-IA)
//   transmissibilite_formateur         8  (nouveau — Standard Axion-IA)
//   a_emporter_tangible                5  (nouveau — Standard Axion-IA)
//                                    ───
//   TOTAL                            100  ✓

export const GRILLE_V3_CRITERES: GrilleCriteres = [
  {
    id: "objectifs_mesurables",
    libelle: "Objectifs d'apprentissage mesurables (Bloom)",
    descriptif:
      "Les objectifs sont formulés avec des verbes d'action issus de la taxonomie de Bloom, quantifiables et vérifiables à l'issue de la formation.",
    poids: 11,
    scoreMin: 70,
  },
  {
    id: "bloom_progression",
    libelle: "Progression taxonomique Bloom (mémoriser → créer)",
    descriptif:
      "La séquence des activités respecte une montée en complexité cohérente avec les niveaux de la taxonomie de Bloom (mémoriser, comprendre, appliquer, analyser, évaluer, créer).",
    poids: 8,
    scoreMin: 70,
  },
  {
    id: "moments_cles",
    libelle: "Moments clés de synthèse et d'évaluation",
    descriptif:
      "La formation intègre des moments explicites de synthèse et d'évaluation formative à intervalles réguliers (toutes les 45 min maximum) pour ancrer les apprentissages.",
    poids: 4,
    scoreMin: 65,
  },
  {
    id: "alignement_objectifs_contenu_eval",
    libelle: "Alignement objectifs-contenu-évaluation",
    descriptif:
      "Chaque objectif est couvert par au moins un module de contenu ET un exercice ou évaluation associé (backward design constructif).",
    poids: 11,
    scoreMin: 70,
  },
  {
    id: "progression_pedagogique",
    libelle: "Progression pédagogique cohérente",
    descriptif:
      "Le plan suit une progression logique du simple vers le complexe, respectant les prérequis déclarés et la charge cognitive des apprenants.",
    poids: 8,
    scoreMin: 70,
  },
  {
    id: "ratio_pratique",
    libelle: "Ratio activités pratiques suffisant (≥ 60 %)",
    descriptif:
      "Les activités pratiques, mises en situation et exercices représentent au moins 60 % du temps total (indicateur 9 RNQ Qualiopi).",
    poids: 12,
    scoreMin: 70,
  },
  {
    id: "kirkpatrick_l2",
    libelle: "Évaluation Kirkpatrick niveau 2 (apprentissage)",
    descriptif:
      "La formation prévoit une mesure des acquis (pré/post test, QCM, mise en situation évaluée) permettant d'attester du niveau 2 de Kirkpatrick.",
    poids: 4,
    scoreMin: 65,
  },
  {
    id: "clarte_structure",
    libelle: "Clarté et structure du support pédagogique",
    descriptif:
      "Le plan est lisible, les titres explicites, le vocabulaire adapté au public cible, le support accessible (RGAA niveau AA, indicateur accessibilité Qualiopi).",
    poids: 8,
    scoreMin: 70,
  },
  {
    id: "faisabilite_exercices",
    libelle: "Faisabilité des exercices dans le temps imparti",
    descriptif:
      "Les exercices proposés sont réalisables dans le temps alloué par module, avec des ressources accessibles aux apprenants sans matériel spécifique non annoncé.",
    poids: 6,
    scoreMin: 65,
  },
  {
    id: "fil_rouge_narratif",
    libelle: "Fil rouge narratif et livrables apprenant",
    descriptif:
      "La formation dispose d'un fil conducteur narratif (cas pratique, métaphore, projet) et de livrables concrets remis à l'apprenant (J0, J+1, J+30).",
    poids: 5,
    scoreMin: 65,
  },
  {
    id: "cinq_blocs_module",
    libelle: "Squelette 5 blocs respecté dans chaque module",
    descriptif:
      "Chaque module suit les cinq blocs du Standard Axion-IA, dans l'ordre : (1) objectif observable relié à un objectif global ; (2) démonstration avant/après avec le prompt affiché EN ENTIER et un seul outil par démonstration ; (3) pratique immédiate chronométrée avec consigne explicite et liste de vérification de sortie ; (4) mini-vérification de compréhension avant le module suivant ; (5) synthèse en 2-3 actions acquises (« vous savez maintenant faire X »), jamais un résumé académique.",
    poids: 10,
    scoreMin: 70,
  },
  {
    id: "transmissibilite_formateur",
    libelle: "Transmissibilité : n'importe quel formateur peut animer",
    descriptif:
      "Le contenu ne repose sur l'expertise d'aucun intervenant en particulier : notes animateur complètes par séquence (script de ce qu'il faut dire, timing, questions fréquentes et réponses, erreurs/blocages à désamorcer, plan B si la démonstration technique échoue en direct), démonstrations reproductibles pas à pas, exemples concrets dans la forme (vrais prompts, vrais résultats) et universels dans le fond (une tâche que tout le monde reconnaît — jamais un cas sectoriel pointu, sauf formation sur mesure client).",
    poids: 8,
    scoreMin: 70,
  },
  {
    id: "a_emporter_tangible",
    libelle: "« À emporter » tangible et réutilisable",
    descriptif:
      "La formation se termine avec un livrable concret immédiatement réutilisable (fiche mémo des prompts vus en session, gabarit prêt à copier-coller) — traduction de la promesse commerciale « méthodes et prompts réutilisables ». Chaque module contribue un élément à ce kit.",
    poids: 5,
    scoreMin: 65,
  },
];

// Somme vérifiée : 11+8+4+11+8+12+4+8+6+5+10+8+5 = 100  ✓

// ── Seed ──────────────────────────────────────────────────────────────────────

export async function seedGrilleV3(prisma: Prisma.TransactionClient | PrismaClient): Promise<void> {
  const CLE = "grille_qualite_v3";

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
      criteres: GRILLE_V3_CRITERES as unknown as Prisma.InputJsonValue,
      scorePlancher: 80,
      nbPassesMax: 3,
      actif: true,
      promptVersion: 3,
    },
  });

  console.log(
    `✅ [qualiopi:seed] grille "${CLE}" créée (scorePlancher=80, nbPassesMax=3, promptVersion=3, actif=true).`,
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
