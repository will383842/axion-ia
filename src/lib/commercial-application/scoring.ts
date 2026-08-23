// Scoring des candidatures commerciales — chantier C1 du plan de recrutement.
//
// Le problème qu'il résout : à 30-60 candidatures par semaine, on ne peut pas
// rappeler tout le monde. Rappeler dans l'ordre d'arrivée fait passer 80 % du
// temps sur des profils qui ne vendront rien, pendant que les trois excellents
// attendent dix jours et vont voir ailleurs.
//
// FONCTION PURE — elle prend les réponses du formulaire, elle rend un nombre.
// Pas de base, pas de réseau, pas d'IA, pas d'horloge. C'est ce qui la rend
// testable exhaustivement et rejouable sur une candidature de l'an dernier.
//
// 🔴 LE SCORE ORIENTE, IL NE REJETTE JAMAIS.
// Aucune candidature n'est supprimée, refusée ni masquée par ce calcul. Un
// profil noté 35 peut être un retraité avec quarante ans de carnet d'adresses
// que le barème ne sait pas voir — il reste joignable, il passe simplement par
// l'échange collectif au lieu d'un appel prioritaire. Tout usage de ce score
// comme filtre d'exclusion trahirait son intention.
//
// À RELIRE TOUS LES MOIS en le confrontant à ceux qui vendent VRAIMENT. Un
// barème posé une fois et jamais revu mesure les convictions de son auteur,
// pas la réalité du terrain.
//
// Source du barème : `docs/plan-recrutement-apporteurs-daffaires.md` §4.4.

import type { CommercialApplicationInput } from "./model";

/** Poids maximum de chaque critère. La somme fait exactement 100. */
export const SCORE_POIDS = {
  carnet: 25,
  b2bAnnees: 25,
  statut: 12,
  typesClients: 10,
  deplacement: 8,
  ia: 8,
  informatique: 7,
  zone: 5,
} as const;

export type ScoreCritere = keyof typeof SCORE_POIDS;

/** Seuils d'aiguillage. Voir `PRIORITES` pour ce que chacun déclenche. */
export const SCORE_SEUIL_HAUTE = 70;
export const SCORE_SEUIL_MOYENNE = 40;

export type ScorePriorite = "haute" | "moyenne" | "vivier";

export interface ScoreCandidature {
  /** 0 à 100. */
  readonly total: number;
  /** Détail par critère — affiché en console pour rendre la note explicable. */
  readonly parts: Readonly<Record<ScoreCritere, number>>;
  readonly priorite: ScorePriorite;
}

/** Ce que chaque priorité déclenche. Sert la console et la documentation. */
export const PRIORITES: Readonly<Record<ScorePriorite, { label: string; action: string }>> = {
  haute: { label: "Prioritaire", action: "Appel personnel sous 24 h" },
  moyenne: { label: "À qualifier", action: "Invitation à l'échange visio" },
  vivier: { label: "Vivier", action: "Séquence email, pas d'appel" },
};

// ── Barèmes par critère ─────────────────────────────────────────────────────

const CARNET: Readonly<Record<string, number>> = {
  "150-plus": 25,
  "50-150": 21,
  "20-50": 15,
  "5-20": 8,
  "0-5": 2,
};

const B2B_ANNEES: Readonly<Record<string, number>> = {
  "plus-10": 25,
  "5-10": 21,
  "3-5": 15,
  "1-3": 8,
  "moins-1": 2,
};

/** Peut facturer demain matin = aucun frein administratif au démarrage. */
const STATUT: Readonly<Record<string, number>> = {
  independant: 12,
  "auto-entrepreneur": 12,
  "creation-statut": 7,
  salarie: 4,
  "en-recherche": 4,
};

const DEPLACEMENT: Readonly<Record<string, number>> = {
  oui: 8,
  ponctuellement: 5,
  non: 1,
};

/**
 * Calcule la note d'une candidature.
 *
 * Chaque critère absent vaut 0 : une réponse non donnée n'est jamais pénalisée
 * au-delà de son propre poids, et n'invalide jamais le calcul.
 */
export function scoreCandidature(d: CommercialApplicationInput): ScoreCandidature {
  // Le carnet d'adresses — le meilleur prédicteur du premier contact déposé.
  const carnet = d.carnetDirigeants ? (CARNET[d.carnetDirigeants] ?? 0) : 0;

  // L'expérience de la vente aux entreprises. `b2bDejaVendu === false` vaut 0
  // même si `b2bAnnees` traîne d'un aller-retour dans le wizard : c'est la
  // réponse la plus récente qui fait foi.
  const b2bAnnees = d.b2bDejaVendu && d.b2bAnnees ? (B2B_ANNEES[d.b2bAnnees] ?? 0) : 0;

  const statut = d.statut ? (STATUT[d.statut] ?? 0) : 0;

  // Les types de clients vivent sur CHAQUE expérience, pas au niveau racine :
  // on agrège. Vendre aux entreprises (ou en mixte) au moins une fois suffit —
  // c'est une aptitude, pas une proportion.
  const vendAuxEntreprises = d.experiences.some((e) =>
    (e.typesClients ?? []).some((t) => t === "entreprises" || t === "mixte"),
  );
  const typesClients = vendAuxEntreprises ? SCORE_POIDS.typesClients : 0;

  const deplacement = DEPLACEMENT[d.deplacement] ?? 0;

  // Utiliser déjà un outil IA ne dit rien de la compétence — seulement que le
  // sujet ne fera pas peur au premier rendez-vous. D'où un poids modeste.
  const ia = d.iaUtilise && (d.iaOutils?.length ?? 0) > 0 ? SCORE_POIDS.ia : 0;

  // CRM ou LinkedIn : sait prospecter avec des outils, donc saura déposer un
  // contact sans qu'on lui tienne la main.
  const usages = d.informatiqueUsages ?? [];
  const informatique =
    d.informatiqueUtilise && (usages.includes("crm") || usages.includes("linkedin"))
      ? SCORE_POIDS.informatique
      : 0;

  // ⚠️ Le plan §4.4 décrivait « territoire cohérent ET NON DÉJÀ SATURÉ ». La
  // saturation dépend des autres apporteurs, donc de la base — impossible dans
  // une fonction pure, et la faire dépendre de la base lui coûterait sa
  // testabilité pour cinq points. On ne mesure donc que ce qui est vérifiable
  // ici : une zone de travail exploitable est déclarée. Si la saturation
  // devient un vrai sujet, elle se traitera en console, pas dans ce calcul.
  const zone = d.zoneMobile || (d.zones?.length ?? 0) > 0 ? SCORE_POIDS.zone : 0;

  const parts = {
    carnet,
    b2bAnnees,
    statut,
    typesClients,
    deplacement,
    ia,
    informatique,
    zone,
  } as const;

  const total = Object.values(parts).reduce((a, b) => a + b, 0);

  const priorite: ScorePriorite =
    total >= SCORE_SEUIL_HAUTE ? "haute" : total >= SCORE_SEUIL_MOYENNE ? "moyenne" : "vivier";

  return { total, parts, priorite };
}
