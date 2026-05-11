// SSOT taxonomie /interventions — Sprint 14.10.7 (2026-05-11).
//
// Refonte structurelle de la page /interventions (Will 2026-05-11) :
//   /interventions          → hub 3 BLOCS FAMILLE (équipe / 1-to-1 / dirigeants)
//   /interventions/collectives          → hub 4 PALIERS DURÉE (4h / 1j / 2j / 3j+)
//   /interventions/collectives/<duree>  → liste des FORMATS qui matchent (family, duration)
//   /interventions/individuel           → page famille liste plate
//   /interventions/dirigeants           → page format existante (V1 = pas de hub famille)
//
// V1 = catalogue codé en TS. V2 (Sprint dédié, ADR-0011) = vue Prisma alimentée
// par `/admin/catalog` avec slug history + 301 auto. L'API publique de ce module
// (types + helpers) restera stable → migration sans casse.
//
// Comment ajouter une nouvelle formation :
//   1. Ajouter 1 entrée à `INTERVENTION_FORMATS` ci-dessous, avec `family` et
//      `duration` (si family === "collectives").
//   2. Si la formation a une page détail dédiée (programme, FAQ…), créer
//      le fichier `src/app/[locale]/interventions/<slug>/page.tsx`. Sinon,
//      `pathFr` peut pointer vers `/contact?objet=<slug>` pour démarrer la
//      conversation commerciale.
//   3. C'est tout : la page palier durée (ou la page famille pour Individuel /
//      Dirigeants) liste automatiquement la nouvelle entrée.

import type { Locale } from "@/i18n/routing";
import { INTERVENTION_TIERS, formatAmount, formatPrice, getTierById } from "./pricing";

// ============================================================================
// Types
// ============================================================================

export type Family = "collectives" | "individuel" | "dirigeants" | "conference";

/** Paliers durée — UNIQUEMENT pour la famille `collectives`. */
export type CollectiveDuration = "4h" | "1-jour" | "2-jours" | "3-jours-plus";

export type FormatAccent = "terracotta" | "primary" | "sage" | "mocha" | "claude";

export interface FamilyDef {
  id: Family;
  /** Segment URL canonique FR (« collectives », « individuel », « dirigeants »). */
  slug: string;
  /** Labels affichables. */
  labelFr: string;
  labelEn: string;
  /** Tagline 1 phrase exposée sur le hub /interventions. */
  taglineFr: string;
  taglineEn: string;
  /** URL d'atterrissage du bloc famille. */
  pathFr: string;
  pathEn: string;
  /**
   * `true` = la famille a une matrice de paliers durée (Collectives en V1).
   * `false` = liste plate de formats, sans sous-niveau durée.
   */
  hasDurations: boolean;
  /** Accent visuel pour la card hub. */
  accent: FormatAccent;
}

export interface DurationDef {
  id: CollectiveDuration;
  slug: string;
  labelFr: string;
  labelEn: string;
  /** Forme courte (badges, breadcrumbs). */
  shortFr: string;
  shortEn: string;
  /** Précisions horaires affichées en tête de page durée. */
  durationDetailFr: string;
  durationDetailEn: string;
  pathFr: string;
  pathEn: string;
  /**
   * `true` = la page n'affiche PAS de liste de formats mais redirige vers
   * `/contact?objet=...`. Cas du palier « 3 jours et + » sur devis.
   */
  isQuoteOnly?: boolean;
  /** Contact `objet` pré-rempli pour les paliers sur devis. */
  contactObject?: string;
}

export interface InterventionFormatEntry {
  /** Slug stable — sert d'identifiant unique + clé URL si page détail dédiée. */
  slug: string;
  family: Family;
  /** Obligatoire si family === "collectives" (cf. invariants au build). */
  duration?: CollectiveDuration;
  /** Lien vers la page détail (ou /contact si pas encore de page). */
  pathFr: string;
  pathEn: string;
  labelFr: string;
  labelEn: string;
  /** Tagline 1-2 phrases — affiché dans la card listing. */
  taglineFr: string;
  taglineEn: string;
  /** Prix formatté (déjà passé par formatPrice/formatAmount). */
  priceFr: string;
  priceEn: string;
  groupSizeFr: string;
  groupSizeEn: string;
  audienceFr: string;
  audienceEn: string;
  accent: FormatAccent;
  badgeFr?: string;
  badgeEn?: string;
}

