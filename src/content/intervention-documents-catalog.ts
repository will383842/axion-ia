// SSOT — Catalogue des documents d'intervention (bibliothèque admin).
//
// POURQUOI ce fichier existe
// --------------------------
// La bibliothèque « Documents interventions » centralise les documents
// pédagogiques de CHAQUE prestation (formation / 1-to-1 / audit). Ce module
// est la SOURCE UNIQUE de :
//   1. la liste des prestations par famille → DÉRIVÉE de `booking-catalog.ts`
//      (0 hardcode : 17 formations + 1-to-1 + 4 audits viennent du catalogue) ;
//   2. la taxonomie des « slots » de documents par famille (les sections du
//      kit : 01 Stagiaires / 02 Formateur / 03 Cadre / 04 Évaluation),
//      calée sur la structure réelle du kit gold-standard IA Express.
//
// CONTRAT
// -------
//   - Un `slot.key` est stable et sert de clé en base (InterventionDocument.slot).
//   - `visibilite` gouverne la diffusion (envoi/export), PAS l'accès admin.
//   - `qualiopiDocType` : si renseigné, le slot est AUSSI produit par le
//     Formation Engine → l'UI agrège les documents générés (lecture), on ne
//     duplique pas. `generatedOnly` = le document vient UNIQUEMENT du Formation
//     Engine (ex. attestation/émargement : vraies données, QR, rétention) →
//     pas d'upload manuel, juste un lien.
//   - FR canonique (EN désactivé runtime : cf. proxy.ts).
//
// La famille Prisma (`un_a_un`) diffère du BookingCategoryId (`un-a-un`) :
// cf. FAMILLE_TO_BOOKING / BOOKING_TO_FAMILLE.

import {
  BOOKING_CATALOG,
  FORMATION_DUREE_BY_SLUG,
  type BookingCategoryId,
  type FormationDuree,
} from "@/content/booking-catalog";

// ============================================================================
// Types
// ============================================================================

/** Famille telle que stockée en base (enum Prisma InterventionFamille). */
export type InterventionFamille = "formation" | "un_a_un" | "audit";

/** Catégorie de document (enum Prisma InterventionDocCategorie). */
export type DocCategorie = "stagiaires" | "formateur" | "cadre" | "evaluation";

/** Audience de diffusion (enum Prisma InterventionDocVisibilite). */
export type DocVisibilite = "stagiaire" | "formateur" | "commercial" | "interne";

/** Format de fichier source éditable attendu pour un slot. */
export type DocSourceFormat = "docx" | "pptx" | "xlsx" | "pdf" | "lien";

export interface DocSlot {
  /** Clé stable, persistée (InterventionDocument.slot). */
  key: string;
  /** Libellé affiché (FR). */
  titre: string;
  categorie: DocCategorie;
  visibilite: DocVisibilite;
  /** Formats source éditables attendus (le 1er est le format par défaut). */
  formats: ReadonlyArray<DocSourceFormat>;
  /** Numéro d'ordre canonique dans le kit (01..10). */
  ordre: number;
  /** Slot facultatif (n'est pas attendu pour toutes les prestations). */
  optionnel?: boolean;
  /**
   * Valeur de l'enum Prisma `DocumentType` (Formation Engine) que ce slot
   * recoupe. Si défini, l'UI agrège les documents GÉNÉRÉS (lecture seule).
   */
  qualiopiDocType?: string;
  /**
   * `true` = ce document vient UNIQUEMENT du Formation Engine (vraies données,
   * QR, rétention). Pas d'upload manuel : la bibliothèque n'affiche qu'un lien.
   */
  generatedOnly?: boolean;
  /** Aide affichée sous le slot. */
  note?: string;
}

export interface DocCategorieMeta {
  key: DocCategorie;
  titre: string;
  /** Pictogramme lucide (clé) — mappé dans l'UI admin. */
  icon: string;
  ordre: number;
}

// ============================================================================
// Catégories (= 4 sections du dossier de formation)
// ============================================================================

