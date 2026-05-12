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
      "Journée(s) 1-to-1 avec le dirigeant — structurer l'entreprise, implémenter l'IA et chiffrer précisément les gains. Pour un seul dirigeant, pas un comité.",
    taglineEn:
      "1-on-1 day(s) with the executive — structure the company, implement AI and quantify precise gains. For one executive, not a committee.",
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
    // Sprint 14.10.7 fix charte couleur (Will 2026-05-11) : terracotta
    // (orange brûlé Axion-IA), comme toutes les familles non-Dirigeants.
    accent: "terracotta",
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

const FOUR_H_PRICE = getTierById(INTERVENTION_TIERS, "intervention-4h").priceFlat!;
const ESSENTIELLE_PRICE = getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!;
const APPROFONDIE_PRICE = getTierById(INTERVENTION_TIERS, "intervention-approfondie").priceFlat!;
const TEMPS_TIER = getTierById(INTERVENTION_TIERS, "intervention-temps");
const DIRIGEANTS_TIER = getTierById(INTERVENTION_TIERS, "intervention-dirigeants");

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
    groupSizeFr: "2 à 20 personnes",
    groupSizeEn: "2 to 20 people",
    audienceFr: "Équipes qui découvrent l'IA · TPE, PME",
    audienceEn: "Teams discovering AI · small businesses",
    accent: "terracotta",
    badgeFr: "Découverte · 4 h",
    badgeEn: "Discovery · 4 h",
  },
  {
    slug: "atelier-ia-cible",
    family: "collectives",
    duration: "4h",
    // Sprint 14.10.7 fix Will (2026-05-11) : page détail indexable dédiée.
    pathFr: "/interventions/atelier-ia-cible",
    pathEn: "/interventions/targeted-ai-workshop",
    labelFr: "Atelier IA ciblé",
    labelEn: "Targeted AI Workshop",
    taglineFr:
      "Demi-journée (4 h) focalisée sur UN cas d'usage métier précis : rédaction commerciale, analyse de documents, automatisation reporting, traduction… À l'issue, chaque participant repart avec le cas implémenté sur son poste.",
    taglineEn:
      "Half-day (4 h) focused on ONE specific business case: sales writing, document analysis, reporting automation, translation… By the end, each participant leaves with the case implemented on their workstation.",
    priceFr: formatAmount(FOUR_H_PRICE, "fr"),
    priceEn: formatAmount(FOUR_H_PRICE, "en"),
    groupSizeFr: "2 à 15 personnes",
    groupSizeEn: "2 to 15 people",
    audienceFr: "Équipe avec besoin métier précis",
    audienceEn: "Team with a specific business need",
    accent: "terracotta",
    badgeFr: "Cas d'usage · 4 h",
    badgeEn: "Use case · 4 h",
  },

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
    priceFr: formatPrice(TEMPS_TIER, "fr"),
    priceEn: formatPrice(TEMPS_TIER, "en"),
    groupSizeFr: "2 à 20 personnes",
    groupSizeEn: "2 to 20 people",
    audienceFr: "Équipes opérationnelles · TPE, PME, ETI",
    audienceEn: "Operational teams · small to mid-market",
    accent: "terracotta",
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
    // Sprint 14.10.7 (Will 2026-05-12) — refondu : focus 100 % sur la
    // PRODUCTIVITÉ PERSONNELLE du dirigeant. Comment optimiser SA journée,
    // automatiser SES tâches répétitives, lui faire gagner du temps. C'est
    // une formation sur le dirigeant LUI-MÊME.
    slug: "dirigeants",
    family: "dirigeants",
    pathFr: "/interventions/dirigeants",
    pathEn: "/interventions/executives",
    labelFr: "Productivité dirigeant",
    labelEn: "Executive productivity",
    taglineFr:
      "1 journée 1-to-1 entièrement sur VOUS, dirigeant. On regarde votre vraie journée — boîte mail, prépa réunions, reporting, suivi commercial, comptes-rendus — et on installe les bons usages IA pour vous faire gagner plusieurs heures par semaine. Sans intermédiaire, sans équipe à embarquer.",
    taglineEn:
      "1-on-1 day entirely about YOU, the executive. We look at your real day — inbox, meeting prep, reporting, sales follow-up, meeting notes — and install the right AI methods to save you several hours per week. No intermediary, no team to onboard.",
    priceFr: formatPrice(DIRIGEANTS_TIER, "fr"),
    priceEn: formatPrice(DIRIGEANTS_TIER, "en"),
    groupSizeFr: "1 dirigeant (1-to-1)",
    groupSizeEn: "1 executive (1-on-1)",
    audienceFr: "Dirigeant qui veut gagner du temps sur son propre quotidien",
    audienceEn: "Executive who wants to save time on their own daily work",
    accent: "mocha",
    badgeFr: "Gain de temps personnel · 1-to-1",
    badgeEn: "Personal time saving · 1-on-1",
  },
  {
    // Sprint 14.10.7 (Will 2026-05-12) — 2ᵉ format dirigeants : VISION
    // STRATÉGIQUE pour l'entreprise. Pas un audit complet, juste « ouvrir
    // les yeux » du dirigeant : panorama IA secteur, opportunités stratégiques,
    // comment ses concurrents bougent, comment penser différemment grâce à
    // l'IA, quelles automatisations en surface l'entreprise pourrait viser.
    slug: "dirigeant-vision-strategique",
    family: "dirigeants",
    pathFr: "/interventions/demande?objet=dirigeant-vision-strategique",
    pathEn: "/interventions/request?objet=dirigeant-vision-strategique",
    labelFr: "Vision IA stratégique",
    labelEn: "Strategic AI vision",
    taglineFr:
      "1 journée 1-to-1 pour ouvrir les yeux du dirigeant sur ce que l'IA change DANS SON SECTEUR. Panorama des opportunités stratégiques, ce que font vraiment vos concurrents, quelles automatisations chercher, comment penser différemment l'entreprise. Pas un audit complet — un déclic stratégique.",
    taglineEn:
      "1-on-1 day to open the executive's eyes to what AI changes IN THEIR SECTOR. Strategic opportunity panorama, what competitors actually do, automations to look for, how to think the company differently. Not a full audit — a strategic shift.",
    priceFr: "Sur devis",
    priceEn: "On request",
    groupSizeFr: "1 dirigeant (1-to-1)",
    groupSizeEn: "1 executive (1-on-1)",
    audienceFr: "Dirigeant qui veut anticiper la vague IA sur son secteur",
    audienceEn: "Executive who wants to anticipate the AI wave on their sector",
    accent: "mocha",
    badgeFr: "Vision & stratégie · 1-to-1",
    badgeEn: "Vision & strategy · 1-on-1",
  },
  {
    // Sprint 14.10.7 (Will 2026-05-11) — variante Claude pour dirigeant.
    // Même format 1-to-1 que la journée stratégique, mais focalisé sur la
    // maîtrise complète de Claude (Anthropic) côté dirigeant : Chat avancé,
    // Projects mémoire, Code CLI pour les dossiers stratégiques.
    slug: "claude-dirigeant",
    family: "dirigeants",
    pathFr: "/interventions/demande?objet=claude-dirigeant",
    pathEn: "/interventions/request?objet=claude-dirigeant",
    labelFr: "Intervention Claude · Dirigeant",
    labelEn: "Claude Intervention · Executive",
    taglineFr:
      "1 journée 1-to-1 avec le dirigeant 100 % dédiée à Claude (Anthropic) — Chat avancé, Projects + mémoire stratégique, Claude Code CLI pour vos dossiers confidentiels. À la sortie, vous maîtrisez l'outil IA de pointe pour vos décisions.",
    taglineEn:
      "1-on-1 executive day 100 % focused on Claude (Anthropic) — advanced Chat, Projects + strategic memory, Claude Code CLI for your confidential files. You leave with full mastery of the cutting-edge AI tool for your decisions.",
    priceFr: "Sur devis",
    priceEn: "On request",
    groupSizeFr: "1 dirigeant (1-to-1)",
    groupSizeEn: "1 executive (1-on-1)",
    audienceFr: "Dirigeant qui veut maîtriser Claude pour ses propres dossiers",
    audienceEn: "Executive who wants to master Claude for their own files",
    accent: "claude",
    badgeFr: "Outil · Claude",
    badgeEn: "Tool · Claude",
  },

  // -------------------------------------------------------------------------
  // FAMILLE : Conférence (liste plate, pas de paliers durée)
  // Sprint 14.10.7 — extraite de Collectives/1-jour pour devenir une famille
  // à part entière. Décision Will (2026-05-11).
  // 2 formats distincts (Will 2026-05-12) :
  //   1. `conference` — plénière 1 journée immersive (séminaire, kick-off
  //      annuel, formation large échelle)
  //   2. `conference-keynote` — keynote courte 1-2 h, en soirée / afterwork
  //      / intégrée dans un événement client. Pas de redondance avec la
  //      plénière (durée, format, contexte différents).
  // -------------------------------------------------------------------------
  {
    slug: "conference",
    family: "conference",
    pathFr: "/interventions/conference",
    pathEn: "/interventions/conference",
    labelFr: "Conférence plénière",
    labelEn: "Plenary talk",
    taglineFr:
      "Plénière 1 journée pour mettre toute l'entreprise au même niveau IA — séminaires internes, kick-off annuels, formations grande échelle. Panorama IA 2026, démos live, Q&A, ateliers par groupes.",
    taglineEn:
      "1-day plenary to bring your whole company to the same AI level — internal seminars, annual kick-offs, large-scale onboarding. 2026 AI panorama, live demos, Q&A, group workshops.",
    priceFr: "Sur devis",
    priceEn: "On request",
    groupSizeFr: "Grands effectifs · 30 à 500+ personnes",
    groupSizeEn: "Large audiences · 30 to 500+ people",
    audienceFr: "Toute l'entreprise au même niveau IA en 1 journée",
    audienceEn: "Whole company at the same AI level in 1 day",
    accent: "terracotta",
    badgeFr: "Plénière · 1 journée",
    badgeEn: "Plenary · 1 day",
  },
  {
    // Sprint 14.10.7 (Will 2026-05-12) — 2ᵉ format Conférence : keynote
    // courte 1-2 h, en soirée ou intégrée dans un événement (afterwork,
    // soirée client, séminaire externe). Format ÉVÉNEMENTIEL — pas un
    // remplaçant de la plénière journée, un complément pour les contextes
    // où la journée pleine ne colle pas.
    slug: "conference-keynote",
    family: "conference",
    pathFr: "/interventions/demande?objet=conference-keynote",
    pathEn: "/interventions/request?objet=conference-keynote",
    labelFr: "Keynote IA · événementielle",
    labelEn: "AI Keynote · event format",
    taglineFr:
      "Keynote 1 à 2 heures sur l'IA opérationnelle 2026 — pour soirées clients, afterworks d'entreprise, séminaires externes, conventions, salons. Format dense, percutant, accessible à tous. Q&A live à la fin.",
    taglineEn:
      "1 to 2 hour keynote on operational AI 2026 — for client evenings, corporate afterworks, external seminars, conventions, trade shows. Dense, impactful, accessible to all. Live Q&A at the end.",
    priceFr: "Sur devis",
    priceEn: "On request",
    groupSizeFr: "Audience événement · 20 à 500+ personnes",
    groupSizeEn: "Event audience · 20 to 500+ people",
    audienceFr: "Événements clients, afterworks, conventions, salons",
    audienceEn: "Client events, afterworks, conventions, trade shows",
    accent: "terracotta",
    badgeFr: "Keynote · 1-2 h · soirée OK",
    badgeEn: "Keynote · 1-2 h · evening OK",
  },

  // -------------------------------------------------------------------------
  // FAMILLE : Individuel — 2 formats 1 jour, différenciés par profil maturité.
  // Will (2026-05-11) : même objectif fonctionnel (audit poste + automatismes
  // + programme implémentation devis), 2 cibles distinctes :
  //   • Découverte : managers/indépendants qui démarrent l'IA
  //   • Productivité avancée : utilisateurs IA déjà à l'aise qui maxent
  // Prix « Sur devis » en V1 — Will tranchera après les premiers retours
  // commerciaux.
  // -------------------------------------------------------------------------
  {
    slug: "coaching-decouverte",
    family: "individuel",
    pathFr: "/interventions/coaching-decouverte",
    pathEn: "/interventions/discovery-coaching",
    labelFr: "Coaching IA · Découverte personnelle",
    labelEn: "AI Coaching · Personal discovery",
    taglineFr:
      "1 journée sur votre poste pour découvrir l'IA pratique : on cartographie vos chronophages, on installe les outils essentiels, on met en place 3 à 5 automatismes concrets et on remet un plan d'implémentation pour aller plus loin sur devis.",
    taglineEn:
      "1 day on your workstation to discover practical AI: we map your time-sinks, install essential tools, set up 3-5 concrete automations and deliver an implementation plan to go further on request.",
    priceFr: "Sur devis",
    priceEn: "On request",
    groupSizeFr: "1 personne (1-to-1 strict)",
    groupSizeEn: "1 person (strict 1-on-1)",
    audienceFr: "Managers, indépendants, dirigeants solo · découvrent l'IA",
    audienceEn: "Managers, independents, solo executives · discovering AI",
    accent: "terracotta",
    badgeFr: "Niveau débutant → intermédiaire",
    badgeEn: "Beginner → intermediate",
  },
  {
    slug: "coaching-avance",
    family: "individuel",
    pathFr: "/interventions/coaching-avance",
    pathEn: "/interventions/advanced-coaching",
    labelFr: "Coaching IA · Productivité avancée",
    labelEn: "AI Coaching · Advanced productivity",
    taglineFr:
      "1 journée pour passer au niveau supérieur : workflows IA multi-outils, agents personnels, Claude CLI / API, automatisations sophistiquées. On audite votre stack actuelle, on l'optimise, on industrialise. Programme d'implémentation possible sur devis pour aller encore plus loin.",
    taglineEn:
      "1 day to level up: multi-tool AI workflows, personal agents, Claude CLI / API, sophisticated automations. We audit your current stack, optimise it, industrialise it. Further implementation programme on request.",
    priceFr: "Sur devis",
    priceEn: "On request",
    groupSizeFr: "1 personne (1-to-1 strict)",
    groupSizeEn: "1 person (strict 1-on-1)",
    audienceFr: "Pros déjà à l'aise avec ChatGPT/Claude · veulent maxer",
    audienceEn: "Pros already comfortable with ChatGPT/Claude · want to max out",
    accent: "terracotta",
    badgeFr: "Niveau avancé",
    badgeEn: "Advanced level",
  },
  {
    // Sprint 14.10.7 (Will 2026-05-11) — variante Claude pour 1 personne.
    // Format implémentation 1-to-1 strictement focalisé sur Claude (Anthropic) :
    // installation, configuration Projects + Code CLI sur votre poste, agents
    // personnels Claude, workflows Claude-only adaptés à votre métier.
    slug: "claude-implementation-individuel",
    family: "individuel",
    pathFr: "/interventions/demande?objet=claude-implementation-individuel",
    pathEn: "/interventions/request?objet=claude-implementation-individuel",
    labelFr: "Implémentation Claude · Individuel",
    labelEn: "Claude Implementation · Individual",
    taglineFr:
      "1 journée 1-to-1 sur votre poste, 100 % Claude (Anthropic) : installation, configuration Chat + Projects + Code CLI, agents personnels Claude pour vos cas récurrents, workflows métier dédiés. À la sortie, vous maîtrisez Claude pour votre travail quotidien.",
    taglineEn:
      "1-on-1 day on your workstation, 100 % Claude (Anthropic): installation, Chat + Projects + Code CLI configuration, personal Claude agents for your recurring cases, dedicated business workflows. You leave with full Claude mastery for your daily work.",
    priceFr: "Sur devis",
    priceEn: "On request",
    groupSizeFr: "1 personne (1-to-1 strict)",
    groupSizeEn: "1 person (strict 1-on-1)",
    audienceFr: "N'importe quel poste · veut maîtriser Claude en profondeur",
    audienceEn: "Any role · wants to master Claude in depth",
    accent: "claude",
    badgeFr: "Outil · Claude",
    badgeEn: "Tool · Claude",
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