// ============================================================================
// Familles — 3 blocs sur /interventions
// ============================================================================

export const FAMILIES: ReadonlyArray<FamilyDef> = [
  {
    id: "collectives",
    slug: "collectives",
    labelFr: "Formations équipe",
    labelEn: "Team trainings",
    taglineFr:
      "Formations IA opérationnelles pour vos équipes sur site — durée modulable de 4 heures à plusieurs jours, de 2 à 30+ personnes.",
    taglineEn:
      "Operational AI trainings for your teams on site — flexible duration from 4 hours to several days, 2 to 30+ people.",
    pathFr: "/interventions/collectives",
    pathEn: "/interventions/team-trainings",
    hasDurations: true,
    accent: "terracotta",
  },
  {
    id: "individuel",
    slug: "individuel",
    labelFr: "Coaching individuel",
    labelEn: "Individual coaching",
    taglineFr:
      "Coaching IA 1-to-1 sur mesure — managers, indépendants, freelances, dirigeants solo.",
    taglineEn: "Bespoke 1-on-1 AI coaching — managers, independents, freelancers, solo executives.",
    pathFr: "/interventions/individuel",
    pathEn: "/interventions/individual",
    hasDurations: false,
    accent: "primary",
  },
  {
    id: "dirigeants",
    slug: "dirigeants",
    labelFr: "Dirigeants",
    labelEn: "Executives",
    taglineFr:
      "Journée stratégique en huis clos pour comités de direction — vision IA 12-24 mois + quick-wins activables.",
    taglineEn:
      "In-camera strategic day for executive committees — 12-24 month AI vision + actionable quick-wins.",
    // V1 : pointe directement vers la page format existante (riche, Sprint 14.10).
    // V2 quand Will ajoutera d'autres formats Dirigeants : hub famille dédié.
    pathFr: "/interventions/dirigeants",
    pathEn: "/interventions/executives",
    hasDurations: false,
    accent: "mocha",
  },
  {
    // 4ème famille ajoutée Sprint 14.10.7 (Will, 2026-05-11) — la Conférence
    // mérite son propre bloc famille au même niveau que les autres. Elle était
    // précédemment classée dans Collectives/1-jour mais ne colle pas vraiment
    // à la grammaire « formations équipe » : c'est une plénière grands effectifs
    // qui s'adresse à toute l'entreprise.
    id: "conference",
    slug: "conference",
    labelFr: "Conférence",
    labelEn: "Talk",
    taglineFr:
      "Plénière 1 journée pour mettre toute l'entreprise au même niveau IA — séminaires, kick-off annuels, grands effectifs.",
    taglineEn:
      "1-day plenary to bring your whole company to the same AI level — seminars, annual kick-offs, large audiences.",
    // V1 : pointe directement vers la page format existante (riche).
    pathFr: "/interventions/conference",
    pathEn: "/interventions/conference",
    hasDurations: false,
    accent: "sage",
  },
] as const;

// ============================================================================
// Paliers durée — uniquement Collectives en V1
// ============================================================================