export const DOC_CATEGORIES: ReadonlyArray<DocCategorieMeta> = [
  { key: "stagiaires", titre: "Documents stagiaires", icon: "users", ordre: 1 },
  { key: "formateur", titre: "Documents formateur", icon: "graduation", ordre: 2 },
  { key: "cadre", titre: "Cadre pédagogique", icon: "clipboard", ordre: 3 },
  { key: "evaluation", titre: "Évaluation & qualité", icon: "star", ordre: 4 },
] as const;

/**
 * Libellé + ordre des 4 rayons, ADAPTÉS par famille (mêmes clés en base :
 * une formation, un audit et un 1-to-1 réutilisent les 4 mêmes catégories,
 * mais affichées avec un vocabulaire propre à chaque métier).
 */
const CATEGORIE_BY_FAMILLE: Record<
  InterventionFamille,
  Record<DocCategorie, { titre: string; ordre: number }>
> = {
  formation: {
    stagiaires: { titre: "Documents stagiaires", ordre: 1 },
    formateur: { titre: "Documents formateur", ordre: 2 },
    cadre: { titre: "Cadre pédagogique", ordre: 3 },
    evaluation: { titre: "Évaluation & qualité", ordre: 4 },
  },
  audit: {
    cadre: { titre: "Cadrage & méthode", ordre: 1 },
    formateur: { titre: "Outils consultant", ordre: 2 },
    stagiaires: { titre: "Livrables client", ordre: 3 },
    evaluation: { titre: "Suivi & qualité", ordre: 4 },
  },
  un_a_un: {
    cadre: { titre: "Cadre & objectifs", ordre: 1 },
    stagiaires: { titre: "Documents bénéficiaire", ordre: 2 },
    formateur: { titre: "Documents coach", ordre: 3 },
    evaluation: { titre: "Suivi & évaluation", ordre: 4 },
  },
};

// ============================================================================
// Slots par famille
// ============================================================================

/**
 * FORMATION — taxonomie complète, calée sur le kit gold-standard IA Express.
 * S'applique aux 17 formations du catalogue (mêmes types de documents).
 */
const FORMATION_SLOTS: ReadonlyArray<DocSlot> = [
  // 01 — Stagiaires
  {
    key: "livret_apprenant",
    titre: "Livret apprenant",
    categorie: "stagiaires",
    // Accessible aux formateurs dans l'espace ressources (choix Will 2026-06-13).
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 1,
  },
  {
    key: "cahier_exercices",
    titre: "Cahier d'exercices / TP",
    categorie: "stagiaires",
    // Accessible aux formateurs dans l'espace ressources (choix Will 2026-06-13).
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 3,
  },
  {
    key: "ressources",
    titre: "Ressources & aller plus loin",
    categorie: "stagiaires",
    // Accessible aux formateurs dans l'espace ressources (choix Will 2026-06-13).
    visibilite: "formateur",
    formats: ["docx", "lien"],
    ordre: 5,
  },
  // 02 — Formateur (confidentiel)
  {
    key: "diaporama",
    titre: "Diaporama formateur",
    categorie: "formateur",
    visibilite: "formateur",
    formats: ["pptx"],
    ordre: 0,
    note: "Support projeté — fil conducteur de la séance.",
  },
  {
    key: "guide_animation",
    titre: "Guide d'animation formateur",
    categorie: "formateur",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 2,
  },
  {
    key: "corriges",
    titre: "Corrigés (formateur uniquement)",
    categorie: "formateur",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 4,
  },
  {
    key: "scenario_pedagogique",
    titre: "Scénario pédagogique / déroulé minuté",
    categorie: "formateur",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 7,
  },
  // 03 — Cadre pédagogique
  {
    key: "programme",
    titre: "Programme de formation détaillé",
    categorie: "cadre",
    visibilite: "commercial",
    formats: ["docx"],
    ordre: 6,
    note: "Partagé au client/prospect. Indicateurs Qualiopi 1-2-3.",
  },
  {
    key: "test_positionnement",
    titre: "Test de positionnement (amont)",
    categorie: "cadre",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 8,
    qualiopiDocType: "positionnement",
    note: "Modèle. Les instances par session sont générées par le Formation Engine.",
  },
  // 04 — Évaluation & qualité
  {
    key: "evaluation_acquis",
    titre: "Évaluation des acquis (quiz / QCM)",
    categorie: "evaluation",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 9,
    qualiopiDocType: "grille_evaluation",
  },
  {
    key: "satisfaction_chaud",
    titre: "Questionnaire de satisfaction à chaud",
    categorie: "evaluation",
    visibilite: "interne",
    formats: ["docx"],
    ordre: 9,
    qualiopiDocType: "satisfaction",
  },
  {
    key: "satisfaction_froid",
    titre: "Questionnaire de satisfaction à froid (J+30)",
    categorie: "evaluation",
    visibilite: "interne",
    formats: ["docx"],
    ordre: 9,
    qualiopiDocType: "satisfaction",
  },
  {
    key: "attestation_emargement",
    titre: "Attestation de fin de formation + émargement",
    categorie: "evaluation",
    visibilite: "interne",
    formats: ["pdf"],
    ordre: 10,
    qualiopiDocType: "attestation",
    generatedOnly: true,
    note: "Généré par le Formation Engine (vraies données, QR, rétention 5 ans). Lien seul, pas d'upload.",
  },
] as const;

