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
import {
  normaliserModalite,
  reglesModalitePourPrompt,
} from "@/server/qualiopi/engine/modalite-pedagogie";

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
  publicVise?: string | null;
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

  // Injection du persona si disponible dans programmeDetaille
  const programmeDetaille =
    formation.programmeDetaille !== null && formation.programmeDetaille !== undefined
      ? typeof formation.programmeDetaille === "object"
        ? (formation.programmeDetaille as Record<string, unknown>)
        : null
      : null;

  const personaSection =
    programmeDetaille?.persona !== undefined && programmeDetaille.persona !== null
      ? `PERSONA STAGIAIRE (à intégrer dans la conception) :
${typeof programmeDetaille.persona === "string" ? programmeDetaille.persona : JSON.stringify(programmeDetaille.persona, null, 2)}

`
      : "";

  const reglesModalite = reglesModalitePourPrompt(normaliserModalite(modalite));

  return `${personaSection}Génère un plan de formation structuré en JSON pour :

Titre : ${titre}
Durée totale : ${duree} heure(s)
Modalité : ${modalite}
Objectifs pédagogiques : ${objectifsStr}

CONSIGNES D'ADAPTATION À LA MODALITÉ (à respecter dans le choix des activités) :
${reglesModalite}

Format JSON attendu (champs additifs obligatoires : fil_rouge, livrables_j0, livrables_j1, livrables_j30) :
{
  "titre": "...",
  "objectifs": ["verbe + résultat mesurable", ...],
  "fil_rouge": "description du projet fil rouge ou mise en situation traversante sur toute la formation",
  "livrables_j0": ["livrable ou action que le stagiaire peut faire dès le premier jour", ...],
  "livrables_j1": ["livrable ou action que le stagiaire peut faire après 1 semaine", ...],
  "livrables_j30": ["résultat ou impact mesurable attendu à 30 jours post-formation", ...],
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

// ── Backward Design (phase −1) ────────────────────────────────────────────────

/**
 * System prompt Backward Design — phase -1 du pipeline.
 * Génère les 3 phases (résultats, preuves, activités) AVANT la structure.
 */
export function buildBackwardDesignSystemPrompt(): string {
  return `Tu es un expert en ingénierie pédagogique appliquant la méthode Backward Design (Wiggins & McTighe, 2005).
Tu travailles pour un organisme de formation certifié Qualiopi (RNQ 2022).