export const COLLECTIVE_DURATIONS: ReadonlyArray<DurationDef> = [
  {
    id: "4h",
    slug: "4h",
    labelFr: "Formation 4 heures",
    labelEn: "4-hour training",
    shortFr: "4 h",
    shortEn: "4 h",
    durationDetailFr: "Demi-journée (≈ 4 h)",
    durationDetailEn: "Half-day (≈ 4 h)",
    pathFr: "/interventions/collectives/4h",
    pathEn: "/interventions/team-trainings/4h",
  },
  {
    id: "1-jour",
    slug: "1-jour",
    labelFr: "Formation 1 jour",
    labelEn: "1-day training",
    shortFr: "1 j",
    shortEn: "1 d",
    durationDetailFr: "1 journée (≈ 7 h sur site)",
    durationDetailEn: "1 day (≈ 7 h on site)",
    pathFr: "/interventions/collectives/1-jour",
    pathEn: "/interventions/team-trainings/1-day",
  },
  {
    id: "2-jours",
    slug: "2-jours",
    labelFr: "Formation 2 jours",
    labelEn: "2-day training",
    shortFr: "2 j",
    shortEn: "2 d",
    durationDetailFr: "2 jours consécutifs",
    durationDetailEn: "2 consecutive days",
    pathFr: "/interventions/collectives/2-jours",
    pathEn: "/interventions/team-trainings/2-days",
  },
  {
    id: "3-jours-plus",
    slug: "3-jours-plus",
    labelFr: "Formation 3 jours et plus",
    labelEn: "3-day+ training",
    shortFr: "3 j+",
    shortEn: "3 d+",
    durationDetailFr: "3 jours ou plus — sur devis",
    durationDetailEn: "3 days or more — on request",
    pathFr: "/interventions/collectives/3-jours-plus",
    pathEn: "/interventions/team-trainings/3-days-plus",
    isQuoteOnly: true,
    contactObject: "formation-collective-sur-mesure",
  },
] as const;

// ============================================================================
// Catalogue extensible — c'est ICI que Will / Claude ajoutent une formation.
// Une nouvelle entrée = 1 objet inline. Aucune autre modification requise pour
// qu'elle apparaisse automatiquement sur sa page famille / palier durée.
// ============================================================================

const ESSENTIELLE_PRICE = getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!;
const APPROFONDIE_PRICE = getTierById(INTERVENTION_TIERS, "intervention-approfondie").priceFlat!;
const TEMPS_TIER = getTierById(INTERVENTION_TIERS, "intervention-temps");
const DIRIGEANTS_TIER = getTierById(INTERVENTION_TIERS, "intervention-dirigeants");

