/**
 * Formateurs indépendants — ÉVALUATION DES COMPÉTENCES PÉDAGOGIQUES (Qualiopi ind. 21).
 *
 * 🔑 LE SEUL FICHIER DES CRITÈRES ET DE LEURS LIBELLÉS. Les grilles de la console, les
 * règles et la garde d'activation lisent tout ici : changer un libellé ou un critère se
 * fait dans ce fichier, et nulle part ailleurs. Les SEUILS sont ailleurs, dans
 * `reglages.ts` (fichier de réglages unique).
 *
 * ⚠️ Libellés à valider par Will. Changer la LISTE des critères (pas seulement un
 * libellé) exige d'augmenter `VERSION_CONFIGURATION_EVALUATION` : chaque grille versée
 * garde la version avec laquelle elle a été notée, et une grille d'une autre version
 * n'est jamais relue comme si elle portait les critères d'aujourd'hui.
 *
 * Module PUR, sans base.
 */

/** Version de la liste des critères et des blocs. */
export const VERSION_CONFIGURATION_EVALUATION = 1;

/** Note minimale et maximale d'un critère d'entretien ou d'un bloc de mise en situation. */
export const NOTE_MIN = 1;
export const NOTE_MAX = 5;

export interface CritereGrille {
  readonly code: string;
  readonly libelle: string;
  /** Ce que l'évaluateur regarde, affiché sous le critère. */
  readonly aide: string;
}

/** (a) ENTRETIEN NOTÉ — cinq critères notés de 1 à 5. */
export const CRITERES_ENTRETIEN: ReadonlyArray<CritereGrille> = [
  {
    code: "expertise",
    libelle: "Maîtrise du sujet enseigné",
    aide: "Expérience récente et concrète du domaine, exemples tirés de la pratique.",
  },
  {
    code: "conception",
    libelle: "Conception pédagogique",
    aide: "Sait formuler des objectifs, construire une progression et choisir des méthodes adaptées.",
  },
  {
    code: "animation",
    libelle: "Animation et posture de formateur",
    aide: "Clarté, écoute, gestion du groupe, capacité à faire participer.",
  },
  {
    code: "adaptation",
    libelle: "Adaptation au public",
    aide: "Prise en compte des niveaux, des besoins particuliers et des situations de handicap.",
  },
  {
    code: "evaluation",
    libelle: "Évaluation des acquis",
    aide: "Sait vérifier ce que les stagiaires ont appris, pendant et à la fin de la formation.",
  },
];

/** (b) MISE EN SITUATION — quatre blocs, B1 à B4, notés sur 5. */
export const BLOCS_MISE_EN_SITUATION: ReadonlyArray<CritereGrille> = [
  {
    code: "B1",
    libelle: "B1 — Ouverture et cadrage",
    aide: "Présente les objectifs, le déroulé et les règles ; recueille les attentes.",
  },
  {
    code: "B2",
    libelle: "B2 — Transmission",
    aide: "Explique clairement, illustre par des exemples, vérifie la compréhension.",
  },
  {
    code: "B3",
    libelle: "B3 — Activité et interaction",
    aide: "Fait pratiquer, relance, gère le temps et les questions du groupe.",
  },
  {
    code: "B4",
    libelle: "B4 — Évaluation et clôture",
    aide: "Évalue les acquis, fait le bilan, recueille l'avis des participants.",
  },
];

/** (c) DÉCISION D'HABILITATION, par formation. */
export const DECISIONS_HABILITATION = [
  "habilite",
  "avec_reserve",
  "non_habilite",
  "second_essai",
] as const;

export type DecisionHabilitation = (typeof DECISIONS_HABILITATION)[number];

export const LIBELLES_DECISION: Readonly<Record<DecisionHabilitation, string>> = {
  habilite: "Habilité",
  avec_reserve: "Habilité avec réserve",
  non_habilite: "Non habilité",
  second_essai: "2e essai (nouvelle mise en situation)",
};

/** Les décisions qui ouvrent l'activation et les missions sur la formation. */
export const DECISIONS_EN_VIGUEUR: ReadonlySet<DecisionHabilitation> = new Set([
  "habilite",
  "avec_reserve",
]);

export function estDecisionHabilitation(v: unknown): v is DecisionHabilitation {
  return typeof v === "string" && (DECISIONS_HABILITATION as ReadonlyArray<string>).includes(v);
}

/** Longueur maximale d'un motif ou d'une observation. */
export const MOTIF_MAX = 2000;

export const LIBELLES_GRILLES = {
  entretien: "Entretien noté",
  mise_en_situation: "Mise en situation",
  decision_habilitation: "Décision d'habilitation",
  formation_methode: "Formation à la méthode suivie",
} as const;
