// SSOT du calendrier /reserver — Sprint « 3 blocs » (2026-06-10).
//
// POURQUOI ce fichier existe
// --------------------------
// Avant ce module, `BookingCalendar.tsx` re-hardcodait sa propre liste des
// formats réservables (`INTERVENTION_OPTIONS` + `INTERVENTION_VISUAL`), en
// parallèle de `pricing.ts` (prix), `interventions-taxonomy.ts` (pages) et
// l'enum Prisma `InterventionType`. Résultat : 3 listes à maintenir en phase,
// et des dérives (ex. « Dirigeants » affiché « Sur devis » côté calendrier
// alors que `pricing.ts` indique 1 190 € HT).
//
// Ce catalogue devient la SOURCE UNIQUE du sélecteur du calendrier. Il :
//   - groupe l'offre en 3 catégories visibles par le visiteur : Formations,
//     1-to-1, Audits (≠ familles SEO de la taxonomie : collectives / individuel
//     / dirigeants) ;
//   - dérive TOUS les prix de `pricing.ts` (plus aucun montant hardcodé ici) ;
//   - distingue les formats `bookable` (enum Prisma existant → ouvrent le modal
//     de réservation) des formats « sur devis » (`bookable: false` → la carte
//     renvoie vers la page détail / le formulaire de demande, pas de créneau).
//
// CONTRAT avec le reste du système
// --------------------------------
//   - Le `slug` d'un format `bookable` DOIT exister dans
//     `INTERVENTION_SLUGS` (`src/lib/intervention-type.ts`) ET dans l'enum
//     Prisma `InterventionType` — sinon le booking échoue côté server action.
//     Un test d'invariant (booking-catalog.test.ts) verrouille cette règle.
//   - On NE touche pas à `interventions-taxonomy.ts` (consommée par 14k+ pages
//     villes). Ce module est volontairement découplé et léger (pas d'import de
//     la taxonomie → bundle calendrier préservé, cf. budget Web Vitals
//     /reserver : First Load ≤ 110 KB gz).
//
// Pour modifier un prix : éditer `pricing.ts` (il se propage ici).
// Pour rendre un format « sur devis » réservable : ajouter son enum Prisma +
// son slug à INTERVENTION_SLUGS, puis passer `bookable: true` + `durationDays`.

import type { InterventionSlug } from "@/lib/intervention-type";
import {
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  UN_A_UN_RECURRING_TIER,
  formatAmount,
  getTierById,
} from "@/content/pricing";

// ============================================================================
// Types
// ============================================================================

export type BookingCategoryId = "formation" | "un-a-un" | "audit";

/** Accent visuel — mappé vers des classes Tailwind dans BookingCalendar. */
export type BookingAccent = "terracotta" | "primary" | "mocha" | "claude" | "sage";

/** Clé d'icône — mappée vers un composant lucide dans BookingCalendar. */
export type BookingIconKey =
  | "sparkles"
  | "layers"
  | "mic"
  | "crown"
  | "star"
  | "shield"
  | "user"
  | "compass"
  | "rocket"
  | "repeat"
  | "graduation"
  | "users"
  | "clipboard";

export interface BookingFormat {
  /** Identifiant stable. Si `bookable`, DOIT être un `InterventionSlug` valide. */
  slug: string;
  labelFr: string;
  labelEn: string;
  /**
   * `true` = ouvre le modal de réservation (créneau calendrier). Exige un enum
   * Prisma. `false` = format « sur devis » → la carte renvoie vers `hrefFr/En`.
   */
  bookable: boolean;
  /** Durée en jours — pertinent uniquement si `bookable` (logique de blocage
   *  des cellules). Les formats sur devis utilisent 1 par défaut (non utilisé). */
  durationDays: 1 | 2;
  iconKey: BookingIconKey;
  accent: BookingAccent;
  /** Prix formaté, dérivé de pricing.ts (ou « Sur devis »). */
  priceFr: string;
  priceEn: string;
  /** Précision horaire/format affichée sous le titre. */
  scheduleHintFr: string;
  scheduleHintEn: string;
  /** Mini-résumé conversion (révélé au hover / à la sélection). */
  previewFr: string;
  previewEn: string;
  /** `true` = expose le sélecteur d'effectif → prix (modal étape 1). */
  tiered?: boolean;
  /** Cible du lien pour les formats « sur devis » (chemin sans préfixe locale). */
  hrefFr?: string;
  hrefEn?: string;
}

