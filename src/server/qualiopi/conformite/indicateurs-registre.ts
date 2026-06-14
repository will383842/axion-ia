/**
 * Qualiopi — Registre des 32 indicateurs officiels RNQ V9 (AGENT B — T12).
 *
 * Module PUR : aucune dépendance Prisma, Redis ou I/O.
 * Libellés EXACTS issus du doc verbatim :
 *   INDICATEURS_OFFICIELS_V9_VERBATIM.md (2026-06-05, grille canonique).
 *
 * Répartition critères : C1:1-3 / C2:4-8 / C3:9-16 / C4:17-20 / C5:21-22
 *                        C6:23-29 / C7:30-32. Total = 32.
 *
 * Super-indicateurs (NC majeure = échec certification) :
 *   1,2,4,5,9,11,12,21,23,26,27,30,31,32 (+7,16 si certifiant).
 *
 * Conditionnels :
 *   "cert"  → 3, 7, 16 (formations certifiantes)
 *   "app"   → 13, 14, 15 (apprentissage/CFA)
 *   "afest" → 28 (AFEST)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export type TypeActionQualiopi =
  | "classique"
  | "certifiante"
  | "foad"
  | "alternance_afest"
  | "sous_traitance"
  | "cpf"
  | "opco"
  | "handicap";

export type ConditionnelType = "cert" | "app" | "afest";

export interface IndicateurRNQ {
  /** Numéro officiel (1–32) */
  readonly numero: number;
  /** Critère de rattachement (1–7) */
  readonly critere: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Libellé court officiel RNQ V9 (verbatim canonique) */
  readonly libelleOfficiel: string;
  /**
   * Vrai si NC = NC majeure (échec certification).
   * +7 et +16 si certifiant — ces deux sont marqués super=false ici (tronc
   * commun) ; l'évaluation dynamique les passe à true selon typesAction.
   */
  readonly super: boolean;
  /** Conditionnel selon le type d'action exercée. undefined = tronc commun. */
  readonly conditionnel?: ConditionnelType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les 32 indicateurs — grille canonique
// ─────────────────────────────────────────────────────────────────────────────

