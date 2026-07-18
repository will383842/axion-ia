// ============================================================================
// CATALOGUE V2 — métadonnées d'affichage (durées, gammes, sur-mesure, ISO).
//
// Couche d'affichage dérivée du catalogue (catalog-v2.ts) + de la matrice prix
// (pricing.ts). Alimente les pages listing par durée, les blocs de gamme et la
// page tarifs. Aucun prix en dur (les pages dérivent via les helpers pricing).
// ============================================================================

import type { FormationDuree, FormationGamme } from "../pricing";

/**
 * Durée ISO 8601 par durée catalogue — pour `Course.hasCourseInstance.courseWorkload`.
 * 1 jour = PT7H (≈ 7 h face-à-face, décision 2026-06-11). 2j = P2D, 3j = P3D.
 */
export const FORMATION_DUREE_ISO: Record<FormationDuree, string> = {
  "4h": "PT4H",
  "1j": "PT7H",
  "2j": "P2D",
  "3j": "P3D",
};

export function formationDureeIso(duree: FormationDuree): string {
  return FORMATION_DUREE_ISO[duree];
}

// ── Durées (axe 1) ──────────────────────────────────────────────────────────

export interface DureeMeta {
  id: FormationDuree;
  /** Segment d'URL (`/formations/4-heures`…). */
  slug: string;
  labelFr: string;
  shortFr: string;
  /** Heures pédagogiques affichées (face-à-face). */
  heuresFr: string;
  taglineFr: string;
}

export const FORMATION_DUREES_META: ReadonlyArray<DureeMeta> = [
  {
    id: "4h",
    slug: "4-heures",
    labelFr: "Formats 4 heures",
    shortFr: "4 h",
    heuresFr: "4 heures",
    taglineFr:
      "Découverte, tous postes mélangés, sans pré-requis. Une demi-journée : votre activité n'est pas désorganisée.",
  },
  {
    id: "1j",
    slug: "1-jour",
    labelFr: "Formats 1 jour",
    shortFr: "1 j",
    heuresFr: "1 journée (6-8 h)",
    taglineFr:
      "Approfondissement sur vos documents réels — chaque participant repart avec un livrable terminé.",
  },
  {
    id: "2j",
    slug: "2-jours",
    labelFr: "Formats 2 jours",
    shortFr: "2 j",
    heuresFr: "2 jours (12-14 h)",
    taglineFr: "Intégration : jour 1 la maîtrise, jour 2 vos vrais dossiers traités en séance.",
  },
  {
    id: "3j",
    slug: "3-jours",
    labelFr: "Formats 3 jours",
    shortFr: "3 j",
    heuresFr: "3 jours (18-21 h)",
    taglineFr: "Transformation : processus complets, référents formés, équipe autonome.",
  },
];

export function getDureeMeta(duree: FormationDuree): DureeMeta {
  const m = FORMATION_DUREES_META.find((d) => d.id === duree);
  if (!m) throw new Error(`[catalog-v2-meta] durée inconnue : "${duree}"`);
  return m;
}

export function getDureeMetaBySlug(slug: string): DureeMeta | undefined {
  return FORMATION_DUREES_META.find((d) => d.slug === slug);
}

// ── Gammes (axe 2) ──────────────────────────────────────────────────────────

export interface GammeMeta {
  id: FormationGamme;
  /** Segment d'URL (`/formations/claude`…). */
  slug: string;
  labelFr: string;
  taglineFr: string;
  /** Accent visuel (mappé Tailwind côté composant). */
  accent: "terracotta" | "sage" | "claude";
  /**
   * `true` = gamme thématique avec son propre bloc/page (Claude, Agents).
   * `false` = gamme IA « standard », présentée par durée.
   */
  thematique: boolean;
}

export const FORMATION_GAMMES_META: ReadonlyArray<GammeMeta> = [
  {
    id: "ia-standard",
    slug: "ia",
    labelFr: "Gamme IA",
    taglineFr:
      "Les formations IA générales, par durée : de la découverte en 4 h à la transformation d'équipe en 3 jours.",
    accent: "terracotta",
    thematique: false,
  },
  {
    id: "agents-automatisations",
    // Slug d'URL « agents » (≠ slugFr de la formation « agents-automatisations »)
    // pour éviter toute collision de namespace /formations/gamme/… ↔ /formations/….
    slug: "agents",
    labelFr: "Agents & Automatisations",
    taglineFr:
      "Vos équipes créent leurs propres automatisations en code source qui appartient à l'entreprise — sans savoir coder, zéro abonnement. Groupes limités à 12.",
    accent: "sage",
    thematique: true,
  },
  {
    id: "claude",
    slug: "claude",
    labelFr: "Gamme Claude",
    taglineFr:
      "Formateur expert de l'écosystème Claude (+20 %) : trois niveaux progressifs, chacun repart avec son outil construit, pas avec des notes.",
    accent: "claude",
    thematique: true,
  },
];