/**
 * 1-TO-1 (coaching individuel) — cadré en AFEST (Action de Formation En Situation
 * de Travail), Qualiopi/OPCO-finançable (décision Will 2026-06-13). La méthode :
 * cartographier le fonctionnement actuel (= analyse de l'activité AFEST), mises en
 * situation, phases réflexives, plan d'optimisation. Documents Qualiopi générés par
 * le Formation Engine (positionnement, émargement, attestation) comme les formations.
 * ⚠️ Financement effectif conditionné au périmètre de l'agrément (à confirmer au
 * certificateur).
 */
const UN_A_UN_SLOTS: ReadonlyArray<DocSlot> = [
  // Cadre & objectifs
  {
    key: "cadrage_objectifs",
    titre: "Cadrage / convention AFEST & contrat d'objectifs",
    categorie: "cadre",
    visibilite: "stagiaire",
    formats: ["docx"],
    ordre: 1,
  },
  {
    key: "analyse_activite",
    titre: "Grille de cartographie / analyse de l'activité (AFEST)",
    categorie: "cadre",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 2,
    note: "Cœur AFEST : cartographie du fonctionnement actuel (tâches, temps, irritants) en ouverture de journée.",
  },
  {
    key: "positionnement_individuel",
    titre: "Test de positionnement individuel",
    categorie: "cadre",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 3,
    qualiopiDocType: "positionnement",
    note: "Modèle. Les instances par bénéficiaire sont générées par le Formation Engine.",
  },
  {
    key: "guide_coach",
    titre: "Trame de journée & guide du coach (déroulé AFEST, posture)",
    categorie: "cadre",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 4,
  },
  // Documents bénéficiaire
  {
    key: "parcours_seances",
    titre: "Parcours / plan de séances",
    categorie: "stagiaires",
    visibilite: "stagiaire",
    formats: ["docx"],
    ordre: 5,
  },
  {
    key: "fiches_exercices",
    titre: "Fiches & exercices individualisés",
    categorie: "stagiaires",
    visibilite: "stagiaire",
    formats: ["docx"],
    ordre: 6,
  },
  {
    key: "ressources_perso",
    titre: "Ressources & prompts personnalisés",
    categorie: "stagiaires",
    visibilite: "stagiaire",
    formats: ["docx", "lien"],
    ordre: 7,
  },
  {
    key: "plan_optimisation",
    titre: "Plan d'optimisation personnalisé (livrable)",
    categorie: "stagiaires",
    visibilite: "stagiaire",
    formats: ["docx"],
    ordre: 8,
    note: "Livrable de fin : ce qu'on peut automatiser/optimiser + gains de temps et d'argent estimés.",
  },
  // Documents coach (confidentiel)
  {
    key: "cr_seance",
    titre: "Trame de compte-rendu de séance",
    categorie: "formateur",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 9,
  },
  {
    key: "phase_reflexive",
    titre: "Trame de phase réflexive (AFEST)",
    categorie: "formateur",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 10,
    note: "Obligatoire AFEST : alterner mise en situation de travail et débrief réflexif.",
  },
  {
    key: "corriges_1to1",
    titre: "Corrigés / réponses types",
    categorie: "formateur",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 11,
  },
  // Suivi & évaluation
  {
    key: "journal_progression",
    titre: "Journal de progression / plan inter-séances",
    categorie: "evaluation",
    visibilite: "stagiaire",
    formats: ["docx"],
    ordre: 12,
  },
  {
    key: "evaluation_progression",
    titre: "Évaluation des acquis / progression",
    categorie: "evaluation",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 13,
    qualiopiDocType: "grille_evaluation",
  },
  {
    key: "satisfaction_1to1",
    titre: "Questionnaire de satisfaction (chaud + froid)",
    categorie: "evaluation",
    visibilite: "interne",
    formats: ["docx"],
    ordre: 14,
    qualiopiDocType: "satisfaction",
  },
  {
    key: "attestation_emargement",
    titre: "Attestation de réalisation + émargement",
    categorie: "evaluation",
    visibilite: "interne",
    formats: ["pdf"],
    ordre: 15,
    qualiopiDocType: "attestation",
    generatedOnly: true,
    note: "Généré par le Formation Engine (vraies données, QR, rétention 5 ans). Lien seul, pas d'upload.",
  },
];