export const INDICATEURS_RNQ: readonly IndicateurRNQ[] = [
  // Critère 1 — Information du public
  {
    numero: 1,
    critere: 1,
    libelleOfficiel: "Information accessible, complète et vérifiable sur les prestations",
    super: true,
  },
  {
    numero: 2,
    critere: 1,
    libelleOfficiel: "Indicateurs de résultats adaptés à la nature des prestations",
    super: true,
  },
  {
    numero: 3,
    critere: 1,
    libelleOfficiel: "Taux d'obtention des certifications préparées",
    super: false,
    conditionnel: "cert",
  },

  // Critère 2 — Objectifs et adaptation des prestations
  {
    numero: 4,
    critere: 2,
    libelleOfficiel: "Analyse du besoin du bénéficiaire",
    super: true,
  },
  {
    numero: 5,
    critere: 2,
    libelleOfficiel: "Objectifs de la prestation définis et adaptés",
    super: true,
  },
  {
    numero: 6,
    critere: 2,
    libelleOfficiel: "Contenus et modalités adaptés aux objectifs et publics",
    super: false,
  },
  {
    numero: 7,
    critere: 2,
    libelleOfficiel: "Adéquation des contenus aux exigences de la certification visée",
    super: false, // super si certifiant — évalué dynamiquement
    conditionnel: "cert",
  },
  {
    numero: 8,
    critere: 2,
    libelleOfficiel: "Positionnement et évaluation des acquis à l'entrée",
    super: false,
  },

  // Critère 3 — Accueil, accompagnement, suivi, évaluation
  {
    numero: 9,
    critere: 3,
    libelleOfficiel: "Information sur les conditions de déroulement",
    super: true,
  },
  {
    numero: 10,
    critere: 3,
    libelleOfficiel: "Adaptation de la prestation / accompagnement",
    super: false,
  },
  {
    numero: 11,
    critere: 3,
    libelleOfficiel: "Évaluation de l'atteinte des objectifs",
    super: true,
  },
  {
    numero: 12,
    critere: 3,
    libelleOfficiel: "Engagement des bénéficiaires / prévention des ruptures",
    super: true,
  },
  {
    numero: 13,
    critere: 3,
    libelleOfficiel: "Coordination des intervenants (apprentissage)",
    super: false,
    conditionnel: "app",
  },
  {
    numero: 14,
    critere: 3,
    libelleOfficiel: "Exercice de la citoyenneté (apprenti)",
    super: false,
    conditionnel: "app",
  },
  {
    numero: 15,
    critere: 3,
    libelleOfficiel: "Information sur les droits et devoirs de l'apprenti",
    super: false,
    conditionnel: "app",
  },
  {
    numero: 16,
    critere: 3,
    libelleOfficiel: "Présentation à la certification",
    super: false, // super si certifiant — évalué dynamiquement
    conditionnel: "cert",
  },

  // Critère 4 — Adéquation des moyens
  {
    numero: 17,
    critere: 4,
    libelleOfficiel: "Moyens humains et techniques adaptés",
    super: false,
  },
  {
    numero: 18,
    critere: 4,
    libelleOfficiel: "Coordination des acteurs / intervenants",
    super: false,
  },
  {
    numero: 19,
    critere: 4,
    libelleOfficiel: "Ressources pédagogiques mises à disposition",
    super: false,
  },
  {
    numero: 20,
    critere: 4,
    libelleOfficiel: "Personnels dédiés à l'accompagnement (handicap/CFA selon cas)",
    super: false,
  },

  // Critère 5 — Qualification du personnel
  {
    numero: 21,
    critere: 5,
    libelleOfficiel: "Détermination et mobilisation des compétences des intervenants",
    super: true,
  },
  {
    numero: 22,
    critere: 5,
    libelleOfficiel: "Entretien et développement des compétences (gestion de la compétence)",
    super: false,
  },

  // Critère 6 — Environnement professionnel
  {
    numero: 23,
    critere: 6,
    libelleOfficiel: "Veille légale et réglementaire",
    super: true,
  },
  {
    numero: 24,
    critere: 6,
    libelleOfficiel: "Veille sur les emplois et métiers",
    super: false,
  },
  {
    numero: 25,
    critere: 6,
    libelleOfficiel: "Veille sur les innovations pédagogiques et technologiques",
    super: false,
  },
  {
    numero: 26,
    critere: 6,
    libelleOfficiel: "Situations de handicap (accueil, accompagnement, réseaux)",
    super: true,
  },
  {
    numero: 27,
    critere: 6,
    libelleOfficiel: "Dispositions en matière de sous-traitance / co-traitance",
    super: true,
  },
  {
    numero: 28,
    critere: 6,
    libelleOfficiel: "Formation en situation de travail (AFEST)",
    super: false,
    conditionnel: "afest",
  },
  {
    numero: 29,
    critere: 6,
    libelleOfficiel: "Insertion professionnelle / débouchés",
    super: false,
  },

  // Critère 7 — Appréciations et amélioration continue
  {
    numero: 30,
    critere: 7,
    libelleOfficiel: "Recueil des appréciations des parties prenantes",
    super: true,
  },
  {
    numero: 31,
    critere: 7,
    libelleOfficiel: "Traitement des réclamations, difficultés et aléas",
    super: true,
  },
  {
    numero: 32,
    critere: 7,
    libelleOfficiel: "Mise en œuvre des mesures d'amélioration continue",
    super: true,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helper : indicateurs applicables selon les types d'action exercées
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne la liste des numéros d'indicateurs applicables pour les
 * `typesAction` déclarés par l'OF.
 *
 * - Tronc commun (conditionnel undefined) : toujours applicables.
 * - "cert"  : applicable si "certifiante" ∈ typesAction.
 * - "app"   : APPRENTISSAGE/CFA (off.13/14/15). Axion-IA n'exerce pas
 *             l'apprentissage → jamais applicable (découplé de l'AFEST). Ne PAS
 *             le rattacher à "alternance_afest" : ce sont des indicateurs apprenti
 *             (citoyenneté/droits de l'apprenti), distincts de l'AFEST (off.28).
 * - "afest" : applicable si "alternance_afest" ∈ typesAction (off.28).
 *
 * Retourne les numéros triés ascendants.
 */
export function indicateursApplicables(typesAction: string[]): number[] {
  const hasCert = typesAction.includes("certifiante");
  // "app" = apprentissage (CFA) : aucun type d'action correspondant chez Axion-IA.
  const hasApp = typesAction.includes("apprentissage");
  const hasAfest = typesAction.includes("alternance_afest");

  return INDICATEURS_RNQ.filter((ind) => {
    if (ind.conditionnel === undefined) return true;
    if (ind.conditionnel === "cert") return hasCert;
    if (ind.conditionnel === "app") return hasApp;
    if (ind.conditionnel === "afest") return hasAfest;
    return false;
  })
    .map((ind) => ind.numero)
    .sort((a, b) => a - b);
}

/**
 * Retourne vrai si l'indicateur `numero` est super-indicateur en tenant
 * compte des types d'action (off.7 et off.16 deviennent super si certifiant).
 */
export function estSuperIndicateur(numero: number, typesAction: string[]): boolean {
  const ind = INDICATEURS_RNQ.find((i) => i.numero === numero);
  if (ind === undefined) return false;
  if (ind.super) return true;
  // Super conditionnel : off.7 et off.16 si certifiant
  if ((numero === 7 || numero === 16) && typesAction.includes("certifiante")) return true;
  return false;
}
