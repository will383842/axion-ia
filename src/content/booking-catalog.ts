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
  type FormationDuree,
  type FormationGamme,
  formatAmount,
  getFormationBrackets,
  getFormationEntryPrice,
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
// Formations V2 (refonte 2026-06-11) — les 17 formations du catalogue,
// réservables sur /reserver. Prix dérivé de FORMATION_PRICE_MATRIX (gamme ×
// durée × effectif). Les 3 formations « 3 jours » sont « sur devis »
// (bookable:false → lien fiche) car le calendrier ne bloque que 1-2 jours.
// (gamme, durée) hardcodés = miroir de catalog-v2 (vérifié) ; on n'importe PAS
// catalog-v2 ici (budget bundle /reserver). Verrouillé par booking-catalog.test.
// ============================================================================

/** « À partir de <prix d'entrée matrice> » d'une (gamme, durée). */
function fromFormation(gamme: FormationGamme, duree: FormationDuree): { fr: string; en: string } {
  const p = getFormationEntryPrice(gamme, duree);
  if (typeof p !== "number") return surDevis;
  return {
    fr: `À partir de ${formatAmount(p, "fr", { compact: true })}`,
    en: `Starting at ${formatAmount(p, "en", { compact: true })}`,
  };
}

const FORMATION_DUREE_BOOKING: Record<
  FormationDuree,
  { hintFr: string; hintEn: string; days: 1 | 2; bookable: boolean }
> = {
  "4h": {
    hintFr: "Demi-journée · 4 h · sur site",
    hintEn: "Half-day · 4 h · on site",
    days: 1,
    bookable: true,
  },
  "1j": {
    hintFr: "Journée · 9 h – 17 h · sur site",
    hintEn: "Day · 9 a.m. – 5 p.m. · on site",
    days: 1,
    bookable: true,
  },
  "2j": {
    hintFr: "2 jours consécutifs · sur site",
    hintEn: "2 consecutive days · on site",
    days: 2,
    bookable: true,
  },
  // 3 jours = sur devis (calendrier limité à 1-2 j ; décision Will 2026-06-11).
  "3j": { hintFr: "3 jours · sur devis", hintEn: "3 days · on quote", days: 1, bookable: false },
};

interface FormationDef {
  slug: string;
  gamme: FormationGamme;
  duree: FormationDuree;
  labelFr: string;
  labelEn: string;
  iconKey: BookingIconKey;
  accent: BookingAccent;
  previewFr: string;
  previewEn: string;
}

