/**
 * Types partagés — Émargement présentiel + relevé de connexion Qualiopi (T8).
 *
 * Ces types sont définis ici (AGENT A) et importés par les agents B et C.
 * Aucun import Prisma / accès DB dans ce fichier.
 */

/** Demi-journée d'une session de formation. */
export type DemiJourneeLabel = "matin" | "apres_midi" | "journee";

/** Plateforme de visioconférence distancielle. */
export type PlateformeLabel = "zoom" | "teams" | "meet" | "autre";

/**
 * Créneau planifié d'une session.
 * Correspond à une demi-journée (matin / après-midi) ou une journée complète.
 */
export interface CreneauPlan {
  /** Date ISO "2026-06-10" en fuseau Europe/Paris. */
  date: string;
  demiJournee: DemiJourneeLabel;
  /** Libellé lisible, ex. "2026-06-10 matin". */
  libelle: string;
  /** Durée planifiée en minutes pour ce créneau. */
  dureePrevueMinutes: number;
  /**
   * Horaires RÉELS de la JOURNÉE dont ce créneau fait partie, `HH:MM`.
   *
   * Présents uniquement si la session a déclaré ses journées (`session_jours`,
   * décision D14). Absents = la session est en repli sur `dateDebut..dateFin`,
   * et l'appelant ne doit alors afficher AUCUN horaire plutôt qu'un horaire
   * inventé : c'est précisément le « 09h00–17h00 » codé en dur que sanctionne
   * CAA Nantes 20/04/2021 sur une pièce à valeur probante.
   *
   * ⚠️ Horaires de la journée, pas du créneau : la table ne descend pas au grain
   * de la demi-journée.
   */
  jourHeureDebut?: string;
  jourHeureFin?: string;
}

/**
 * Participant tel que parsé depuis un rapport d'export de plateforme.
 * Un participant peut avoir plusieurs intervalles de connexion ; ceux-ci
 * sont agrégés avant de stocker (dureeMinutes = somme des intervalles).
 */
export interface ParsedParticipant {
  /** Nom brut issu du rapport (avant normalisation). */
  nomBrut: string;
  /** Email en minuscules, ou null si absent du rapport. */
  email: string | null;
  /** Première connexion (UTC), ou null si indisponible. */
  joinAt: Date | null;
  /** Dernière déconnexion (UTC), ou null si indisponible. */
  leaveAt: Date | null;
  /** Somme des minutes de connexion effectives. */
  dureeMinutes: number;
  /**
   * 🔴 `DIST-01` (2026-08-20) — présence ventilée par JOURNÉE civile (Paris).
   *
   * Les trois champs ci-dessus réduisent un participant à un seul triplet. Sur
   * un export couvrant plusieurs journées, cette réduction détruit
   * l'information décisive : QUEL JOUR la personne était là. L'import ne créait
   * alors des créneaux que pour la journée de la première connexion, et un
   * stagiaire venu 1 jour sur 2 ressortait à **100 %** — le dénominateur ne
   * couvrait que le jour où il était présent.
   *
   * Les trois champs historiques sont CONSERVÉS et dérivés de cette ventilation
   * (`agregerVentilation`), jamais recalculés en parallèle : deux calculs du
   * même total finissent par diverger, et l'écart reste plausible des deux
   * côtés.
   */
  parJour: ReadonlyArray<import("./ventilation-jour").PresenceJour>;
}

/**
 * Résultat du parsing d'un rapport de présence (Zoom / Teams / Meet / autre).
 */
export interface ParsedReleve {
  plateforme: PlateformeLabel;
  /** Identifiant de la réunion extrait du rapport, ou null. */
  idReunion: string | null;
  participants: ParsedParticipant[];
  /** Nombre de lignes brutes traitées (hors en-tête). */
  nbLignes: number;
  /** Métadonnées additionnelles (titre réunion, date hôte, etc.). */
  meta: Record<string, string | number | null>;
}

/** Entrée pour la mise en correspondance participants ↔ inscrits. */
export interface MatchInput {
  enrollmentId: string;
  email: string;
  nom: string;
  prenom: string;
}

/** Résultat de la mise en correspondance. */
export interface MatchResult {
  matched: Array<{ enrollmentId: string; participant: ParsedParticipant }>;
  unmatched: ParsedParticipant[];
}

/** Résultat du calcul de taux de présence. */
export interface TauxResult {
  tauxPct: number;
  minutesPrevues: number;
  minutesRealisees: number;
}
