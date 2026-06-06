/**
 * Qualiopi — Formation Engine T4 : Builders de prompts FR purs.
 *
 * Module PUR — zéro dépendance externe / DB / IA.
 * Tous les prompts sont en français (locale FR canonique).
 * Mention AI Act art. 50 incluse dans tous les prompts de génération.
 *
 * Signatures calées sur les appels directs du worker BullMQ
 * (`qualiopi-formation-engine-worker.ts`).
 */

import type { GrilleCriteres } from "@/server/qualiopi/engine/grille-schema";

// ── Types des builders (compat worker) ───────────────────────────────────────

/**
 * Sous-ensemble de Formation nécessaire aux builders.
 * - `titre` : champ Prisma Formation (worker passe `formation.titre`)
 * - `titreFr` : alias utilisé dans les inputs dérivés (`structureInput`, `contentInput`)
 * Compatible avec `FormationForEngine` du worker BullMQ.
 */
export interface FormationLike {
  id?: string;
  /** Titre depuis le modèle Prisma Formation. */
  titre?: string;
  /** Alias de titre — utilisé dans les inputs dérivés du worker. */
  titreFr?: string;
  dureeHeures?: number;
  modalite?: string;
  objectifsPedagogiques?: unknown;
  programmeDetaille?: unknown;
  methodesPedagogiques?: string;
  seuilReussitePct?: number;
  ratioPratiquePct?: number | null;
  aiPromptVersion?: number | null;
  langueGeneration?: string;
  /** Champ module pour contentInput (worker). */
  module?: {
    ordre: number;
    titre: string;
    dureeMinutes: number;
    type: string;
    activites: string[];
  };
  publicVise?: string;
  niveauExpertise?: string;
  objectifGeneral?: string;
  nbModulesMin?: number;
  nbModulesMax?: number;
}

/**
 * Input pour le builder de raffinement.
 * Compatible avec l'objet `refineInput` construit dans le worker.
 */
export interface RefineInput {
  titreFr?: string;
  /** Contenu actuel à améliorer (JSON stringifié ou texte brut). */
  contenuActuel?: string;
  scoreActuel?: number;
  scorePlancher?: number;
  passe?: number;
  passesMax?: number;
}

// ── Mention AI Act (obligatoire sur toute génération) ─────────────────────────

const AI_ACT_NOTICE = `
⚠️ NOTICE AI Act art. 50 : Ce contenu est généré par intelligence artificielle (Claude, Anthropic).
Il doit être relu et validé par un formateur humain avant toute utilisation pédagogique.
Aucune allégation chiffrée (%, €, ROI) ne doit apparaître sans source vérifiable.
`.trim();

// ── Structure ─────────────────────────────────────────────────────────────────

/** System prompt structure. Accepte un contexte formation optionnel. */
export function buildStructureSystemPrompt(_formation?: FormationLike): string {
  return `Tu es un expert en ingénierie pédagogique spécialisé dans la formation professionnelle en France, certifié Qualiopi (RNQ 2022).
Tu conçois des plans de formation selon la méthode Backward Design (Wiggins & McTighe) :
1. Définir les résultats attendus (objectifs SMART)
2. Déterminer les preuves d'apprentissage (évaluations)
3. Planifier les activités d'apprentissage

Règles absolues :
- Minimum 60 % d'activités pratiques (indicateur 9 RNQ)
- Objectifs formulés avec des verbes d'action (taxonomie de Bloom)
- Aucune allégation chiffrée sans source vérifiable
- Contenu adapté au public cible et aux prérequis
- Structure claire et progressive (du simple au complexe)

${AI_ACT_NOTICE}

Réponds UNIQUEMENT en JSON valide (pas de markdown autour).`;
}