export interface BookingCategory {
  id: BookingCategoryId;
  labelFr: string;
  labelEn: string;
  taglineFr: string;
  taglineEn: string;
  iconKey: BookingIconKey;
  accent: BookingAccent;
  formats: ReadonlyArray<BookingFormat>;
}

// ============================================================================
// Helpers de prix — 100 % dérivés de pricing.ts (aucun montant hardcodé)
// ============================================================================

const surDevis = { fr: "Sur devis", en: "On request" } as const;

/** Prix fixe compact (« 1 190 € ») d'un tier intervention. */
function flat(tierId: string): { fr: string; en: string } {
  const price = getTierById(INTERVENTION_TIERS, tierId).priceFlat!;
  return {
    fr: formatAmount(price, "fr", { compact: true }),
    en: formatAmount(price, "en", { compact: true }),
  };
}

/** « À partir de <prix d'entrée> » d'un tier intervention (prix d'entrée = priceFlat). */
function from(tierId: string): { fr: string; en: string } {
  const price = getTierById(INTERVENTION_TIERS, tierId).priceFlat!;
  return {
    fr: `À partir de ${formatAmount(price, "fr", { compact: true })}`,
    en: `Starting at ${formatAmount(price, "en", { compact: true })}`,
  };
}

/** « À partir de <priceMin> » d'un tier audit (audits = priceMin + sous-tiers). */
function fromAudit(tierId: string): { fr: string; en: string } {
  const price = getTierById(AUDIT_TIERS, tierId).priceMin!;
  return {
    fr: `À partir de ${formatAmount(price, "fr", { compact: true })}`,
    en: `Starting at ${formatAmount(price, "en", { compact: true })}`,
  };
}

/** Prix d'un sous-tier d'un tier audit (ex. audit-flash → audit-flash-onsite). */
function auditSub(tierId: string, subId: string): { fr: string; en: string } {
  const sub = getTierById(AUDIT_TIERS, tierId).subTiers!.find((s) => s.id === subId)!;
  return {
    fr: formatAmount(sub.priceFlat, "fr", { compact: true }),
    en: formatAmount(sub.priceFlat, "en", { compact: true }),
  };
}

const recurring = {
  fr: `À partir de ${formatAmount(UN_A_UN_RECURRING_TIER.priceFlat!, "fr", { compact: true })}/session`,
  en: `Starting at ${formatAmount(UN_A_UN_RECURRING_TIER.priceFlat!, "en", { compact: true })}/session`,
};

// ============================================================================
// Catalogue — 3 catégories visibles
// ============================================================================

