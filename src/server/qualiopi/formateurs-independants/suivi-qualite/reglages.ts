/**
 * Formateurs indépendants — SUIVI DE LA QUALITÉ PÉDAGOGIQUE (Qualiopi ind. 21) :
 * les RÉGLAGES, réunis dans ce seul fichier.
 *
 * 🔴 TOUS « À VALIDER PAR WILL ». Ce sont des propositions : aucun nombre de ce lot
 * n'est écrit ailleurs. Ce sont des RÉGLAGES modifiables en console (`/qualiopi/config`,
 * clés `suivi_qualite_*`), lus par `reglages-lecture.ts` ; les constantes ci-dessous en
 * sont les DÉFAUTS (les règles, l'évaluateur d'alertes, la garde de mission et l'écran
 * reçoivent la valeur réglée). Réglage absent, illisible ou hors bornes : le défaut.
 *
 * Module PUR (ni Prisma, ni Next) : le worker et les tests le lisent.
 */

export interface ReglagesSuiviQualite {
  readonly observationMoyenneMin: number;
  readonly reevaluationMoyenneMin: number;
  readonly evaluationMoyenneMin: number;
  readonly observationAlerteJours: number;
  readonly evaluationRelanceJours: number;
  readonly evaluationAlerteJours: number;
  readonly satisfactionEntretienSous: number;
  readonly satisfactionSuspensionSous: number;
  readonly reevaluationMois: number;
  readonly reevaluationRappelJours: number;
  readonly reevaluationGraceAllumageJours: number;
  readonly cvDeclareMaxMois: number;
  readonly texteMinCaracteres: number;
}

/** Les DÉFAUTS des réglages. ⚠️ À valider par Will. */
export const REGLAGES_SUIVI_QUALITE: ReglagesSuiviQualite = {
  /** ⚠️ À valider par Will — moyenne minimale de l'observation de la 1re mission (sur 5). */
  observationMoyenneMin: 3.5,
  /** ⚠️ À valider par Will — moyenne minimale d'une réévaluation annuelle pour repartir pour un an. */
  reevaluationMoyenneMin: 3.5,
  /** ⚠️ À valider par Will — moyenne de la grille après mission sous laquelle elle est dite « réservée ». */
  evaluationMoyenneMin: 3.5,
  /**
   * ⚠️ À valider par Will — jours après la fin de la 1re mission avant l'alerte
   * « observation manquante » (0 = dès le lendemain de la dernière journée).
   */
  observationAlerteJours: 0,
  /** ⚠️ À valider par Will — relance interne de la grille après mission (jours après la fin). */
  evaluationRelanceJours: 3,
  /** ⚠️ À valider par Will — alerte si la grille après mission manque toujours (jours après la fin). */
  evaluationAlerteJours: 7,
  /** ⚠️ À valider par Will — satisfaction des stagiaires (sur 5) sous laquelle un entretien est à prévoir. */
  satisfactionEntretienSous: 4,
  /** ⚠️ À valider par Will — satisfaction (sur 5) sous laquelle les NOUVELLES missions sont suspendues. */
  satisfactionSuspensionSous: 3,
  /** ⚠️ À valider par Will — périodicité de la réévaluation, en mois après la décision d'habilitation. */
  reevaluationMois: 12,
  /** ⚠️ À valider par Will — rappel avant l'échéance de réévaluation, en jours. */
  reevaluationRappelJours: 30,
  /**
   * ⚠️ À valider par Will — à l'allumage, une échéance déjà dépassée est reportée de ce
   * nombre de jours : le rappel part toujours avant le premier refus, jamais de blocage
   * rétroactif le jour même.
   */
  reevaluationGraceAllumageJours: 30,
  /** ⚠️ À valider par Will — âge maximal du CV déclaré, en mois (décision du 15/10 : 24). */
  cvDeclareMaxMois: 24,
  /** ⚠️ À valider par Will — longueur minimale d'une conclusion ou d'un motif écrit. */
  texteMinCaracteres: 10,
};

/**
 * Bornes d'un réglage lisible : [min, max, pas]. Notes et satisfaction sur 5, comparées
 * au centième ; jours, mois et caractères entiers. Hors bornes, hors pas ou illisible :
 * le défaut.
 */