/**
 * AUDIT (mission de conseil / diagnostic — PAS une formation Qualiopi).
 * Structure cadrée 2026-06-13 : le rapport de restitution fait office de livrable
 * de clôture (pas d'attestation, pas d'émargement). S'applique aux 4 niveaux d'audit.
 */
const AUDIT_SLOTS: ReadonlyArray<DocSlot> = [
  // Cadrage & méthode
  {
    key: "audit_cadrage_mission",
    titre: "Proposition / cadrage de mission",
    categorie: "cadre",
    visibilite: "commercial",
    formats: ["docx"],
    ordre: 1,
    note: "Périmètre, objectifs, planning. Partagé au client/prospect.",
  },
  {
    key: "audit_collecte_amont",
    titre: "Questionnaire de collecte amont",
    categorie: "cadre",
    visibilite: "stagiaire",
    formats: ["docx"],
    ordre: 2,
  },
  {
    key: "audit_guide_conduite",
    titre: "Guide de conduite d'audit (méthode)",
    categorie: "cadre",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 3,
  },
  // Outils consultant (confidentiel)
  {
    key: "audit_grille_diagnostic",
    titre: "Grille de diagnostic / matrice d'évaluation",
    categorie: "formateur",
    visibilite: "formateur",
    formats: ["xlsx", "docx"],
    ordre: 4,
  },
  {
    key: "audit_trame_entretien",
    titre: "Trame d'entretien",
    categorie: "formateur",
    visibilite: "formateur",
    formats: ["docx"],
    ordre: 5,
  },
  // Livrables client
  {
    key: "audit_rapport",
    titre: "Rapport d'audit / restitution",
    categorie: "stagiaires",
    visibilite: "stagiaire",
    formats: ["docx"],
    ordre: 6,
    note: "Livrable principal de la mission.",
  },
  {
    key: "audit_slides_restitution",
    titre: "Slides de restitution",
    categorie: "stagiaires",
    visibilite: "stagiaire",
    formats: ["pptx"],
    ordre: 7,
  },
  {
    key: "audit_plan_action",
    titre: "Plan d'action / feuille de route priorisée",
    categorie: "stagiaires",
    visibilite: "stagiaire",
    formats: ["xlsx", "docx"],
    ordre: 8,
  },
  // Suivi & qualité
  {
    key: "audit_satisfaction",
    titre: "Questionnaire de satisfaction client",
    categorie: "evaluation",
    visibilite: "interne",
    formats: ["docx"],
    ordre: 9,
  },
];

const SLOTS_BY_FAMILLE: Record<InterventionFamille, ReadonlyArray<DocSlot>> = {
  formation: FORMATION_SLOTS,
  un_a_un: UN_A_UN_SLOTS,
  audit: AUDIT_SLOTS,
};