export function getGammeMeta(gamme: FormationGamme): GammeMeta {
  const m = FORMATION_GAMMES_META.find((g) => g.id === gamme);
  if (!m) throw new Error(`[catalog-v2-meta] gamme inconnue : "${gamme}"`);
  return m;
}

export function getGammeMetaBySlug(slug: string): GammeMeta | undefined {
  return FORMATION_GAMMES_META.find((g) => g.slug === slug);
}

/** Gammes thématiques (bloc/page propre) : Agents, Claude. */
export function getGammesThematiques(): ReadonlyArray<GammeMeta> {
  return FORMATION_GAMMES_META.filter((g) => g.thematique);
}

// ── Sur-mesure (devis) ──────────────────────────────────────────────────────

export interface SurMesureMeta {
  id: string;
  labelFr: string;
  /** Durée indicative (libellé libre, ex « 2 à 3 jours »). */
  dureeFr: string;
  descriptionFr: string;
  /** Durée catalogue rattachée (pour afficher la carte sur la bonne page durée). */
  duree?: FormationDuree;
  /** Gamme rattachée (pour afficher sur la page gamme). */
  gamme?: FormationGamme;
}

export const SUR_MESURE: ReadonlyArray<SurMesureMeta> = [
  {
    id: "express-sur-mesure",
    labelFr: "Express Sur Mesure",
    dureeFr: "4 heures",
    duree: "4h",
    descriptionFr:
      "Votre demi-journée construite à 100 % avec vous : thème, public, cas pratiques définis ensemble.",
  },
  {
    id: "journee-sur-mesure",
    labelFr: "Journée Sur Mesure",
    dureeFr: "1 jour",
    duree: "1j",
    descriptionFr: "Programme co-construit avec vous : vos équipes, vos outils, vos objectifs.",
  },
  {
    id: "integration-sur-mesure",
    labelFr: "Intégration Sur Mesure",
    dureeFr: "2 jours",
    duree: "2j",
    descriptionFr:
      "2 jours conçus à 100 % avec vous : processus ciblés, équipes choisies, résultats définis ensemble.",
  },
  {
    id: "transformation-sur-mesure",
    labelFr: "Transformation Sur Mesure",
    dureeFr: "3 jours",
    duree: "3j",
    descriptionFr:
      "Le programme complet bâti avec votre direction : multi-équipes, multi-sites, objectifs chiffrés.",
  },
  {
    id: "automatisations-sur-mesure",
    labelFr: "Automatisations Sur Mesure",
    dureeFr: "2 à 3 jours",
    gamme: "agents-automatisations",
    descriptionFr:
      "Vos automatisations prioritaires définies ensemble — que vos équipes construisent en formation, guidées pas à pas.",
  },
  {
    id: "claude-sur-mesure",
    labelFr: "Claude Sur Mesure",
    dureeFr: "1 à 3 jours",
    gamme: "claude",
    descriptionFr:
      "Votre déploiement Claude conçu avec vous : équipes, usages, configuration entreprise.",
  },
  {
    id: "formation-100-sur-mesure",
    labelFr: "Formation 100 % sur mesure",
    dureeFr: "toute durée, toute gamme",
    descriptionFr:
      "Nous construisons votre formation de A à Z : contenu, durée, format, équipes concernées — de la TPE au grand compte. Combinaisons de gammes possibles, multi-sites, secteurs réglementés.",
  },
];

export function getSurMesureByDuree(duree: FormationDuree): ReadonlyArray<SurMesureMeta> {
  return SUR_MESURE.filter((s) => s.duree === duree);
}

export function getSurMesureByGamme(gamme: FormationGamme): ReadonlyArray<SurMesureMeta> {
  return SUR_MESURE.filter((s) => s.gamme === gamme);
}

/** Offres sur-mesure GLOBALES (ni durée ni gamme spécifique — ex. « 100 % sur mesure »). */
export function getSurMesureGlobal(): ReadonlyArray<SurMesureMeta> {
  return SUR_MESURE.filter((s) => !s.duree && !s.gamme);
}