Méthode en 3 phases (à respecter dans l'ordre) :
1. PHASE RÉSULTATS : Quels résultats durables les stagiaires doivent-ils obtenir à 30 jours post-formation ?
   - Résultats formulés en termes de comportements observables et mesurables
   - Liés aux objectifs métier réels (pas seulement aux connaissances)
   - Minimum 3 résultats, maximum 7

2. PHASE PREUVES : Quelles preuves tangibles valideront l'atteinte de ces résultats ?
   - Évaluations formatives et sommatives
   - Livrables concrets (outil, document, action en situation réelle)
   - Critères de réussite mesurables

3. PHASE ACTIVITÉS : Quelles activités d'apprentissage produiront ces preuves ?
   - Séquence pédagogique progressive (du simple au complexe)
   - Ratio pratique minimum 60 % (Qualiopi indicateur 9)
   - Lien explicite entre activité → preuve → résultat

Règles absolues :
- Aucune allégation chiffrée sans source vérifiable
- Contenu 100 % en français professionnel
- Verbes d'action (taxonomie de Bloom niveaux 3-6 pour les résultats)

${AI_ACT_NOTICE}

Réponds UNIQUEMENT en JSON valide (pas de markdown autour).`;
}

/**
 * User prompt Backward Design — construit depuis une formation.
 * Sortie JSON : { phase_resultats, phase_preuves, phase_activites }
 */
export function buildBackwardDesignUserPrompt(formation: FormationLike): string {
  const titre = formation.titre ?? formation.titreFr ?? "Formation";
  const duree = formation.dureeHeures ?? 8;
  const modalite = formation.modalite ?? "presentiel";
  const publicVise = formation.publicVise ?? "professionnels en activité";
  const objectifGeneral = formation.objectifGeneral ?? "À préciser";

  const objectifsStr = formation.objectifsPedagogiques
    ? typeof formation.objectifsPedagogiques === "string"
      ? formation.objectifsPedagogiques
      : JSON.stringify(formation.objectifsPedagogiques)
    : objectifGeneral;

  return `Applique la méthode Backward Design pour la formation suivante :

Titre : ${titre}
Durée : ${duree} heure(s)
Modalité : ${modalite}
Public visé : ${publicVise}
Objectifs pédagogiques : ${objectifsStr}

Retourne un JSON de la forme :
{
  "phase_resultats": [
    {
      "libelle": "Résultat observable et mesurable à 30j",
      "indicateur_mesure": "Comment mesurer ce résultat concrètement"
    }
  ],
  "phase_preuves": [
    {
      "type": "livrable|evaluation_formative|evaluation_sommative|mise_en_situation",
      "description": "Description de la preuve",
      "criteres_reussite": ["critère 1 mesurable", ...],
      "resultats_associes": [0]
    }
  ],
  "phase_activites": [
    {
      "ordre": 1,
      "type": "decouverte|approfondissement|pratique|evaluation|synthese",
      "description": "Description de l'activité",
      "duree_estimee_minutes": 60,
      "preuves_produites": [0],
      "ratio_pratique": 0.7
    }
  ]
}`;
}

// ── Persona stagiaire ─────────────────────────────────────────────────────────

/**
 * System prompt Persona — construit un profil psycho-pédagogique du stagiaire type.
 */
export function buildPersonaSystemPrompt(): string {
  return `Tu es un expert en psychologie de l'apprentissage et en ingénierie de formation adulte.
Tu construis des personas pédagogiques précis pour permettre la personnalisation des formations professionnelles.

Un persona pédagogique doit permettre au formateur de :
- Adapter le registre de langage et les exemples concrets
- Anticiper les résistances et les freins à l'apprentissage
- Choisir les méthodes pédagogiques les plus efficaces
- Calibrer le rythme et la difficulté

Règles de construction :
- Persona basé sur des patterns réels (pas des stéréotypes)
- Motivations INTRINSÈQUES (pas seulement extrinsèques)
- Freins réalistes et non condescendants
- Recommandations pédagogiques directement actionnables
- Aucune donnée personnelle ou discriminante

${AI_ACT_NOTICE}

Réponds UNIQUEMENT en JSON valide (pas de markdown autour).`;
}

/**
 * User prompt Persona — construit depuis le public visé et le contexte IA optionnel.
 * Sortie JSON : { profil, motivations, freins, style_apprentissage, recommandations_pedago }
 */
export function buildPersonaUserPrompt(
  publicVise: string | null | undefined,
  contexteIa?: string,
): string {
  const contexteSection = contexteIa ? `\nContexte IA spécifique : ${contexteIa}\n` : "";

  return `Construis le persona pédagogique détaillé pour le public suivant :

Public visé : ${publicVise || "professionnels en activité souhaitant monter en compétences"}${contexteSection}

Retourne un JSON de la forme :
{
  "profil": {
    "description": "Portrait synthétique du stagiaire type (3-5 phrases)",
    "experience_professionnelle": "Niveau et domaine d'expérience typique",
    "rapport_a_la_formation": "Comment il vit généralement les formations professionnelles",
    "rapport_au_numerique": "Niveau d'aisance numérique et outils habituels"
  },
  "motivations": {
    "intrinseques": ["motivation profonde 1", ...],
    "extrinseques": ["motivation externe 1 (obligation, contrainte, opportunité)", ...],
    "declencheur_inscription": "Ce qui a déclenché l'inscription à cette formation"
  },
  "freins": {
    "apprentissage": ["frein cognitif ou pédagogique", ...],
    "organisationnels": ["contrainte de temps, hiérarchie, budget", ...],
    "psychologiques": ["syndrome de l'imposteur, peur de l'échec, etc.", ...]
  },
  "style_apprentissage": {
    "dominant": "visuel|auditif|kinesthesique|lecture_ecriture",
    "preferences": ["apprend mieux par...", ...],
    "rythme": "rapide|moderé|lent — avec justification",
    "autonomie": "haut|moyen|faible — avec justification"
  },
  "recommandations_pedago": [
    {
      "aspect": "Ex: exemples concrets",
      "action": "Action concrète pour le formateur"
    }
  ]
}`;
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

// ── Contenu STRUCTURÉ par module (chantier « Excellence formations ») ──────────

/**
 * Entrée d'un module à détailler (dérivée d'un module du programme structuré).
 */
export interface ModuleADetailler {
  moduleId: string;
  titre: string;
  dureeMin?: number;
  objectifsCouverts?: string[];
  activites?: string[];
  sequences?: Array<{ titre: string; dureeMin?: number; description?: string }>;
}

/**
 * System prompt du contenu structuré : produit un JSON riche EXPLOITABLE par les
 * supports (concepts expliqués, exemple métier, exercice AVEC corrigé, quiz,
 * notes formateur, adaptations modalité) — et non du markdown libre non réutilisable.
 */
export function buildModuleContentStructuredSystemPrompt(): string {
  return `Tu es un concepteur pédagogique senior (organisme certifié Qualiopi, RNQ 2022) ET un praticien expert du sujet enseigné.
Tu rédiges le contenu DÉTAILLÉ et OPÉRATIONNEL d'un module de formation professionnelle, directement exploitable pour produire un diaporama, un cahier d'exercices et un guide d'animation.

Exigences de qualité NON négociables :
- Chaque concept est EXPLIQUÉ (2 à 5 phrases claires), jamais seulement nommé.
- Chaque séquence contient un EXEMPLE CONCRET ancré dans un contexte métier réaliste (situation d'entreprise vécue), pas une généralité.
- Chaque séquence pratique contient un EXERCICE réalisable dans le temps imparti, AVEC son corrigé (éléments de réponse attendus) et des critères de réussite observables.
- Les notes d'animation aident un formateur à animer (posture, question à poser, piège fréquent).
- Adapter explicitement les activités à la modalité indiquée.
- Aucune allégation chiffrée (%, €, ROI, garantie) sans source vérifiable : à défaut, reformule sans chiffre.
- Contenu 100 % en français professionnel.

${AI_ACT_NOTICE}

Réponds UNIQUEMENT en JSON valide conforme au format demandé (aucun texte autour, pas de markdown).`;
}

/**
 * User prompt du contenu structuré d'UN module. Le worker itère module par module
 * pour rester sous le plafond de tokens et garantir un JSON complet par appel.
 */
export function buildModuleContentStructuredUserPrompt(input: {
  formationTitre: string;
  modalite: string;
  publicVise?: string | null;
  objectifsFormation?: unknown;
  module: ModuleADetailler;
}): string {
  const modalite = normaliserModalite(input.modalite);
  const reglesModalite = reglesModalitePourPrompt(modalite);

  const objectifsStr = input.objectifsFormation
    ? typeof input.objectifsFormation === "string"
      ? input.objectifsFormation
      : JSON.stringify(input.objectifsFormation)
    : "cf. objectifs du module";

  const seqStr =
    input.module.sequences && input.module.sequences.length > 0
      ? input.module.sequences
          .map(
            (s) =>
              `  - ${s.titre}${s.dureeMin ? ` (${s.dureeMin} min)` : ""}${s.description ? ` : ${s.description}` : ""}`,
          )
          .join("\n")
      : "  (séquences à proposer à partir du titre et des objectifs du module)";

  return `Détaille le module suivant de la formation « ${input.formationTitre} ».

Public visé : ${input.publicVise ?? "professionnels en activité"}
Modalité : ${input.modalite}
Objectifs de la formation : ${objectifsStr}

Module à détailler :
- Titre : ${input.module.titre}
- Durée : ${input.module.dureeMin ?? "à répartir"} min
- Objectifs couverts : ${(input.module.objectifsCouverts ?? []).join(" ; ") || "cf. objectifs formation"}
- Séquences prévues :
${seqStr}

CONSIGNES D'ADAPTATION À LA MODALITÉ :
${reglesModalite}

Retourne un JSON STRICTEMENT de la forme (respecte les clés et les types) :
{
  "moduleId": "${input.module.moduleId}",
  "titre": "${input.module.titre.replace(/"/g, "'")}",
  "introduction": "accroche du module : pourquoi c'est utile pour le stagiaire (2-4 phrases)",
  "sequences": [
    {
      "titre": "...",
      "dureeMin": 30,
      "concepts": [ { "titre": "...", "explication": "2 à 5 phrases" } ],
      "exempleConcret": "situation métier réaliste illustrant le concept",
      "pointsVigilance": ["piège fréquent ou point d'attention"],
      "exercice": {
        "consigne": "énoncé clair et réalisable dans le temps imparti",
        "dureeMin": 15,
        "corrige": "éléments de réponse attendus (réservé formateur)",
        "criteresReussite": ["critère observable"]
      },
      "noteFormateur": "conseil d'animation (posture, question à poser, piège)",
      "adaptationPresentiel": "adaptation en salle si pertinent",
      "adaptationDistanciel": "adaptation en classe virtuelle si pertinent"
    }
  ],
  "synthese": "points clés à retenir en fin de module (3-5 phrases)",
  "quiz": [
    {
      "question": "...",
      "options": ["...", "..."],
      "bonneReponseIndex": 0,
      "explication": "pourquoi cette réponse est correcte"
    }
  ]
}

Règles : au moins 1 concept par séquence ; un exercice pour toute séquence à visée pratique ; 2 à 4 questions de quiz pour le module. Omets "exercice", "adaptationPresentiel" ou "adaptationDistanciel" si non pertinents (ne mets pas de valeur vide).`;
}