export const INTERVENTION_FORMATS: ReadonlyArray<InterventionFormatEntry> = [
  // -------------------------------------------------------------------------
  // FAMILLE : Collectives / Palier 1 jour
  // -------------------------------------------------------------------------
  {
    slug: "essentielle",
    family: "collectives",
    duration: "1-jour",
    pathFr: "/interventions/essentielle",
    pathEn: "/interventions/essential",
    labelFr: "Essentielle",
    labelEn: "Essential",
    taglineFr:
      "Découverte IA en 1 journée — vos équipes repartent avec des automatisations testées sur leurs propres outils.",
    taglineEn: "1-day AI discovery — your teams leave with automations tested on their own tools.",
    priceFr: `dès ${formatAmount(ESSENTIELLE_PRICE, "fr")}`,
    priceEn: `from ${formatAmount(ESSENTIELLE_PRICE, "en")}`,
    groupSizeFr: "2 à 30 personnes",
    groupSizeEn: "2 to 30 people",
    audienceFr: "TPE · PME · ETI · grandes entreprises",
    audienceEn: "Small · mid-market · enterprise",
    accent: "terracotta",
    badgeFr: "Offre phare",
    badgeEn: "Flagship",
  },
  {
    slug: "gagner-du-temps",
    family: "collectives",
    duration: "1-jour",
    pathFr: "/interventions/gagner-du-temps",
    pathEn: "/interventions/save-time",
    labelFr: "Gagner du temps",
    labelEn: "Save time",
    taglineFr:
      "Automatiser vos tâches répétitives à l'IA — gain mesurable dès le retour au bureau, plusieurs heures par personne et par semaine.",
    taglineEn:
      "Automate your recurring tasks with AI — measurable gain from day one back, hours per person every week.",
    priceFr: formatPrice(TEMPS_TIER, "fr"),
    priceEn: formatPrice(TEMPS_TIER, "en"),
    groupSizeFr: "2 à 20 personnes",
    groupSizeEn: "2 to 20 people",
    audienceFr: "Équipes opérationnelles · TPE, PME, ETI",
    audienceEn: "Operational teams · small to mid-market",
    accent: "primary",
    badgeFr: "Productivité",
    badgeEn: "Productivity",
  },
  {
    slug: "intervention-claude",
    family: "collectives",
    duration: "1-jour",
    pathFr: "/interventions/intervention-claude",
    pathEn: "/interventions/intervention-claude",
    labelFr: "Intervention Claude",
    labelEn: "Claude intervention",
    taglineFr:
      "1 journée 100 % dédiée à Claude (Anthropic) — Chat · Cowork · Code. Vos équipes ressortent autonomes sur l'outil de pointe IA.",
    taglineEn:
      "Full day 100 % focused on Claude (Anthropic) — Chat · Cowork · Code. Your teams leave autonomous on the cutting-edge AI tool.",
    priceFr: "Sur devis",
    priceEn: "On request",
    groupSizeFr: "Selon besoin",
    groupSizeEn: "As needed",
    audienceFr: "Équipes qui veulent maîtriser Claude en profondeur",
    audienceEn: "Teams that want to master Claude in depth",
    accent: "claude",
    badgeFr: "Outil · Claude",
    badgeEn: "Tool · Claude",
  },
  // Note : la Conférence a sa propre famille « conference » depuis Sprint 14.10.7 —
  // déplacée plus bas dans la section dédiée.

  // -------------------------------------------------------------------------
  // FAMILLE : Collectives / Palier 2 jours
  // -------------------------------------------------------------------------
  {
    slug: "approfondie",
    family: "collectives",
    duration: "2-jours",
    pathFr: "/interventions/approfondie",
    pathEn: "/interventions/deep-dive",
    labelFr: "Approfondie",
    labelEn: "Deep dive",
    taglineFr:
      "Approfondissement IA sur 2 journées consécutives — équipes IA-fluentes à la sortie, même grille d'effectif qu'Essentielle.",
    taglineEn: "2-day AI deep dive — your teams leave AI-fluent, same headcount grid as Essential.",
    priceFr: `dès ${formatAmount(APPROFONDIE_PRICE, "fr")}`,
    priceEn: `from ${formatAmount(APPROFONDIE_PRICE, "en")}`,
    groupSizeFr: "2 à 30 personnes",
    groupSizeEn: "2 to 30 people",
    audienceFr: "Équipes opérationnelles · TPE, PME, ETI",
    audienceEn: "Operational teams · small to mid-market",
    accent: "primary",
    badgeFr: "Équipes · 2 jours",
    badgeEn: "Teams · 2 days",
  },

  // -------------------------------------------------------------------------
  // FAMILLE : Dirigeants (liste plate, pas de paliers durée)
  // -------------------------------------------------------------------------
  {
    slug: "dirigeants",
    family: "dirigeants",
    pathFr: "/interventions/dirigeants",
    pathEn: "/interventions/executives",
    labelFr: "Journée stratégique CODIR",
    labelEn: "Strategic CODIR day",
    taglineFr:
      "1 journée stratégique en huis clos — quick-wins activables semaine suivante + vision IA 12-24 mois pour vos décisions.",
    taglineEn:
      "1 strategic day in camera — actionable quick-wins for next week + 12-24 month AI vision for your decisions.",
    priceFr: formatPrice(DIRIGEANTS_TIER, "fr"),
    priceEn: formatPrice(DIRIGEANTS_TIER, "en"),
    groupSizeFr: "1 à 5 personnes (vous + équipe rapprochée)",
    groupSizeEn: "1 to 5 people (you + inner circle)",
    audienceFr: "CODIR, COMEX, direction générale",
    audienceEn: "Executive committees, top management",
    accent: "mocha",
    badgeFr: "Quick-wins · 1-to-1",
    badgeEn: "Quick-wins · 1-to-1",
  },

  // -------------------------------------------------------------------------
  // FAMILLE : Conférence (liste plate, pas de paliers durée)
  // Sprint 14.10.7 — extraite de Collectives/1-jour pour devenir une famille
  // à part entière. Décision Will (2026-05-11).
  // -------------------------------------------------------------------------
  {
    slug: "conference",
    family: "conference",
    pathFr: "/interventions/conference",
    pathEn: "/interventions/conference",
    labelFr: "Conférence 1 journée",
    labelEn: "1-day talk",
    taglineFr:
      "Plénière 1 journée pour mettre toute l'entreprise au même niveau IA — séminaires, kick-off annuels, grands effectifs.",
    taglineEn:
      "1-day plenary to bring your whole company to the same AI level — seminars, annual kick-offs, large audiences.",
    priceFr: "Sur devis",
    priceEn: "On request",
    groupSizeFr: "Grands effectifs · 30+ personnes",
    groupSizeEn: "Large audiences · 30+ people",
    audienceFr: "Toute l'entreprise au même niveau",
    audienceEn: "Whole company aligned",
    accent: "sage",
    badgeFr: "Format collectif",
    badgeEn: "Collective format",
  },

  // -------------------------------------------------------------------------
  // FAMILLE : Individuel (liste plate, vide pour l'instant — à remplir).
  // Quand tu rajoutes un coaching 1-to-1, copier-coller le template ci-dessous.
  //
  //   {
  //     slug: "coaching-decouverte-1h",
  //     family: "individuel",
  //     pathFr: "/contact?objet=coaching-decouverte",
  //     pathEn: "/contact?objet=coaching-decouverte",
  //     labelFr: "Coaching IA · découverte",
  //     labelEn: "AI coaching · discovery",
  //     taglineFr: "...",
  //     taglineEn: "...",
  //     priceFr: "Sur devis",
  //     priceEn: "On request",
  //     groupSizeFr: "1 personne",
  //     groupSizeEn: "1 person",
  //     audienceFr: "Managers, indépendants, freelances",
  //     audienceEn: "Managers, independents, freelancers",
  //     accent: "sage",
  //   },
  // -------------------------------------------------------------------------
] as const;

