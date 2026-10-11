/**
 * Formateurs indépendants — PARAMÈTRES D'ARGENT du paiement par mission (L15b).
 *
 * 🔑 UNE SEULE SOURCE. Aucun montant, taux ou délai du paiement par mission n'est
 * écrit ailleurs : les fonctions pures (`calcul-mission.ts`, `dates.ts`) les
 * reçoivent d'ici, et un test vérifie qu'aucune autre valeur ne circule.
 *
 * 🔴 RIEN DE CE FICHIER NE S'APPLIQUE TANT QUE `formateurs.passage_paiement` N'A
 * PAS DE DATE. Les valeurs sont celles du contrat-cadre v3 (arrêté par Will le
 * 10/10/2026) et, pour les décisions encore ouvertes (65 à 73, 87 à 89), la
 * RECOMMANDATION du plan, codée ÉTEINTE. Changer une valeur = une PR relue.
 *
 * Centimes entiers partout. Jamais de flottant sur un montant.
 */

export const PARAMETRES_ARGENT_FORMATEURS = {
  /** Contrat v3 art. 9.1 : honoraires d'une journée (deux demi-journées). */
  tarifJourneeHtCents: 35_000,
  /** Contrat v3 art. 10.2 : plafond du forfait par journée de déplacement. */
  plafondForfaitDeplacementParJourHtCents: 15_000,
  /** Contrat v3 art. 11.1 (décision 63) : part des honoraires annulés, en %. */
  indemniteAnnulationPourcent: 50,
  /** Contrat v3 art. 11.1 : délai sous lequel une annulation par Axion est indemnisée. */
  delaiAnnulationIndemniseeHeures: 72,
  /** L441-10 C. com. / contrat v3 art. 16 : délai de paiement, en jours civils. */
  delaiPaiementJours: 30,
  /** Contrat v3 art. 16.6 : pénalités = taux BCE + 10 points (en points de base). */
  majorationPenalitesBp: 1_000,
  /**
   * Taux directeur de la BCE du semestre, en points de base. NON RENSEIGNÉ :
   * tant qu'il est `null`, aucune pénalité n'est CALCULÉE — la ligne s'affiche
   * « à calculer à la main » (décision 87, ouverte). À mettre à jour le 1er janvier
   * et le 1er juillet (taux en vigueur au premier jour du semestre).
   */
  tauxBceBp: null as number | null,
  /** D441-5 C. com. : indemnité forfaitaire pour frais de recouvrement. */
  indemniteRecouvrementCents: 4_000,
  /** Contrat v3 art. 21.2 : présentation de la méthode, une demi-journée. */
  presentationMethodeHtCents: 17_500,
  /** Décision 89 : délai avant la demande de remboursement d'un trop-perçu. */
  delaiTropPercuJours: 60,
  /** Décision 72 : attente après une demande de changement d'IBAN. */
  delaiChangementIbanHeures: 48,
  /** Décision 69 / clause 4 bis : fenêtre de contestation d'une autofacture. */
  fenetreContestationJours: 8,
  /** Décision 67 : relance, alerte et « Payer sur constat », en jours après la journée. */
  feuillesRelanceJours: 3,
  feuillesAlerteJours: 10,
  feuillesSurConstatJours: 20,
  /** Décision 98 : alerte si le brouillon mensuel n'est pas validé N jours après le 1er. */
  releveMensuelAlerteJours: 5,
  /**
   * Seuil DAS 2 par bénéficiaire et par an (décision 70, §12.6 n° 13) : UN seul
   * paramètre, valeur PRUDENTE 1 200 € tant que le juriste n'a pas confirmé.
   */
  seuilDas2Cents: 120_000,
  /** Orange à J-5 de la date cible du virement. */
  orangeAvantDateCibleJours: 5,
  /**
   * Bornes du découpage en demi-journées d'une journée PRÉVUE (`SessionJour`).
   * Matin si la journée commence avant `matinAvant` ; après-midi si elle finit
   * après `apresMidiApres`. « 09:00–12:30 » = matin ; « 09:00–17:00 » = deux.
   */
  matinAvant: "12:00",
  apresMidiApres: "13:30",
  /** Journée aux horaires incohérents (ni matin ni après-midi) : rangée au créneau de son début. */
  milieuDeJournee: "13:00",
} as const;

export type ParametresArgentFormateurs = typeof PARAMETRES_ARGENT_FORMATEURS;