const FORMATION_DEFS: ReadonlyArray<FormationDef> = [
  // 4 heures (ia-standard)
  {
    slug: "ia-express",
    gamme: "ia-standard",
    duree: "4h",
    labelFr: "IA Express · 4 h",
    labelEn: "AI Express · 4 h",
    iconKey: "rocket",
    accent: "terracotta",
    previewFr: "4 h pour que toute l'équipe travaille avec l'IA dès demain — sans prérequis.",
    previewEn: "4 h to get the whole team working with AI from day one — no prerequisites.",
  },
  {
    slug: "art-du-prompt",
    gamme: "ia-standard",
    duree: "4h",
    labelFr: "L'Art du Prompt (N2) · 4 h",
    labelEn: "Prompt Mastery (L2) · 4 h",
    iconKey: "sparkles",
    accent: "terracotta",
    previewFr:
      "Niveau 2 : la compétence qui change tout — demandes efficaces, itération, gabarits.",
    previewEn:
      "Level 2: the skill that changes everything — effective prompts, iteration, templates.",
  },
  {
    slug: "ia-securite",
    gamme: "ia-standard",
    duree: "4h",
    labelFr: "IA & Sécurité · 4 h",
    labelEn: "AI & Security · 4 h",
    iconKey: "shield",
    accent: "terracotta",
    previewFr: "4 h pour utiliser l'IA sans fuite de données — réflexes et ligne rouge.",
    previewEn: "4 h to use AI without data leaks — reflexes and red lines.",
  },
  {
    slug: "ia-conformite",
    gamme: "ia-standard",
    duree: "4h",
    labelFr: "IA & Conformité · 4 h",
    labelEn: "AI & Compliance · 4 h",
    iconKey: "shield",
    accent: "terracotta",
    previewFr: "AI Act + RGPD : obligations employeur et usage conforme, en 4 h.",
    previewEn: "AI Act + GDPR: employer obligations and compliant use, in 4 h.",
  },
  // 1 jour (ia-standard + claude)
  {
    slug: "ia-fondamentaux",
    gamme: "ia-standard",
    duree: "1j",
    labelFr: "IA Fondamentaux · 1 j",
    labelEn: "AI Fundamentals · 1 d",
    iconKey: "graduation",
    accent: "terracotta",
    previewFr: "Journée socle : chacun repart avec un livrable terminé sur ses propres outils.",
    previewEn: "Foundation day: everyone leaves with a finished deliverable on their own tools.",
  },
  {
    slug: "ia-commercial",
    gamme: "ia-standard",
    duree: "1j",
    labelFr: "IA Commercial · 1 j",
    labelEn: "AI for Sales · 1 d",
    iconKey: "star",
    accent: "terracotta",
    previewFr: "Prospection, propositions, relances : le cycle commercial accéléré à l'IA.",
    previewEn: "Prospecting, proposals, follow-ups: the sales cycle accelerated with AI.",
  },
  {
    slug: "ia-au-bureau",
    gamme: "ia-standard",
    duree: "1j",
    labelFr: "IA au Bureau · 1 j",
    labelEn: "AI at the Office · 1 d",
    iconKey: "users",
    accent: "terracotta",
    previewFr: "Mails, comptes-rendus, documents et tableurs : le quotidien bureau à l'IA.",
    previewEn: "Emails, minutes, documents and spreadsheets: office daily work with AI.",
  },
  {
    slug: "ia-sur-le-terrain",
    gamme: "ia-standard",
    duree: "1j",
    labelFr: "IA sur le Terrain · 1 j",
    labelEn: "AI in the Field · 1 d",
    iconKey: "compass",
    accent: "terracotta",
    previewFr:
      "Usages mobiles : dictée, photos, rapports sur site — l'IA pour les équipes terrain.",
    previewEn: "Mobile uses: dictation, photos, on-site reports — AI for field teams.",
  },
  {
    slug: "automatisations-decouverte",
    gamme: "ia-standard",
    duree: "1j",
    labelFr: "Automatisations Découverte · 1 j",
    labelEn: "Automations Discovery · 1 d",
    iconKey: "layers",
    accent: "terracotta",
    previewFr: "Créer ses premières automatisations métier — sans savoir coder.",
    previewEn: "Build your first business automations — without knowing how to code.",
  },
  {
    slug: "claude-decouverte",
    gamme: "claude",
    duree: "1j",
    labelFr: "Claude Découverte · 1 j",
    labelEn: "Claude Discovery · 1 d",
    iconKey: "sparkles",
    accent: "claude",
    previewFr: "Journée 100 % Claude : Chat, Projects, premiers usages métier.",
    previewEn: "Full Claude day: Chat, Projects, first business uses.",
  },
  // 2 jours (ia-standard + agents + claude)
  {
    slug: "ia-integration-metier",
    gamme: "ia-standard",
    duree: "2j",
    labelFr: "IA Intégration Métier · 2 j",
    labelEn: "AI Business Integration · 2 d",
    iconKey: "layers",
    accent: "terracotta",
    previewFr: "2 jours pour intégrer l'IA dans vos process métier réels.",
    previewEn: "2 days to embed AI into your real business processes.",
  },
  {
    slug: "ia-commercial-avance",
    gamme: "ia-standard",
    duree: "2j",
    labelFr: "IA Commercial Avancé · 2 j",
    labelEn: "Advanced AI for Sales · 2 d",
    iconKey: "star",
    accent: "terracotta",
    previewFr: "Séquences, CRM, scoring assistés par l'IA — niveau avancé.",
    previewEn: "AI-assisted sequences, CRM, scoring — advanced level.",
  },
  {
    slug: "agents-automatisations",
    gamme: "agents-automatisations",
    duree: "2j",
    labelFr: "Agents & Automatisations · 2 j",
    labelEn: "Agents & Automations · 2 d",
    iconKey: "layers",
    accent: "sage",
    previewFr: "Vos équipes construisent leurs automatisations — le code source vous appartient.",
    previewEn: "Your teams build their automations — the source code is yours.",
  },
  {
    slug: "claude-createur",
    gamme: "claude",
    duree: "2j",
    labelFr: "Claude Créateur · 2 j",
    labelEn: "Claude Creator · 2 d",
    iconKey: "sparkles",
    accent: "claude",
    previewFr: "2 jours : chacun repart avec son propre outil Claude construit.",
    previewEn: "2 days: everyone leaves with their own Claude tool built.",
  },
  // 3 jours = sur devis (bookable:false)
  {
    slug: "ia-transformation-equipe",
    gamme: "ia-standard",
    duree: "3j",
    labelFr: "IA Transformation Équipe · 3 j",
    labelEn: "AI Team Transformation · 3 d",
    iconKey: "users",
    accent: "terracotta",
    previewFr: "Transformation d'équipe : référents formés, processus complets, autonomie.",
    previewEn: "Team transformation: trained champions, full processes, autonomy.",
  },
  {
    slug: "agents-automatisations-avance",
    gamme: "agents-automatisations",
    duree: "3j",
    labelFr: "Agents & Automatisations Avancé · 3 j",
    labelEn: "Advanced Agents & Automations · 3 d",
    iconKey: "layers",
    accent: "sage",
    previewFr: "Automatisations avancées, processus complets en code source qui vous appartient.",
    previewEn: "Advanced automations, full processes in source code you own.",
  },
  {
    slug: "claude-architecte",
    gamme: "claude",
    duree: "3j",
    labelFr: "Claude Architecte · 3 j",
    labelEn: "Claude Architect · 3 d",
    iconKey: "crown",
    accent: "claude",
    previewFr: "Niveau architecte Claude — déploiement à l'échelle de l'entreprise.",
    previewEn: "Claude architect level — enterprise-scale deployment.",
  },
];

