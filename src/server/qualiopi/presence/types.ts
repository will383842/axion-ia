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