// ============================================================================
// Helpers — utilisés par les pages listing
// ============================================================================

export function getFamily(id: Family): FamilyDef {
  const family = FAMILIES.find((f) => f.id === id);
  if (!family) throw new Error(`[interventions-taxonomy] Family introuvable : "${id}"`);
  return family;
}

export function getFamilyBySlug(slug: string): FamilyDef | undefined {
  return FAMILIES.find((f) => f.slug === slug);
}

export function getDuration(id: CollectiveDuration): DurationDef {
  const duration = COLLECTIVE_DURATIONS.find((d) => d.id === id);
  if (!duration) throw new Error(`[interventions-taxonomy] Duration introuvable : "${id}"`);
  return duration;
}

export function getDurationBySlug(slug: string): DurationDef | undefined {
  return COLLECTIVE_DURATIONS.find((d) => d.slug === slug);
}

/** Tous les formats d'une famille (toutes durées confondues). */
export function getFormatsByFamily(family: Family): ReadonlyArray<InterventionFormatEntry> {
  return INTERVENTION_FORMATS.filter((f) => f.family === family);
}

/** Formats d'une cellule (family, duration) — uniquement valide pour Collectives. */
export function getFormatsByCell(
  family: Family,
  duration: CollectiveDuration,
): ReadonlyArray<InterventionFormatEntry> {
  return INTERVENTION_FORMATS.filter((f) => f.family === family && f.duration === duration);
}

export function countFormatsByFamily(family: Family): number {
  return getFormatsByFamily(family).length;
}

export function countFormatsByCell(family: Family, duration: CollectiveDuration): number {
  return getFormatsByCell(family, duration).length;
}

/** Renvoie le chemin localisé d'une famille. */
export function familyPath(family: FamilyDef, locale: Locale): string {
  return locale === "fr" ? family.pathFr : family.pathEn;
}

/** Renvoie le chemin localisé d'un palier durée. */
export function durationPath(duration: DurationDef, locale: Locale): string {
  return locale === "fr" ? duration.pathFr : duration.pathEn;
}

/** Renvoie le chemin localisé d'un format. */
export function formatPath(entry: InterventionFormatEntry, locale: Locale): string {
  return locale === "fr" ? entry.pathFr : entry.pathEn;
}

/**
 * Pour les paliers `isQuoteOnly` (3 jours et +) : construit l'URL contact
 * avec l'objet pré-rempli. Localisé via le chemin contact.
 */
export function quoteContactPath(duration: DurationDef, locale: Locale): string {
  const base = locale === "fr" ? "/contact" : "/contact";
  const obj = duration.contactObject ?? "formation-sur-mesure";
  return `${base}?objet=${encodeURIComponent(obj)}`;
}