/**
 * Durée (`4h`/`1j`/`2j`/`3j`) par slug de formation — dérivée de FORMATION_DEFS (SSOT).
 * Sert à grouper les formations par durée (ex. console admin « Documents interventions »).
 * Les slugs hors famille formation n'y figurent pas → lookup `undefined`.
 */
export const FORMATION_DUREE_BY_SLUG: Readonly<Record<string, FormationDuree>> =
  Object.fromEntries(FORMATION_DEFS.map((f) => [f.slug, f.duree]));

/** Ré-export du type durée pour les consommateurs (ex. intervention-documents-catalog). */
export type { FormationDuree };

const FORMATION_BOOKING_FORMATS: ReadonlyArray<BookingFormat> = FORMATION_DEFS.map((f) => {
  const d = FORMATION_DUREE_BOOKING[f.duree];
  const price = d.bookable ? fromFormation(f.gamme, f.duree) : surDevis;
  const tiered = getFormationBrackets(f.gamme, f.duree).length > 1;
  return {
    slug: f.slug,
    labelFr: f.labelFr,
    labelEn: f.labelEn,
    bookable: d.bookable,
    durationDays: d.days,
    iconKey: f.iconKey,
    accent: f.accent,
    priceFr: price.fr,
    priceEn: price.en,
    scheduleHintFr: d.hintFr,
    scheduleHintEn: d.hintEn,
    previewFr: f.previewFr,
    previewEn: f.previewEn,
    ...(d.bookable
      ? tiered
        ? { tiered: true }
        : {}
      : { hrefFr: `/formations/${f.slug}`, hrefEn: `/formations/${f.slug}` }),
  };
});

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
    // Refonte 2026-06-11 — les 17 formations du catalogue V2 (FORMATION_DEFS).
    // 14 réservables (4h/1j/2j) ; 3 formations « 3 jours » sur devis (lien fiche).
    // Les anciens formats collectifs (essentielle, approfondie, gagner-du-temps,
    // intervention-claude, demarrage-ia-express, conference) restent en legacy
    // dans INTERVENTION_SLUGS/enum (bookings passés) mais ne sont plus proposés.
    formats: FORMATION_BOOKING_FORMATS,
  },

  // --------------------------------------------------------------------------
  // 1-TO-1 — dirigeant ET collaborateur. Tous « sur devis » → lien page
  // détail (aucune réservation directe au calendrier pour le 1-to-1).
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