// ============================================================================
// Pont famille (Prisma) ↔ BookingCategoryId (booking-catalog)
// ============================================================================

export const FAMILLE_TO_BOOKING: Record<InterventionFamille, BookingCategoryId> = {
  formation: "formation",
  un_a_un: "un-a-un",
  audit: "audit",
};

export const BOOKING_TO_FAMILLE: Record<BookingCategoryId, InterventionFamille> = {
  formation: "formation",
  "un-a-un": "un_a_un",
  audit: "audit",
};

export const FAMILLES: ReadonlyArray<{ key: InterventionFamille; titre: string }> = [
  { key: "formation", titre: "Formations" },
  { key: "un_a_un", titre: "1-to-1" },
  { key: "audit", titre: "Audits" },
];

/** Segment d'URL admin pour une famille (route `documents-interventions/<seg>`). */
export const FAMILLE_ROUTE_SEGMENT: Record<InterventionFamille, string> = {
  formation: "formations",
  un_a_un: "un-a-un",
  audit: "audit",
};

/** Segment d'URL → famille (résolution des routes admin). */
export const ROUTE_SEGMENT_TO_FAMILLE: Record<string, InterventionFamille> = {
  formations: "formation",
  "un-a-un": "un_a_un",
  audit: "audit",
};

// ============================================================================
// Helpers
// ============================================================================

export interface InterventionRef {
  slug: string;
  labelFr: string;
  labelEn: string;
  famille: InterventionFamille;
  /** Durée (`4h`/`1j`/`2j`/`3j`) — uniquement pour la famille formation. */
  duree?: FormationDuree;
}

/** Liste des prestations d'une famille, dérivée du booking-catalog (SSOT). */
export function getInterventionsByFamille(
  famille: InterventionFamille,
): ReadonlyArray<InterventionRef> {
  const bookingId = FAMILLE_TO_BOOKING[famille];
  const cat = BOOKING_CATALOG.find((c) => c.id === bookingId);
  if (!cat) return [];
  return cat.formats.map((f) => {
    // La durée n'existe que pour les formations ; on n'ajoute la clé que si elle
    // est résolue (exactOptionalPropertyTypes : pas de clé à `undefined`).
    const duree = famille === "formation" ? FORMATION_DUREE_BY_SLUG[f.slug] : undefined;
    return {
      slug: f.slug,
      labelFr: f.labelFr,
      labelEn: f.labelEn,
      famille,
      ...(duree ? { duree } : {}),
    };
  });
}

// ============================================================================
// Sous-groupes d'affichage (console mieux organisée)
// ----------------------------------------------------------------------------
// Pour éviter des listes à plat trop longues, certaines familles s'affichent en
// sections : Formations → par durée (4 h / 1 j / 2 j / 3 j), 1-to-1 → par public
// (Dirigeant / Collaborateur / Suivi régulier). Audit reste en liste à plat
// (4 prestations, aucun axe propre → null). Tout élément non classé tombe dans
// un groupe « Autres » final ; les groupes vides sont omis.
// ============================================================================

export interface InterventionSousGroupe {
  /** Identifiant stable (durée, public, ou « autres ») — sert de clé React. */
  key: string;
  titre: string;
  interventions: ReadonlyArray<InterventionRef>;
}

const FORMATION_DUREE_ORDER: ReadonlyArray<FormationDuree> = ["4h", "1j", "2j", "3j"];
const FORMATION_DUREE_LABEL: Record<FormationDuree, string> = {
  "4h": "4 heures",
  "1j": "1 jour",
  "2j": "2 jours",
  "3j": "3 jours",
};