/** User prompt structure — construit depuis un objet Formation ou équivalent. */
export function buildStructureUserPrompt(formation: FormationLike): string {
  const titre = formation.titre ?? formation.titreFr ?? "Formation";
  const duree = formation.dureeHeures ?? 8;
  const modalite = formation.modalite ?? "presentiel";

  const objectifsStr = formation.objectifsPedagogiques
    ? typeof formation.objectifsPedagogiques === "string"
      ? formation.objectifsPedagogiques
      : JSON.stringify(formation.objectifsPedagogiques)
    : (formation.objectifGeneral ?? "À définir selon le niveau des apprenants");

  return `Génère un plan de formation structuré en JSON pour :

Titre : ${titre}
Durée totale : ${duree} heure(s)
Modalité : ${modalite}
Objectifs pédagogiques : ${objectifsStr}

Format JSON attendu :
{
  "titre": "...",
  "objectifs": ["verbe + résultat mesurable", ...],
  "modules": [
    {
      "ordre": 1,
      "titre": "...",
      "dureeMinutes": 90,
      "type": "theorique|pratique|evaluation",
      "objectifsCouverts": ["libellé objectif", ...],
      "activites": ["description courte", ...],
      "evaluation": "description de l'évaluation ou null"
    }
  ],
  "ratioPratiqueEstime": 0.65,
  "prerequisVerification": "description de la vérification des prérequis"
}`;
}

// ── Évaluation qualité ────────────────────────────────────────────────────────

/**
 * System prompt d'évaluation — inclut la grille pour le cache hit Anthropic.
 * Appelé avec `criteres` (pas une formation).
 */
export function buildEvalSystemPrompt(criteres: GrilleCriteres): string {
  const criteresDesc = criteres
    .map(
      (c) =>
        `- ${c.id} (poids ${c.poids}/100, score minimum ${c.scoreMin}/100) : ${c.libelle}${c.descriptif !== undefined ? ` — ${c.descriptif}` : ""}`,
    )
    .join("\n");

  return `Tu es un expert évaluateur pédagogique Qualiopi.
Tu évalues la qualité d'un plan de formation selon la grille ci-dessous.

GRILLE D'ÉVALUATION (somme des poids = 100) :
${criteresDesc}

Pour chaque critère, attribue un score de 0 à 100 en te basant sur :
- 0-39 : insuffisant (bloquant)
- 40-59 : en dessous des attentes
- 60-74 : acceptable (seuil minimum)
- 75-89 : bon
- 90-100 : excellent

Règles d'évaluation :
- Sois objectif et argumenté
- Le commentaire global doit identifier les points forts ET les axes d'amélioration prioritaires
- Ne valorise jamais des affirmations non sourcées (chiffres, ROI, garanties)
- Si un critère n'est pas évaluable faute d'information, attribue 0 et l'explique dans le commentaire

${AI_ACT_NOTICE}

Réponds UNIQUEMENT en JSON valide (pas de markdown autour).`;
}

export function buildEvalUserPrompt(contenu: string, criteres: GrilleCriteres): string {
  const critereIds = criteres.map((c) => `"${c.id}": score_0_a_100`).join(", ");

  return `Évalue le plan de formation suivant selon la grille et retourne un JSON de la forme :
{ ${critereIds}, "commentaire": "texte bilan global (max 300 mots)" }

PLAN DE FORMATION À ÉVALUER :
${contenu}`;
}

// ── Raffinement ───────────────────────────────────────────────────────────────

/** System prompt raffinement. Paramètre optionnel pour compat worker. */
export function buildRefineSystemPrompt(_formation?: FormationLike): string {
  return `Tu es un expert en ingénierie pédagogique Qualiopi.
Tu améliores un plan de formation existant selon des consignes précises pour atteindre le score qualité requis.

Règles absolues :
- Conserve la structure globale (durée, public, objectif général)
- Améliore uniquement les points faibles identifiés
- Ne réduis jamais le ratio pratique (minimum 60 %)
- Ne supprime aucun objectif d'apprentissage existant (tu peux en ajouter)
- Aucune allégation chiffrée sans source vérifiable

${AI_ACT_NOTICE}

Réponds UNIQUEMENT en JSON valide (même format que l'entrée, pas de markdown autour).`;
}

/**
 * User prompt raffinement.
 * Accepte soit un `RefineInput` (depuis worker), soit une `FormationLike`,
 * plus un commentaire optionnel de consigne.
 */
