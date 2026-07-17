// SSOT taxonomie /interventions — Refonte 2026-05-28.
//
// Structure post-refonte 1-to-1 (Will 2026-05-28) :
//   /un-a-un                            → hub canonique 1-to-1 (FR)
//                                         + 2 cards portes d'entrée vers
//                                         `individuel` et `dirigeants`
//   /interventions/collectives          → hub 4 PALIERS DURÉE (4h / 1j / 2j / 3j+)
//   /interventions/collectives/<duree>  → liste des FORMATS qui matchent
//   /interventions/individuel           → page famille liste plate (sous /un-a-un)
//   /interventions/dirigeants           → page famille 3 formats (sous /un-a-un)
//
// Supprimés :
//   - /interventions (hub des 4 familles) → 301 → /interventions/collectives
//   - Famille « conference » (hub + 2 formats détail) → 301 → /interventions/collectives
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
import { getDurationCanonical } from "./formations";
import { INTERVENTION_TIERS, formatAmount, formatPrice, getTierById } from "./pricing";

// ============================================================================
// Types
// ============================================================================

export type Family = "collectives" | "individuel" | "dirigeants";

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
  /**
   * City Domination 2026-05-18 P1-2 — Durée ISO 8601 pour `Course.hasCourseInstance.courseWorkload`.
   * Format Schema.org : `PT4H` (4 h), `PT7H` (1 jour ≈ 7 h sur site), `P2D` (2 jours).
   * Absent sur isQuoteOnly (durée variable sur devis).
   */
  iso8601Duration?: string;
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
    // Tagline inclusif — Will (2026-05-11) : n'importe quel poste (secrétaire,
    // comptable, manager, indépendant, designer…). On fait le point sur le
    // métier, on automatise les tâches répétitives, on installe les bons outils.
    taglineFr:
      "Coaching IA 1-to-1 sur mesure pour n'importe quel poste — secrétaire, comptable, manager, indépendant, designer… On fait le point sur votre métier, on automatise les tâches répétitives, on installe les bons outils. Amorti en quelques jours grâce aux heures gagnées.",
    taglineEn:
      "Bespoke 1-on-1 AI coaching for any role — assistant, accountant, manager, independent, designer… We review your job, automate repetitive tasks, install the right tools. Pays for itself in days thanks to the hours reclaimed.",
    pathFr: "/interventions/individuel",
    pathEn: "/interventions/individual",
    hasDurations: false,
    // Sprint 14.10.7 fix charte couleur (Will 2026-05-11) : terracotta
    // (orange brûlé Axion-IA) — pas de bleu ni de vert. Distinction inter-famille
    // se fait par la mise en page et le contenu, pas la couleur.
    accent: "terracotta",
  },
  {
    // Sprint 14.10.7 — recentrage Will (2026-05-11) : 1 dirigeant (pas CODIR),
    // bénéfices visibles (structurer l'entreprise + chiffrer les gains IA).
    id: "dirigeants",
    slug: "dirigeants",
    labelFr: "Dirigeants",
    labelEn: "Executives",
    taglineFr:
      "Une journée 1-to-1 avec le dirigeant — prendre de la hauteur, hiérarchiser les leviers IA de votre secteur et repartir avec des priorités claires. Pour un seul dirigeant, pas un comité.",
    taglineEn:
      "A 1-on-1 day with the executive — take the high view, rank the AI levers of your sector and leave with clear priorities. For one executive, not a committee.",
    // Sprint 14.10.7 (Will 2026-05-12) — `/interventions/dirigeants` est
    // désormais un HUB FAMILLE listant les 3 formats Dirigeants. Chaque format
    // a sa page détail dédiée (cf. pathFr des entries `dirigeants`,
    // `dirigeant-vision-strategique`, `claude-dirigeant`).
    pathFr: "/interventions/dirigeants",
    pathEn: "/interventions/executives",
    hasDurations: false,
    accent: "mocha",
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
    // SSOT squelette — durée ISO canonique (fin du littéral local). `!` : ces
    // 3 paliers ont toujours une ISO (seul « 3 jours et + » est null, sans champ).
    iso8601Duration: getDurationCanonical("4h").iso!,
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
    iso8601Duration: getDurationCanonical("1-jour").iso!,
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
    iso8601Duration: getDurationCanonical("2-jours").iso!,
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

const FOUR_H_PRICE = getTierById(INTERVENTION_TIERS, "intervention-4h").priceFlat!;
const ESSENTIELLE_PRICE = getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!;
const APPROFONDIE_PRICE = getTierById(INTERVENTION_TIERS, "intervention-approfondie").priceFlat!;
const TEMPS_TIER = getTierById(INTERVENTION_TIERS, "intervention-temps");
const DIRIGEANT_VISION_TIER = getTierById(INTERVENTION_TIERS, "intervention-dirigeant-vision");
const MEMBRE_EQUIPE_TIER = getTierById(INTERVENTION_TIERS, "intervention-membre-equipe");
const CLAUDE_PRICE = getTierById(INTERVENTION_TIERS, "intervention-claude").priceFlat!;

export const INTERVENTION_FORMATS: ReadonlyArray<InterventionFormatEntry> = [
  // -------------------------------------------------------------------------
  // FAMILLE : Collectives / Palier 4 heures
  // Sprint 14.10.7 (Will 2026-05-11) — 2 demi-journées express. Prix « Sur
  // devis » en V1 (à figer après premiers retours). Pas de page détail
  // dédiée : pathFr pointe vers /contact?objet=...#message pour cadrage rapide.
  // -------------------------------------------------------------------------
  {
    slug: "demarrage-ia-express",
    family: "collectives",
    duration: "4h",
    // Sprint 14.10.7 fix Will (2026-05-11) : page détail indexable
    // dédiée. Avant : /interventions/demande?objet=... (sans page propre).
    pathFr: "/interventions/demarrage-ia-express",
    pathEn: "/interventions/ai-express-kickoff",
    labelFr: "Démarrage IA Express",
    labelEn: "AI Express Kickoff",
    taglineFr:
      "Demi-journée (4 h) pour démystifier l'IA : panorama outils 2026, démos live sur cas réels de votre secteur, 2-3 prompts opérationnels testés ensemble. Vos équipes ressortent avec une vision claire et des quick-wins prêts à appliquer.",
    taglineEn:
      "Half-day (4 h) to demystify AI: 2026 tools panorama, live demos on real cases from your sector, 2-3 operational prompts tested together. Your teams leave with a clear vision and quick-wins ready to apply.",
    priceFr: formatAmount(FOUR_H_PRICE, "fr"),
    priceEn: formatAmount(FOUR_H_PRICE, "en"),
    groupSizeFr: "2 à 12 personnes",
    groupSizeEn: "2 to 12 people",
    audienceFr: "Équipes qui découvrent l'IA · TPE, PME",
    audienceEn: "Teams discovering AI · small businesses",
    accent: "terracotta",
    badgeFr: "Découverte · 4 h",
    badgeEn: "Discovery · 4 h",
  },
  // Atelier IA ciblé supprimé le 2026-06-03 (Will) — le palier 4 h ne garde
  // qu'une seule formation (Démarrage IA Express). 301 vers /collectives/4h
  // (cf. next.config.ts redirects).

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
    priceFr: `À partir de ${formatAmount(ESSENTIELLE_PRICE, "fr")}`,
    priceEn: `Starting at ${formatAmount(ESSENTIELLE_PRICE, "en")}`,
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
    priceFr: `À partir de ${formatAmount(TEMPS_TIER.priceFlat!, "fr")}`,
    priceEn: `Starting at ${formatAmount(TEMPS_TIER.priceFlat!, "en")}`,
    groupSizeFr: "2 à 30 personnes",
    groupSizeEn: "2 to 30 people",
    audienceFr: "Équipes opérationnelles · TPE, PME, ETI",
    audienceEn: "Operational teams · small to mid-market",
    accent: "terracotta",
    badgeFr: "Productivité",
    badgeEn: "Productivity",
  },
  {
    // Will (audit /interventions 2026-05-12) — Bookable direct calendrier.
    // 2026-06-02 — prix dérivé de la SSOT pricing.ts (`intervention-claude`,
    // 990 € HT depuis 2026-05-24) au lieu d'un 690 € hardcodé devenu obsolète.
    slug: "intervention-claude",
    family: "collectives",
    duration: "1-jour",
    pathFr: "/interventions/intervention-claude",
    pathEn: "/interventions/intervention-claude",
    labelFr: "Intervention Claude",
    labelEn: "Claude intervention",
    taglineFr:
      "1 journée 100 % dédiée à Claude (Anthropic) — Chat · Cowork · Code. Jusqu'à 30 personnes (tarif dégressif), vos équipes ressortent autonomes sur l'outil de pointe IA.",
    taglineEn:
      "Full day 100 % focused on Claude (Anthropic) — Chat · Cowork · Code. Up to 30 people (scaling price), your teams leave autonomous on the cutting-edge AI tool.",
    priceFr: `À partir de ${formatAmount(CLAUDE_PRICE, "fr")}`,
    priceEn: `Starting at ${formatAmount(CLAUDE_PRICE, "en")}`,
    groupSizeFr: "2 à 30 personnes",
    groupSizeEn: "2 to 30 people",
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
    priceFr: `À partir de ${formatAmount(APPROFONDIE_PRICE, "fr")}`,
    priceEn: `Starting at ${formatAmount(APPROFONDIE_PRICE, "en")}`,
    groupSizeFr: "2 à 30 personnes",
    groupSizeEn: "2 to 30 people",
    audienceFr: "Équipes opérationnelles · TPE, PME, ETI",
    audienceEn: "Operational teams · small to mid-market",
    accent: "terracotta",
    badgeFr: "Équipes · 2 jours",
    badgeEn: "Teams · 2 days",
  },

  // -------------------------------------------------------------------------
  // FAMILLE : Dirigeants (liste plate, pas de paliers durée)
  // -------------------------------------------------------------------------
  {
    // Sprint 14.10.7 (Will 2026-05-12) — 2ᵉ format dirigeants : VISION
    // STRATÉGIQUE pour l'entreprise. Pas un audit complet, juste « ouvrir
    // les yeux » du dirigeant : panorama IA secteur, opportunités stratégiques,
    // comment ses concurrents bougent, comment penser différemment grâce à
    // l'IA, quelles automatisations en surface l'entreprise pourrait viser.
    slug: "dirigeant-vision-strategique",
    family: "dirigeants",
    // Sprint 14.10.7 (Will 2026-05-12) — page détail dédiée.
    pathFr: "/interventions/dirigeant-vision-strategique",
    pathEn: "/interventions/executive-strategic-vision",
    labelFr: "Vision IA stratégique",
    labelEn: "Strategic AI vision",
    taglineFr:
      "1 journée 1-to-1 pour ouvrir les yeux du dirigeant sur ce que l'IA change DANS SON SECTEUR. Panorama des opportunités stratégiques, ce que font vraiment vos concurrents, quelles automatisations chercher, comment penser différemment l'entreprise. Pas un audit complet — un déclic stratégique.",
    taglineEn:
      "1-on-1 day to open the executive's eyes to what AI changes IN THEIR SECTOR. Strategic opportunity panorama, what competitors actually do, automations to look for, how to think the company differently. Not a full audit — a strategic shift.",
    priceFr: formatPrice(DIRIGEANT_VISION_TIER, "fr"),
    priceEn: formatPrice(DIRIGEANT_VISION_TIER, "en"),
    groupSizeFr: "1 dirigeant (1-to-1)",
    groupSizeEn: "1 executive (1-on-1)",
    audienceFr: "Dirigeant qui veut anticiper la vague IA sur son secteur",
    audienceEn: "Executive who wants to anticipate the AI wave on their sector",
    accent: "mocha",
    badgeFr: "Vision & stratégie · 1-to-1",
    badgeEn: "Vision & strategy · 1-on-1",
  },
  // -------------------------------------------------------------------------
  // FAMILLE : Individuel — coaching 1-to-1 « Optimisation du poste ».
  // Refonte 1-to-1 AFEST (Will 2026-06-13) : coaching « Optimisation du poste »,
  // générique tous métiers (secrétaire, chef de chantier, commercial…). Le but
  // n'est PAS de construire des automatisations mais de cartographier le
  // fonctionnement actuel et d'identifier ce qu'on peut automatiser pour gagner
  // du temps. Le format Claude individuel (centré outil) a été retiré.
  // -------------------------------------------------------------------------
  {
    slug: "coaching-decouverte",
    family: "individuel",
    pathFr: "/interventions/coaching-decouverte",
    pathEn: "/interventions/discovery-coaching",
    labelFr: "Coaching IA · Optimisation du poste",
    labelEn: "AI Coaching · Workstation optimization",
    taglineFr:
      "1 journée sur votre poste : on cartographie votre fonctionnement actuel et vos chronophages, puis on identifie ce qu'on peut automatiser pour vous faire gagner du temps (et de l'argent). Vous repartez avec un plan d'optimisation personnalisé.",
    taglineEn:
      "1 day at your workstation: we map your current workflow and time-sinks, then identify what can be automated to save you time (and money). You leave with a personalized optimization plan.",
    priceFr: formatPrice(MEMBRE_EQUIPE_TIER, "fr"),
    priceEn: formatPrice(MEMBRE_EQUIPE_TIER, "en"),
    groupSizeFr: "1 personne (1-to-1 strict)",
    groupSizeEn: "1 person (strict 1-on-1)",
    audienceFr: "Tout poste · secrétaire, chef de chantier, commercial, manager…",
    audienceEn: "Any role · assistant, site manager, sales, manager…",
    accent: "terracotta",
    badgeFr: "Sur votre poste réel",
    badgeEn: "At your real workstation",
  },
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
 * Pour les paliers `isQuoteOnly` (3 jours et +) : construit l'URL de la page
 * demande dédiée avec l'objet pré-rempli. Sprint 14.10.7 — Will exige une
 * page indexable (/interventions/demande) pas un scroll anchor.
 */
export function quoteContactPath(duration: DurationDef, locale: Locale): string {
  const base = locale === "fr" ? "/interventions/demande" : "/interventions/request";
  const obj = duration.contactObject ?? "formation-sur-mesure";
  return `${base}?objet=${encodeURIComponent(obj)}`;
}
