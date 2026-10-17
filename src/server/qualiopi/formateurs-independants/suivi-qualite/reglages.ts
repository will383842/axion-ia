/**
 * Formateurs indépendants — SUIVI DE LA QUALITÉ PÉDAGOGIQUE (Qualiopi ind. 21) :
 * les RÉGLAGES, réunis dans ce seul fichier.
 *
 * 🔴 TOUS « À VALIDER PAR WILL ». Ce sont des propositions : aucun nombre de ce lot
 * n'est écrit ailleurs. Les changer = modifier ce fichier, rien d'autre (les règles,
 * l'évaluateur d'alertes, la garde de mission et l'écran les lisent ici).
 *
 * Module PUR (ni Prisma, ni Next) : le worker et les tests le lisent.
 */

export const REGLAGES_SUIVI_QUALITE = {
  /** À valider par Will — moyenne minimale de l'observation de la 1re mission (sur 5). */
  observationMoyenneMin: 3.5,
  /** À valider par Will — moyenne minimale d'une réévaluation annuelle pour repartir pour un an. */
  reevaluationMoyenneMin: 3.5,
  /** À valider par Will — moyenne de la grille après mission sous laquelle elle est dite « réservée ». */
  evaluationMoyenneMin: 3.5,
  /**
   * À valider par Will — jours après la fin de la 1re mission avant l'alerte
   * « observation manquante » (0 = dès le lendemain de la dernière journée).
   */
  observationAlerteJours: 0,
  /** À valider par Will — relance interne de la grille après mission (jours après la fin). */
  evaluationRelanceJours: 3,
  /** À valider par Will — alerte si la grille après mission manque toujours (jours après la fin). */
  evaluationAlerteJours: 7,
  /** À valider par Will — satisfaction des stagiaires (sur 5) sous laquelle un entretien est à prévoir. */
  satisfactionEntretienSous: 4,
  /** À valider par Will — satisfaction (sur 5) sous laquelle les NOUVELLES missions sont suspendues. */
  satisfactionSuspensionSous: 3,
  /** À valider par Will — périodicité de la réévaluation, en mois après la décision d'habilitation. */
  reevaluationMois: 12,
  /** À valider par Will — rappel avant l'échéance de réévaluation, en jours. */
  reevaluationRappelJours: 30,
  /**
   * À valider par Will — à l'allumage, une échéance déjà dépassée est reportée de ce
   * nombre de jours : le rappel part toujours avant le premier refus, jamais de blocage
   * rétroactif le jour même.
   */
  reevaluationGraceAllumageJours: 30,
  /** À valider par Will — âge maximal du CV déclaré, en mois (décision du 15/10 : 24). */
  cvDeclareMaxMois: 24,
  /** À valider par Will — longueur minimale d'une conclusion ou d'un motif écrit. */
  texteMinCaracteres: 10,
} as const;

export type ReglagesSuiviQualite = typeof REGLAGES_SUIVI_QUALITE;

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
