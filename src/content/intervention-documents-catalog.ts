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

import { BOOKING_CATALOG, type BookingCategoryId } from "@/content/booking-catalog";

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
    visibilite: "stagiaire",
    formats: ["docx"],
    ordre: 1,
  },
  {
    key: "cahier_exercices",
    titre: "Cahier d'exercices / TP",
    categorie: "stagiaires",
    visibilite: "stagiaire",
    formats: ["docx"],
    ordre: 3,
  },
  {
    key: "ressources",
    titre: "Ressources & aller plus loin",
    categorie: "stagiaires",
    visibilite: "stagiaire",
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

// 1-to-1 et audit : kits non encore fournis par Will. Scaffold vide
// (les familles/onglets s'affichent, sections « à configurer ») — à peupler
// quand les kits 1-to-1 / audit seront cadrés (même méthode qu'IA Express).
const UN_A_UN_SLOTS: ReadonlyArray<DocSlot> = [];
const AUDIT_SLOTS: ReadonlyArray<DocSlot> = [];

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
}

/** Liste des prestations d'une famille, dérivée du booking-catalog (SSOT). */
export function getInterventionsByFamille(
  famille: InterventionFamille,
): ReadonlyArray<InterventionRef> {
  const bookingId = FAMILLE_TO_BOOKING[famille];
  const cat = BOOKING_CATALOG.find((c) => c.id === bookingId);
  if (!cat) return [];
  return cat.formats.map((f) => ({
    slug: f.slug,
    labelFr: f.labelFr,
    labelEn: f.labelEn,
    famille,
  }));
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

/** Slots d'une famille regroupés par catégorie, dans l'ordre canonique. */
export function getSlotsByCategorie(
  famille: InterventionFamille,
): ReadonlyArray<{ categorie: DocCategorieMeta; slots: ReadonlyArray<DocSlot> }> {
  const slots = getSlotsByFamille(famille);
  return [...DOC_CATEGORIES]
    .sort((a, b) => a.ordre - b.ordre)
    .map((categorie) => ({
      categorie,
      slots: slots.filter((s) => s.categorie === categorie.key).sort((a, b) => a.ordre - b.ordre),
    }))
    .filter((g) => g.slots.length > 0);
}

/** Résout un slot précis pour une famille. */
export function getSlot(famille: InterventionFamille, slotKey: string): DocSlot | undefined {
  return getSlotsByFamille(famille).find((s) => s.key === slotKey);
}