export const BOOKING_CATALOG: ReadonlyArray<BookingCategory> = [
  // --------------------------------------------------------------------------
  // FORMATIONS (collectif) — 6 formats, tous réservables (enum Prisma OK).
  // --------------------------------------------------------------------------
  {
    id: "formation",
    labelFr: "Formations",
    labelEn: "Trainings",
    taglineFr:
      "Formations IA pour vos équipes sur site — de la demi-journée découverte aux 2 jours d'approfondissement.",
    taglineEn:
      "On-site AI trainings for your teams — from a half-day discovery to a 2-day deep dive.",
    iconKey: "graduation",
    accent: "terracotta",
    formats: [
      {
        slug: "essentielle",
        labelFr: "L'Essentielle",
        labelEn: "The Essential",
        bookable: true,
        durationDays: 1,
        iconKey: "sparkles",
        accent: "terracotta",
        priceFr: from("intervention-essentielle").fr,
        priceEn: from("intervention-essentielle").en,
        scheduleHintFr: "Journée · 9 h – 17 h · collectif",
        scheduleHintEn: "Day · 9 a.m. – 5 p.m. · collective",
        previewFr:
          "Découvrir les outils IA · 5 à 10 usages identifiés · automatisations dès le lendemain",
        previewEn: "Discover AI tools · 5 to 10 uses identified · automations from day two",
        tiered: true,
      },
      {
        slug: "gagner-du-temps",
        labelFr: "Gagner du temps",
        labelEn: "Save Time",
        bookable: true,
        durationDays: 1,
        iconKey: "star",
        accent: "terracotta",
        priceFr: from("intervention-temps").fr,
        priceEn: from("intervention-temps").en,
        scheduleHintFr: "Journée · 9 h – 17 h · sur site",
        scheduleHintEn: "Day · 9 a.m. – 5 p.m. · on site",
        previewFr:
          "Automatiser les tâches récurrentes · plusieurs heures gagnées par personne et par semaine",
        previewEn: "Automate recurring tasks · hours reclaimed per person every week",
        tiered: true,
      },
      {
        slug: "intervention-claude",
        labelFr: "Formation Claude",
        labelEn: "Claude Training",
        bookable: true,
        durationDays: 1,
        iconKey: "sparkles",
        accent: "claude",
        priceFr: from("intervention-claude").fr,
        priceEn: from("intervention-claude").en,
        scheduleHintFr: "Journée · 9 h – 17 h · 100 % Claude",
        scheduleHintEn: "Day · 9 a.m. – 5 p.m. · 100 % Claude",
        previewFr: "1 journée 100 % Claude · jusqu'à 30 pers. · Chat + Projects + Code CLI",
        previewEn: "1 day 100 % Claude · up to 30 ppl · Chat + Projects + Code CLI",
        tiered: true,
      },
      {
        slug: "demarrage-ia-express",
        labelFr: "Démarrage IA Express · 4 h",
        labelEn: "AI Express Kickoff · 4 h",
        bookable: true,
        durationDays: 1,
        iconKey: "rocket",
        accent: "terracotta",
        priceFr: flat("intervention-4h").fr,
        priceEn: flat("intervention-4h").en,
        scheduleHintFr: "Demi-journée · 9 h – 13 h · sur site",
        scheduleHintEn: "Half-day · 9 a.m. – 1 p.m. · on site",
        previewFr:
          "Demi-journée · démystifier l'IA · panorama 2026 · 2-3 prompts opérationnels testés",
        previewEn: "Half-day · demystify AI · 2026 panorama · 2-3 working prompts tested",
      },
      {
        slug: "approfondie",
        labelFr: "L'Approfondie · 2 jours",
        labelEn: "Deep Dive · 2 days",
        bookable: true,
        durationDays: 2,
        iconKey: "layers",
        accent: "primary",
        priceFr: from("intervention-approfondie").fr,
        priceEn: from("intervention-approfondie").en,
        scheduleHintFr: "2 jours consécutifs · collectif",
        scheduleHintEn: "2 consecutive days · collective",
        previewFr:
          "2 jours équipes · 10 à 20 automatisations co-construites · plan d'action 30 jours",
        previewEn: "2 team days · 10 to 20 co-built automations · 30-day action plan",
        tiered: true,
      },
      {
        slug: "conference",
        labelFr: "Conférence 1 journée",
        labelEn: "1-day Talk",
        bookable: true,
        durationDays: 1,
        iconKey: "mic",
        accent: "terracotta",
        priceFr: surDevis.fr,
        priceEn: surDevis.en,
        scheduleHintFr: "Journée · plénière grands effectifs",
        scheduleHintEn: "Day · plenary for large audiences",
        previewFr: "Sensibiliser toute l'entreprise · panorama IA 2026 · démos live + Q&A",
        previewEn: "Upskill the whole company · 2026 AI panorama · live demos + Q&A",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // 1-TO-1 — dirigeant ET collaborateur. Seul « Dirigeant » est réservable
  // direct (enum `dirigeants`). Les autres sont « sur devis » → lien page.
  // --------------------------------------------------------------------------
  {
    id: "un-a-un",
    labelFr: "1 to 1",
    labelEn: "1-on-1",
    taglineFr:
      "Coaching IA individuel — pour le dirigeant comme pour n'importe quel collaborateur. On part de votre poste réel.",
    taglineEn:
      "Individual AI coaching — for the executive or any team member. We start from your real job.",
    iconKey: "user",
    accent: "mocha",
    formats: [
      {
        slug: "dirigeants",
        labelFr: "Dirigeant · Productivité",
        labelEn: "Executive · Productivity",
        bookable: true,
        durationDays: 1,
        iconKey: "crown",
        accent: "mocha",
        priceFr: flat("intervention-dirigeants").fr,
        priceEn: flat("intervention-dirigeants").en,
        scheduleHintFr: "Journée · 1-to-1 · sur site",
        scheduleHintEn: "Day · 1-on-1 · on site",
        previewFr: "1 journée 1-to-1 sur VOTRE quotidien · plusieurs heures gagnées par semaine",
        previewEn: "1-on-1 day about YOUR daily work · several hours saved per week",
      },
      {
        slug: "dirigeant-vision-strategique",
        labelFr: "Dirigeant · Vision IA stratégique",
        labelEn: "Executive · Strategic AI vision",
        bookable: false,
        durationDays: 1,
        iconKey: "compass",
        accent: "mocha",
        priceFr: flat("intervention-dirigeant-vision").fr,
        priceEn: flat("intervention-dirigeant-vision").en,
        scheduleHintFr: "Journée · 1-to-1 · vision secteur",
        scheduleHintEn: "Day · 1-on-1 · sector vision",
        previewFr: "Ouvrir les yeux du dirigeant sur l'IA de son secteur · déclic stratégique",
        previewEn: "Open the executive's eyes to AI in their sector · strategic shift",
        hrefFr: "/interventions/dirigeant-vision-strategique",
        hrefEn: "/interventions/executive-strategic-vision",
      },
      {
        slug: "claude-dirigeant",
        labelFr: "Dirigeant · 100 % Claude",
        labelEn: "Executive · 100 % Claude",
        bookable: false,
        durationDays: 1,
        iconKey: "crown",
        accent: "claude",
        priceFr: flat("intervention-claude-dirigeant").fr,
        priceEn: flat("intervention-claude-dirigeant").en,
        scheduleHintFr: "Journée · 1-to-1 · 100 % Claude",
        scheduleHintEn: "Day · 1-on-1 · 100 % Claude",
        previewFr: "1-to-1 dirigeant 100 % Claude · Chat avancé + Projects + Code CLI",
        previewEn: "1-on-1 executive 100 % Claude · advanced Chat + Projects + Code CLI",
        hrefFr: "/interventions/claude-dirigeant",
        hrefEn: "/interventions/claude-executive",
      },
      {
        slug: "coaching-decouverte",
        labelFr: "Collaborateur · Découverte",
        labelEn: "Team member · Discovery",
        bookable: false,
        durationDays: 1,
        iconKey: "user",
        accent: "terracotta",
        priceFr: surDevis.fr,
        priceEn: surDevis.en,
        scheduleHintFr: "Journée · 1-to-1 · sur votre poste",
        scheduleHintEn: "Day · 1-on-1 · at your workstation",
        previewFr:
          "1 journée sur votre poste · 3 à 5 automatismes installés · plan d'implémentation",
        previewEn: "1 day at your workstation · 3-5 automations installed · implementation plan",
        hrefFr: "/interventions/coaching-decouverte",
        hrefEn: "/interventions/discovery-coaching",
      },
      {
        slug: "coaching-avance",
        labelFr: "Collaborateur · Productivité avancée",
        labelEn: "Team member · Advanced productivity",
        bookable: false,
        durationDays: 1,
        iconKey: "star",
        accent: "terracotta",
        priceFr: surDevis.fr,
        priceEn: surDevis.en,
        scheduleHintFr: "Journée · 1-to-1 · niveau avancé",
        scheduleHintEn: "Day · 1-on-1 · advanced level",
        previewFr:
          "Workflows IA multi-outils · agents personnels · Claude CLI / API · automatisations sophistiquées",
        previewEn:
          "Multi-tool AI workflows · personal agents · Claude CLI / API · sophisticated automations",
        hrefFr: "/interventions/coaching-avance",
        hrefEn: "/interventions/advanced-coaching",
      },
      {
        slug: "claude-implementation-individuel",
        labelFr: "Collaborateur · 100 % Claude",
        labelEn: "Team member · 100 % Claude",
        bookable: false,
        durationDays: 1,
        iconKey: "user",
        accent: "claude",
        priceFr: surDevis.fr,
        priceEn: surDevis.en,
        scheduleHintFr: "Journée · 1-to-1 · 100 % Claude",
        scheduleHintEn: "Day · 1-on-1 · 100 % Claude",
        previewFr:
          "1-to-1 sur votre poste · 100 % Claude · Chat + Projects + Code CLI · workflows métier",
        previewEn:
          "1-on-1 at your workstation · 100 % Claude · Chat + Projects + Code CLI · business workflows",
        hrefFr: "/interventions/claude-implementation-individuel",
        hrefEn: "/interventions/claude-implementation-individual",
      },
      {
        slug: "un-a-un-recurrent",
        labelFr: "Coaching régulier 1-to-1",
        labelEn: "Recurring 1-on-1 coaching",
        bookable: false,
        durationDays: 1,
        iconKey: "repeat",
        accent: "mocha",
        priceFr: recurring.fr,
        priceEn: recurring.en,
        scheduleHintFr: "1 session/mois · contrat 6, 12 ou 24 mois",
        scheduleHintEn: "1 session/month · 6, 12 or 24-month contract",
        previewFr: "Coaching régulier · outils personnels · charge mentale allégée durablement",
        previewEn: "Regular coaching · personal tools · lasting lighter mental load",
        hrefFr: "/un-a-un",
        hrefEn: "/one-to-one",
      },
    ],
  },

  // --------------------------------------------------------------------------
  // AUDITS — seul « Flash terrain » est réservable (enum `audit_flash_onsite`).
  // Les audits Ciblé / Stratégique sont multi-semaines, sur devis → lien page.
  // --------------------------------------------------------------------------
  {
    id: "audit",
    labelFr: "Audits",
    labelEn: "Audits",
    taglineFr:
      "Audit IA de votre entreprise — du diagnostic terrain en 1 journée à la feuille de route stratégique multi-départements.",
    taglineEn:
      "AI audit of your company — from a 1-day field diagnostic to a multi-department strategic roadmap.",
    iconKey: "clipboard",
    accent: "terracotta",
    formats: [
      {
        slug: "audit-flash-onsite",
        labelFr: "Audit Flash terrain",
        labelEn: "On-site Flash audit",
        bookable: true,
        durationDays: 1,
        iconKey: "shield",
        accent: "terracotta",
        priceFr: auditSub("audit-flash", "audit-flash-onsite").fr,
        priceEn: auditSub("audit-flash", "audit-flash-onsite").en,
        scheduleHintFr: "Journée · 9 h – 17 h · sur site",
        scheduleHintEn: "Day · 9 a.m. – 5 p.m. · on site",
        previewFr:
          "1 journée sur site · cartographie 1 zone d'usage · démos live · rapport sous 48 h",
        previewEn: "1 day on site · map 1 use area · live demos · report within 48 h",
      },
      {
        slug: "audit-cible",
        labelFr: "Audit Ciblé",
        labelEn: "Targeted audit",
        bookable: false,
        durationDays: 1,
        iconKey: "clipboard",
        accent: "terracotta",
        priceFr: fromAudit("audit-cible").fr,
        priceEn: fromAudit("audit-cible").en,
        scheduleHintFr: "2-4 semaines · 1 département",
        scheduleHintEn: "2-4 weeks · 1 department",
        previewFr: "Audit focalisé sur un département ou une fonction · plan d'action chiffré",
        previewEn: "Audit focused on one department or function · costed action plan",
        hrefFr: "/audit/cible",
        hrefEn: "/audit/targeted",
      },
      {
        slug: "audit-strategique-pme",
        labelFr: "Audit Stratégique PME",
        labelEn: "SME Strategic audit",
        bookable: false,
        durationDays: 1,
        iconKey: "clipboard",
        accent: "primary",
        priceFr: fromAudit("audit-strategique-pme").fr,
        priceEn: fromAudit("audit-strategique-pme").en,
        scheduleHintFr: "4-6 semaines · multi-départements",
        scheduleHintEn: "4-6 weeks · multi-department",
        previewFr: "Audit complet multi-départements · feuille de route IA pour PME ambitieuses",
        previewEn: "Full multi-department audit · AI roadmap for ambitious SMEs",
        hrefFr: "/audit/strategique-pme",
        hrefEn: "/audit/strategic-sme",
      },
      {
        slug: "audit-strategique-eti",
        labelFr: "Audit Stratégique ETI",
        labelEn: "Mid-cap Strategic audit",
        bookable: false,
        durationDays: 1,
        iconKey: "clipboard",
        accent: "mocha",
        priceFr: fromAudit("audit-strategique-eti").fr,
        priceEn: fromAudit("audit-strategique-eti").en,
        scheduleHintFr: "6-12 semaines · transverse + gouvernance",
        scheduleHintEn: "6-12 weeks · transverse + governance",
        previewFr: "Audit transverse + gouvernance IA · ETI et grandes entreprises",
        previewEn: "Transverse audit + AI governance · mid-caps and large enterprises",
        hrefFr: "/audit/strategique-eti",
        hrefEn: "/audit/strategic-midcap",
      },
    ],
  },
];

// ============================================================================
// Dérivés + helpers
// ============================================================================

/** Tous les formats réservables (à plat), dans l'ordre du catalogue. */
export const BOOKABLE_FORMATS: ReadonlyArray<BookingFormat> = BOOKING_CATALOG.flatMap((c) =>
  c.formats.filter((f) => f.bookable),
);

/** Le slug d'un format réservable, typé `InterventionSlug` (validé au build). */
export type BookableSlug = InterventionSlug;

/** Retrouve un format réservable par son slug (pour le pré-remplissage `?intervention=`). */
export function findBookableBySlug(slug: string): BookingFormat | undefined {
  return BOOKABLE_FORMATS.find((f) => f.slug === slug);
}

/** Catégorie contenant un slug donné (réservable ou non). */
export function findCategoryOfSlug(slug: string): BookingCategoryId | undefined {
  return BOOKING_CATALOG.find((c) => c.formats.some((f) => f.slug === slug))?.id;
}
