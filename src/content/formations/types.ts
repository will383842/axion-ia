// SSOT « squelette formation » — types.
//
// Source unique AMONT de la DURÉE et du CONTENU pédagogique d'une formation.
// Les couches existantes (interventions.ts, interventions-taxonomy.ts,
// interventions-subpages.ts, booking-catalog.ts, seed Qualiopi offres.ts)
// DÉRIVENT de ce module — elles ne dupliquent plus.
//
// Le PRIX n'est PAS porté ici : chaque squelette référence un `tierId` de
// `pricing.ts` (SSOT prix) ; le prix reste lu via getTierById/formatPrice.
//
// Voir le plan : centraliser durée + contenu + pont Qualiopi en un seul endroit.

import type { ModalitePedagogique } from "./modalites";

/** Familles marketing /interventions (miroir de interventions-taxonomy.ts:Family). */
export type FormationFamily = "collectives" | "individuel" | "dirigeants";

/** Archetype de durée — paliers canoniques partagés (miroir CollectiveDuration). */
export type FormationDurationId = "4h" | "1-jour" | "2-jours" | "3-jours-plus";

/**
 * Descripteur canonique d'un palier de durée. C'est la SOURCE de toutes les
 * représentations historiquement éclatées :
 *  - `iso`   → `Course.hasCourseInstance.courseWorkload` (JSON-LD) + taxonomy
 *  - `days`  → `InterventionSummary.durationDays` + `BookingFormat.durationDays`
 *              (blocage calendrier) + dérivation jours
 *  - labels  → `DurationDef.durationDetail*`, badges, libellés d'affichage
 *
 * Les HEURES réelles (Qualiopi) sont portées PAR FORMATION (cf. FormationSkeleton),
 * pas par l'archetype : `intervention-sur-demande` (4-21 h) ne tient pas dans un
 * palier fixe.
 */
export interface FormationDurationCanonical {
  id: FormationDurationId;
  /** Jours « réservation » pour bloquer N jours consécutifs au calendrier. */
  days: 0.5 | 1 | 2 | 3;
  /**
   * Durée ISO 8601 Schema.org (`PT4H`, `PT7H`, `P2D`). `null` pour les paliers
   * « sur devis » à durée variable (3 jours et +).
   * Décision 2026-06-11 : 1 jour canonique = `PT7H` (≈ 7 h face-à-face, aligné
   * sur les heures Qualiopi 6-8 h). Supprime la dérive historique `PT7H`/`PT8H`.
   */
  iso: string | null;
  labelFr: string;
  labelEn: string;
  /** Forme courte (badges, breadcrumbs). */
  shortFr: string;
  shortEn: string;
  /** Précision horaire affichée (ex « 9 h – 17 h », « ≈ 4 h »). */
  scheduleHintFr: string;
  scheduleHintEn: string;
}

/** Un créneau du programme pédagogique (bilingue, locale-agnostique). */
export interface FormationProgrammeItem {
  /** « 9 h 00 », « Pause », etc. (FR ; le rendu EN reformate via le converter). */
  time: string;
  timeEn: string;
  titleFr: string;
  titleEn: string;
  descFr?: string;
  descEn?: string;
}

/** Un jour du programme (1 entrée pour un format 1 jour, N pour multi-jours). */
export interface FormationProgrammeDay {
  labelFr?: string;
  labelEn?: string;
  items: ReadonlyArray<FormationProgrammeItem>;
}

/**
 * Programme pédagogique structuré, bilingue. Slot rempli par Will lors de la
 * réécriture du contenu — `undefined` tant qu'il n'est pas rédigé (les 3
 * formations approfondie / gagner-du-temps / intervention-claude aujourd'hui).
 */
export interface FormationProgramme {
  titleFr: string;
  titleEn: string;
  introFr?: string;
  introEn?: string;
  days: ReadonlyArray<FormationProgrammeDay>;
}

/**
 * Squelette d'une formation = source unique pour le marketing ET le Qualiopi.
 * Une entrée par `tierId` de `INTERVENTION_TIERS` (pricing.ts) représentant une
 * formation. Le pont Qualiopi (seed `OffreSite`) et les pages marketing
 * `/interventions/*` dérivent tous de la même entrée.
 */
export interface FormationSkeleton {
  /** Identifiant stable = slug marketing FR (clé de lookup principale page). */
  id: string;
  /** Lien vers le SSOT prix (∈ INTERVENTION_TIERS). Jamais de prix ici. */
  tierId: string;
  slugFr: string;
  slugEn: string;
  family: FormationFamily;
  /** Palier durée de la taxonomy Collectives (seulement family === "collectives"). */
  collectiveDuration?: FormationDurationId;
  /** Archetype de durée canonique référencé (universel, toutes familles). */
  duration: FormationDurationId;
  /** Heures face-à-face réelles (Qualiopi) — source du seed `OffreSite.dureeHeures*`. */
  hoursMin: number;
  hoursMax: number;
  /**
   * Libellé de durée AFFICHÉ, spécifique au format (ex « 1 journée sur site
   * (9 h – 17 h) », « 1 journée + rapport sous 7 jours »). Source de
   * `InterventionSummary.duration`. Migration 1:1 du texte existant.
   */
  summaryDurationFr: string;
  summaryDurationEn: string;
  /** Public visé — source de `OffreSite.publicViseFr` (seed Qualiopi). */
  publicViseFr: string;
  /** Modalités pédagogiques — source de `OffreSite.modalites`. */
  modalites: ReadonlyArray<ModalitePedagogique>;
  /** Programme pédagogique structuré (slot Will). `undefined` si non rédigé. */
  programme?: FormationProgramme;
}