export function buildRefineUserPrompt(
  input: RefineInput | FormationLike,
  consignes?: string,
): string {
  // Détection du type d'entrée
  const isRefineInput = "contenuActuel" in input;

  if (isRefineInput) {
    const r = input as RefineInput;
    const scoreInfo =
      r.scoreActuel !== undefined && r.scorePlancher !== undefined
        ? `\nScore actuel : ${r.scoreActuel}/100 (plancher requis : ${r.scorePlancher}/100)`
        : "";
    const passeInfo =
      r.passe !== undefined && r.passesMax !== undefined ? `\nPasse ${r.passe}/${r.passesMax}` : "";

    return `${scoreInfo}${passeInfo}

${consignes ? `CONSIGNES D'AMÉLIORATION :\n${consignes}\n\n` : ""}PLAN ACTUEL À AMÉLIORER :
${r.contenuActuel ?? "Non défini"}

Retourne le plan amélioré au même format JSON que l'entrée.`;
  }

  // FormationLike
  const f = input as FormationLike;
  const fTitre = f.titre ?? f.titreFr ?? "Formation";
  const programmeStr = f.programmeDetaille
    ? typeof f.programmeDetaille === "string"
      ? f.programmeDetaille
      : JSON.stringify(f.programmeDetaille, null, 2)
    : "Programme non défini";

  return `PLAN ACTUEL À AMÉLIORER :
${programmeStr}

Formation : ${fTitre} (${f.dureeHeures ?? 8}h, ${f.modalite ?? "presentiel"})
${consignes ? `\nCONSIGNES :\n${consignes}` : ""}

Retourne le plan amélioré au même format JSON que l'entrée.`;
}

// ── Génération contenu ────────────────────────────────────────────────────────

/** System prompt contenu. Paramètre optionnel pour compat worker. */
export function buildContentSystemPrompt(_formation?: FormationLike): string {
  return `Tu es un expert en rédaction pédagogique pour la formation professionnelle en France.
Tu rédiges le contenu détaillé des modules d'une formation, adapté au public cible et au niveau d'expertise.

Règles de rédaction :
- Contenu 100 % en français, vocabulaire professionnel adapté au niveau
- Chaque concept théorique est suivi d'un exemple concret ou d'une application pratique
- Les consignes d'exercices sont claires, précises et réalisables dans le temps imparti
- Pas d'affirmations non sourcées (chiffres, %, ROI, garanties)
- Structure : introduction → corps → synthèse/évaluation formative

${AI_ACT_NOTICE}

Réponds en markdown structuré (titres ## et ###, listes -).`;
}

/** User prompt contenu — depuis un objet Formation ou un contentInput du worker. */
export function buildContentUserPrompt(formation: FormationLike): string {
  const titre = formation.titre ?? formation.titreFr ?? "Formation";
  const duree = formation.dureeHeures ?? 8;
  const modalite = formation.modalite ?? "presentiel";

  let programmeStr: string;
  if (formation.module) {
    // contentInput du worker : module explicite
    const m = formation.module;
    programmeStr = `Module ${m.ordre} : ${m.titre} (${m.dureeMinutes} min, type: ${m.type})
Activités : ${m.activites.join(", ")}`;
  } else if (formation.programmeDetaille) {
    programmeStr =
      typeof formation.programmeDetaille === "string"
        ? formation.programmeDetaille
        : JSON.stringify(formation.programmeDetaille, null, 2);
  } else {
    programmeStr = "Programme à développer";
  }

  const methodes = formation.methodesPedagogiques
    ? formation.methodesPedagogiques
    : "Méthodes actives, alternance théorie/pratique";

  return `Rédige le contenu pédagogique détaillé pour la formation suivante :

Formation : ${titre}
Durée : ${duree} heures
Modalité : ${modalite}
Méthodes pédagogiques : ${methodes}

Plan de formation :
${programmeStr}

Rédige le contenu complet de chaque module (introduction, développement, exercices, synthèse).`;
}