export const BORNES_SUIVI_QUALITE = {
  observationMoyenneMin: [1, 5, 0.01],
  reevaluationMoyenneMin: [1, 5, 0.01],
  evaluationMoyenneMin: [1, 5, 0.01],
  observationAlerteJours: [0, 60, 1],
  evaluationRelanceJours: [0, 60, 1],
  evaluationAlerteJours: [1, 90, 1],
  satisfactionEntretienSous: [1, 5, 0.01],
  satisfactionSuspensionSous: [1, 5, 0.01],
  reevaluationMois: [1, 36, 1],
  reevaluationRappelJours: [0, 180, 1],
  reevaluationGraceAllumageJours: [0, 180, 1],
  cvDeclareMaxMois: [1, 60, 1],
  texteMinCaracteres: [1, 500, 1],
} as const satisfies Record<keyof ReglagesSuiviQualite, readonly [number, number, number]>;

function borne(k: keyof ReglagesSuiviQualite, v: unknown): number {
  const [min, max, pas] = BORNES_SUIVI_QUALITE[k];
  return typeof v === "number" &&
    Number.isFinite(v) &&
    v >= min &&
    v <= max &&
    Math.abs(v / pas - Math.round(v / pas)) < 1e-9
    ? v
    : REGLAGES_SUIVI_QUALITE[k];
}

/**
 * Les réglages lus, ramenés au défaut s'ils sont illisibles ou hors bornes. Deux paires
 * se lisent ENSEMBLE : une relance après l'alerte, ou une suspension au-dessus du seuil
 * d'entretien, n'a pas de sens — la paire entière revient alors à ses défauts.
 */
export function reglagesSuiviQualite(lus: {
  readonly [K in keyof ReglagesSuiviQualite]: unknown;
}): ReglagesSuiviQualite {
  const r = Object.fromEntries(
    (Object.keys(BORNES_SUIVI_QUALITE) as Array<keyof ReglagesSuiviQualite>).map((k) => [
      k,
      borne(k, lus[k]),
    ]),
  ) as unknown as { -readonly [K in keyof ReglagesSuiviQualite]: number };
  if (r.evaluationRelanceJours > r.evaluationAlerteJours) {
    r.evaluationRelanceJours = REGLAGES_SUIVI_QUALITE.evaluationRelanceJours;
    r.evaluationAlerteJours = REGLAGES_SUIVI_QUALITE.evaluationAlerteJours;
  }
  if (r.satisfactionSuspensionSous > r.satisfactionEntretienSous) {
    r.satisfactionSuspensionSous = REGLAGES_SUIVI_QUALITE.satisfactionSuspensionSous;
    r.satisfactionEntretienSous = REGLAGES_SUIVI_QUALITE.satisfactionEntretienSous;
  }
  return r;
}

/** Les critères de chaque grille, VERSIONNÉS : une grille saisie garde sa version. */
export interface CritereGrille {
  readonly code: string;
  readonly libelle: string;
}

/**
 * À valider par Will — les critères notés sur 5. Changer un libellé ou la liste =
 * monter la version : les grilles déjà saisies restent lues avec la leur.
 */
export const GRILLES_SUIVI_QUALITE = {
  observation: {
    version: 1,
    criteres: [
      { code: "preparation", libelle: "Préparation et maîtrise du déroulé" },
      { code: "expertise", libelle: "Maîtrise du sujet et exactitude des contenus" },
      { code: "pedagogie", libelle: "Clarté des explications et méthodes actives" },
      { code: "animation", libelle: "Animation du groupe et gestion du temps" },
      { code: "objectifs", libelle: "Atteinte des objectifs annoncés" },
      { code: "posture", libelle: "Posture professionnelle et relation aux stagiaires" },
    ],
  },
  evaluation_mission: {
    version: 1,
    criteres: [
      { code: "deroule", libelle: "Respect du programme et du déroulé" },
      { code: "objectifs", libelle: "Atteinte des objectifs pédagogiques" },
      { code: "administratif", libelle: "Émargement, documents et délais respectés" },
      { code: "communication", libelle: "Communication avec l'organisme et le client" },
    ],
  },
  reevaluation: {
    version: 1,
    criteres: [
      { code: "competences", libelle: "Compétences à jour sur les formations habilitées" },
      { code: "resultats", libelle: "Résultats de l'année (évaluations, satisfaction)" },
      { code: "veille", libelle: "Veille et formation continue du formateur" },
      { code: "engagements", libelle: "Respect des engagements de l'organisme" },
    ],
  },
} as const satisfies Record<string, { version: number; criteres: readonly CritereGrille[] }>;

export type TypeGrilleSuivi = keyof typeof GRILLES_SUIVI_QUALITE;