export type UnAUnPublic = "dirigeant" | "collaborateur" | "recurrent";
/** Public d'une prestation 1-to-1, par slug (axe d'organisation de la console). */
const UN_A_UN_PUBLIC_BY_SLUG: Readonly<Record<string, UnAUnPublic | undefined>> = {
  "dirigeant-vision-strategique": "dirigeant",
  "dirigeant-vision-strategique-2j": "dirigeant",
  "coaching-decouverte": "collaborateur",
  "coaching-optimisation-2j": "collaborateur",
  "un-a-un-recurrent": "recurrent",
};
const UN_A_UN_PUBLIC_ORDER: ReadonlyArray<UnAUnPublic> = [
  "dirigeant",
  "collaborateur",
  "recurrent",
];
const UN_A_UN_PUBLIC_LABEL: Record<UnAUnPublic, string> = {
  dirigeant: "Dirigeant",
  collaborateur: "Collaborateur",
  recurrent: "Suivi régulier",
};

/** Regroupe selon un ordre de clés + libellés ; non-classés → groupe « Autres » final. */
function buildSousGroupes<K extends string>(
  items: ReadonlyArray<InterventionRef>,
  keyOf: (i: InterventionRef) => K | undefined,
  order: ReadonlyArray<K>,
  label: Record<K, string>,
  autresTitre: string,
): ReadonlyArray<InterventionSousGroupe> {
  const groups: InterventionSousGroupe[] = order.map((k) => ({
    key: k,
    titre: label[k],
    interventions: items.filter((i) => keyOf(i) === k),
  }));
  const autres = items.filter((i) => keyOf(i) === undefined);
  if (autres.length > 0) {
    groups.push({ key: "autres", titre: autresTitre, interventions: autres });
  }
  return groups.filter((g) => g.interventions.length > 0);
}

/**
 * Sous-groupes d'affichage d'une famille. `null` = pas de sous-groupe → la
 * famille s'affiche en liste à plat (cas Audit : trop peu de prestations).
 */
export function getInterventionsSousGroupes(
  famille: InterventionFamille,
): ReadonlyArray<InterventionSousGroupe> | null {
  if (famille === "formation") {
    return buildSousGroupes(
      getInterventionsByFamille("formation"),
      (i) => i.duree,
      FORMATION_DUREE_ORDER,
      FORMATION_DUREE_LABEL,
      "Personnalisées",
    );
  }
  if (famille === "un_a_un") {
    return buildSousGroupes(
      getInterventionsByFamille("un_a_un"),
      (i) => UN_A_UN_PUBLIC_BY_SLUG[i.slug],
      UN_A_UN_PUBLIC_ORDER,
      UN_A_UN_PUBLIC_LABEL,
      "Autres",
    );
  }
  return null;
}

/** Toutes les prestations, toutes familles confondues. */
export function getAllInterventions(): ReadonlyArray<InterventionRef> {
  return FAMILLES.flatMap((f) => getInterventionsByFamille(f.key));
}

/** Résout une prestation par son slug (toutes familles). */
export function getInterventionBySlug(slug: string): InterventionRef | undefined {
  return getAllInterventions().find((i) => i.slug === slug);
}

/** Slots de documents définis pour une famille. */
export function getSlotsByFamille(famille: InterventionFamille): ReadonlyArray<DocSlot> {
  return SLOTS_BY_FAMILLE[famille] ?? [];
}

/** Slots d'une famille regroupés par catégorie (libellés/ordre propres à la famille). */
export function getSlotsByCategorie(
  famille: InterventionFamille,
): ReadonlyArray<{ categorie: DocCategorieMeta; slots: ReadonlyArray<DocSlot> }> {
  const slots = getSlotsByFamille(famille);
  const cfg = CATEGORIE_BY_FAMILLE[famille];
  const iconOf = (key: DocCategorie): string =>
    DOC_CATEGORIES.find((c) => c.key === key)?.icon ?? "clipboard";
  return (Object.keys(cfg) as DocCategorie[])
    .map((key) => ({
      categorie: { key, titre: cfg[key].titre, icon: iconOf(key), ordre: cfg[key].ordre },
      slots: slots.filter((s) => s.categorie === key).sort((a, b) => a.ordre - b.ordre),
    }))
    .sort((a, b) => a.categorie.ordre - b.categorie.ordre)
    .filter((g) => g.slots.length > 0);
}

/** Résout un slot précis pour une famille. */
export function getSlot(famille: InterventionFamille, slotKey: string): DocSlot | undefined {
  return getSlotsByFamille(famille).find((s) => s.key === slotKey);
}
