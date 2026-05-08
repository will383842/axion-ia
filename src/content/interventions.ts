// Content pack — Module 1 Interventions entreprise (6 pages).
// Source de vérité copy: docs 03 + 21 + 16.
// Sprint 5 ships placeholders; finer copy iteration belongs to Sprint 9 polish.
// 2026-05-07 : extension `summary` pour la refonte du listing /interventions
// (post-ADR 0003 lift formation ban) — la page met chaque format en valeur
// dans un gros bloc dédié orienté conversion B2B.

import type { Locale } from "@/i18n/routing";
import { INTERVENTION_TIERS } from "./pricing";

// Sprint 14.10.3 — prix dérivés de `src/content/pricing.ts` (source unique).
// Les 3 sous-tiers Intimiste/Standard/Complète restent ici (sous-format
// d'Essentielle, hors scope pricing.ts V1 — à migrer Sprint 20+ admin).
// `!` non-null : `intervention-essentielle` est garanti dans INTERVENTION_TIERS
// (defense in depth — si supprimé, le typecheck d'autres callers cassera avant).
const ESSENTIELLE_BASE_PRICE_EUR = INTERVENTION_TIERS.find(
  (t) => t.id === "intervention-essentielle",
)!.priceFlat!;

export type InterventionSlug = "essentielle" | "conference" | "dirigeants";

/** Accent visuel par intervention — conserve la palette Editorial v3. */
export type InterventionAccent = "terracotta" | "primary" | "sage" | "mocha";

/** Bloc résumé orienté conversion utilisé par la page listing /interventions. */
export interface InterventionSummary {
  /** Bénéfice tagline 1 ligne — promesse principale, conversion-friendly. */
  benefitTagline: string;
  /** Durée affichée (ex "1 jour", "2 jours", "½ journée"). */
  duration: string;
  /** Durée numérique pour bloquer N jours consécutifs sur le calendrier
      de réservation. ½ journée = 1 (un seul jour bloqué). */
  durationDays: 1 | 2;
  /** Prix résumé (ligne unique pour le KPI). Toujours rempli — pour les
      formats à plusieurs tranches, c'est l'entrée de gamme. */
  price: string;
  /** Tranches de prix par effectif — affichées si > 1. Format Essentielle :
      3 lignes (2-4 / 5-6 / 7-8). Si absent : prix unique = `price`. */
  priceTiers?: ReadonlyArray<{ size: string; price: string }>;
  /** Taille de groupe (ex "jusqu'à 10 personnes", "dès 2 personnes"). */
  groupSize: string;
  /** Format pratique (ex "Sur site · France & international"). */
  format: string;
  /** Audience visée — qui se reconnaîtra. */
  audience: string;
  /** 3 compétences acquises après — phrasées « Vos équipes sauront… ». */
  outcomes: ReadonlyArray<string>;
  /** Déroulement — 3 phases courtes pour le bloc listing. */
  outline: ReadonlyArray<string>;
  /** Texte du CTA dédié. */
  ctaLabel: string;
}

interface InterventionContent {
  slug: InterventionSlug;
  pathFr: string;
  pathEn: string;
  accent: InterventionAccent;
  summary: { fr: InterventionSummary; en: InterventionSummary };
  fr: PageCopy;
  en: PageCopy;
}

interface PageCopy {
  eyebrow: string;
  title: string;
  /** Portion italique terracotta du titre (signature v3 — alignée avec Section). */
  titleEm?: string;
  /** Suite du titre après titleEm (texte standard). */
  titleTail?: string;
  /** AEO answer block, 40-80 words. */
  answer: string;
  priceEur?: number;
  ctaPrimary: string;
  ctaSecondary: string;
  benefitsTitle: string;
  benefits: ReadonlyArray<{ title: string; description: string }>;
  processTitle: string;
  processSteps: ReadonlyArray<{ title: string; description: string }>;
  metricsTitle: string;
  metrics: ReadonlyArray<{ number: string; suffix: string; label: string }>;
  faqTitle: string;
  faqs: ReadonlyArray<{ id: string; question: string; answer: string }>;
  ctaBlockTitle: string;
  ctaBlockDescription: string;
  /** Optional anti-fear "Pour qui ça marche" — 3 maturity levels (D7 parity v3). */
  maturity?: {
    title: string;
    eyebrow: string;
    intro?: string;
    levels: ReadonlyArray<{ rank: 1 | 2 | 3; name: string; description: string }>;
  };
  metaSeo: { title: string; description: string };
  /** Timeline détaillée d'une journée d'intervention/formation (optionnel,
      réservé au Module 1 Interventions). 1 ou 2 jours selon le format. */
  daySchedule?: DaySchedule;
}

export interface DayScheduleItem {
  /** "9 h 00", "10 h 30", "Pause", etc. */
  time: string;
  title: string;
  description?: string;
}

export interface DaySchedule {
  /** Titre de la section (ex "Déroulement de la journée"). */
  title: string;
  /** Intro courte (ex "Programme type adapté en début de journée selon le tour de table."). */
  intro?: string;
  /** Une entrée par jour. Pour les formats 1 jour, un seul élément. */
  days: ReadonlyArray<{
    /** Étiquette du jour (ex "Jour 1", "Jour 2", "½ journée"). Optionnel
        si un seul jour est rendu (auto-masqué). */
    label?: string;
    items: ReadonlyArray<DayScheduleItem>;
  }>;
  /** Note logistique en bas — déplacement/logement, etc. */
  logisticsNote?: string;
}

// ============================================================================
// Source unique pour les 3 tranches Essentielle — utilisée par
// `/interventions/essentielle/page.tsx` (cards CTAs) ET `BookingCalendar`
// (sélecteur tier dans step 1). PAS de duplication.
// ============================================================================

export type EssentielleTier = "intimiste" | "standard" | "complete";

export interface EssentielleTierDef {
  id: EssentielleTier;
  /** Libellé court (ex "Intimiste"). */
  labelFr: string;
  labelEn: string;
  /** Effectif (ex "2 à 4 personnes"). */
  sizeFr: string;
  sizeEn: string;
  /** Prix HT en euros. */
  priceEur: number;
  /** Mis en avant dans l'UI ("★ Recommandé"). */
  isFeatured?: boolean;
}

export const ESSENTIELLE_TIERS: ReadonlyArray<EssentielleTierDef> = [
  {
    id: "intimiste",
    labelFr: "Intimiste",
    labelEn: "Intimate",
    sizeFr: "2 à 4 personnes",
    sizeEn: "2 to 4 people",
    priceEur: 490,
  },
  {
    id: "standard",
    labelFr: "Standard",
    labelEn: "Standard",
    sizeFr: "5 à 6 personnes",
    sizeEn: "5 to 6 people",
    priceEur: 790,
    isFeatured: true,
  },
  {
    id: "complete",
    labelFr: "Complète",
    labelEn: "Complete",
    sizeFr: "7 à 8 personnes",
    sizeEn: "7 to 8 people",
    priceEur: 1190,
  },
];

// ============================================================================
// Tunnel de réservation — UNIVERSEL pour les 5 formats. Identique partout :
// 1) je réserve 2) call de cadrage 3) acompte 50% 4) journée 5) solde + frais.
// ============================================================================

export const RESERVATION_STEPS_FR: ReadonlyArray<{ title: string; description: string }> = [
  {
    title: "Je réserve sur le calendrier",
    description:
      "Choix d'un créneau disponible en temps réel sur le calendrier maison. Confirmation immédiate.",
  },
  {
    title: "Call de cadrage",
    description:
      "Un appel court (15 à 30 min) pour valider le format choisi, l'effectif et les modalités pratiques.",
  },
  {
    title: "Paiement 50 %",
    description:
      "Acompte de 50 % du prix de la formation — virement bancaire ou carte. Facture immédiate.",
  },
  {
    title: "Déroulement de la formation",
    description:
      "Journée d'intervention sur site, programme type publié sur cette page. Rien de sur-mesure : ressources pédagogiques standardisées.",
  },
  {
    title: "Solde + frais annexes",
    description:
      "Solde 50 % après l'intervention, accompagné des frais de déplacement, hébergement et repas — facturés au forfait journalier (pas de justificatifs à transmettre).",
  },
];

export const RESERVATION_STEPS_EN: ReadonlyArray<{ title: string; description: string }> = [
  {
    title: "I book on the calendar",
    description: "Pick an available slot on our live booking calendar. Instant confirmation.",
  },
  {
    title: "Framing call",
    description:
      "A short call (15 to 30 min) to confirm the chosen format, headcount and practicalities.",
  },
  {
    title: "50 % payment",
    description:
      "50 % deposit on the training fee — bank transfer or card. Invoice issued immediately.",
  },
  {
    title: "Session day",
    description:
      "On-site session, standard programme published on this page. Nothing bespoke: standardised learning takeaways.",
  },
  {
    title: "Balance + travel fees",
    description:
      "Remaining 50 % after the session, plus travel, lodging and meals — billed at a flat daily rate (no receipts to forward).",
  },
];

const LEARNING_TITLE_FR = "Ce que vos équipes apprendront";
const LEARNING_TITLE_EN = "What your team will learn";
const RESERVATION_TITLE_FR = "Comment fonctionne une réservation";
const RESERVATION_TITLE_EN = "How a booking works";

// ============================================================================
// Programmes types par format — STANDARDISÉS, identiques pour toutes les
// entreprises. Pas de personnalisation = pas de document à produire entre
// chaque mission. Will, 2026-05-07.
// ============================================================================

const LOGISTICS_NOTE_FR =
  "Frais de déplacement (transport, hébergement, repas hors séance) pris en charge par le client, facturés au forfait journalier après l'intervention — pas de justificatifs à transmettre. Disponibilités confirmées sous 48 h ouvrées.";

const LOGISTICS_NOTE_EN =
  "Travel costs (transport, lodging, meals outside the session) covered by the client, billed at a flat daily rate after the session — no receipts to forward. Availability confirmed within 48 business hours.";

export const CONFERENCE_SCHEDULE_FR: DaySchedule = {
  title: "Déroulement de la conférence",
  intro:
    "Programme type d'une ½ journée conférence (3 h). Format collectif standardisé pour mettre tous vos collaborateurs au même niveau, indépendamment de leur métier.",
  days: [
    {
      items: [
        { time: "14 h 00", title: "Accueil + cadrage des thèmes" },
        {
          time: "14 h 15",
          title: "Conférence — panorama IA opérationnelle 2026",
          description: "1 h 30 · outils principaux + démos live + idées d'usages par secteur.",
        },
        { time: "15 h 45", title: "Pause" },
        {
          time: "16 h 00",
          title: "Q&A ouverte",
          description: "1 h pour confronter l'IA aux réalités terrain de vos équipes.",
        },
        {
          time: "17 h 00",
          title: "Ressources pédagogiques fournies + clôture",
        },
      ],
    },
  ],
  logisticsNote: LOGISTICS_NOTE_FR,
};

export const CONFERENCE_SCHEDULE_EN: DaySchedule = {
  title: "Conference breakdown",
  intro:
    "Standard programme for the half-day talk (3 h). Standardised collective format to bring everyone in your company to the same level, regardless of their role.",
  days: [
    {
      items: [
        { time: "14:00", title: "Welcome + theme framing" },
        {
          time: "14:15",
          title: "Talk — 2026 operational AI panorama",
          description: "1 h 30 · main tools + live demos + use-case ideas by sector.",
        },
        { time: "15:45", title: "Break" },
        {
          time: "16:00",
          title: "Open Q&A",
          description: "1 hour to confront AI with your teams' field realities.",
        },
        {
          time: "17:00",
          title: "Learning takeaways shared + close",
        },
      ],
    },
  ],
  logisticsNote: LOGISTICS_NOTE_EN,
};

export const DIRIGEANTS_SCHEDULE_FR: DaySchedule = {
  title: "Déroulement de la journée",
  intro:
    "Programme type d'une journée Dirigeants (9 h – 17 h). Identique pour toutes les entreprises : panorama, ateliers de positionnement, référentiel d'arbitrage IA pour vos décisions futures.",
  days: [
    {
      items: [
        { time: "9 h 00", title: "Accueil + tour de table CODIR" },
        {
          time: "9 h 30",
          title: "Panorama IA 2026 — opportunités, risques, marché",
          description: "État de l'art, où en sont les concurrents, ce qui marche vraiment.",
        },
        { time: "11 h 00", title: "Pause café" },
        {
          time: "11 h 15",
          title: "Atelier 1 — Positionnement de votre entreprise",
          description: "Échelle de maturité IA 2026 appliquée à votre contexte.",
        },
        { time: "12 h 00", title: "Déjeuner CODIR (12 h – 14 h)" },
        {
          time: "14 h 00",
          title: "Atelier 2 — Cas d'usage prioritaires par fonction",
          description: "Quels usages testent les ETI/grandes entreprises de votre secteur.",
        },
        { time: "15 h 30", title: "Pause" },
        {
          time: "15 h 45",
          title: "Atelier 3 — Référentiel d'arbitrage des décisions IA",
          description: "Grille de lecture pour évaluer vos prochains choix IA en interne.",
        },
        {
          time: "17 h 00",
          title: "Synthèse + ressources pédagogiques + clôture",
          description: "Référentiel CODIR, cas d'usage, lectures recommandées.",
        },
      ],
    },
  ],
  logisticsNote: LOGISTICS_NOTE_FR,
};

export const DIRIGEANTS_SCHEDULE_EN: DaySchedule = {
  title: "Day-by-day breakdown",
  intro:
    "Standard programme for the Executives day (9 a.m. – 5 p.m.). Identical for every company: panorama, positioning workshops, AI decision framework for your future calls.",
  days: [
    {
      items: [
        { time: "9:00", title: "Welcome + leadership round table" },
        {
          time: "9:30",
          title: "2026 AI panorama — opportunities, risks, market",
          description: "State of the art, where competitors stand, what really works.",
        },
        { time: "11:00", title: "Coffee break" },
        {
          time: "11:15",
          title: "Workshop 1 — Position your company",
          description: "2026 AI maturity scale applied to your context.",
        },
        { time: "12:00", title: "Leadership lunch (12:00 – 14:00)" },
        {
          time: "14:00",
          title: "Workshop 2 — Priority use cases by function",
          description: "What mid-market and enterprise peers in your sector are testing.",
        },
        { time: "15:30", title: "Break" },
        {
          time: "15:45",
          title: "Workshop 3 — AI decision framework",
          description: "Reading grid to assess your next internal AI choices.",
        },
        {
          time: "17:00",
          title: "Synthesis + takeaways + close",
          description: "Leadership reference sheet, use cases, recommended reading.",
        },
      ],
    },
  ],
  logisticsNote: LOGISTICS_NOTE_EN,
};

export const INTERVENTIONS: ReadonlyArray<InterventionContent> = [
  {
    slug: "essentielle",
    pathFr: "/interventions/essentielle",
    pathEn: "/interventions/essential",
    accent: "terracotta",
    summary: {
      fr: {
        benefitTagline:
          "Découvrir l'IA appliquée au quotidien — outils, usages concrets, idées d'automatisations pour gagner du temps dès le lendemain. Une journée de formation, pas de plan sur-mesure, des ressources prêtes à utiliser.",
        duration: "1 journée sur site (9 h – 17 h)",
        durationDays: 1,
        price: "à partir de 490 € HT",
        priceTiers: [
          { size: "2 à 8 personnes", price: "490 € HT" },
          { size: "9 à 15 personnes", price: "Sur devis" },
          { size: "16 à 30 personnes", price: "Sur devis" },
          { size: "30 personnes et +", price: "Sur devis" },
        ],
        groupSize: "2 à 30 personnes et +",
        format: "Sur site · France & international",
        audience: "TPE / PME / Grandes entreprises · sans pré-requis IA",
        outcomes: [
          "Vos équipes connaissent les principaux outils IA (ChatGPT, Claude, Copilot…) et savent quand s'en servir",
          "Elles identifient 5 à 10 usages concrets sur leurs tâches : rédaction, recherche, synthèse, analyse",
          "Elles repartent avec des idées d'automatisations applicables immédiatement à leur métier",
        ],
        outline: [
          "Call de prise de contact (15 min visio) pour valider le format",
          "Jour J · découverte des outils + ateliers pratiques + démos",
          "Ressources pédagogiques fournies en fin de journée (référentiel + cas d'usage)",
        ],
        ctaLabel: "Découvrir l'Essentielle",
      },
      en: {
        benefitTagline:
          "Discover AI applied to your day-to-day — tools, concrete uses, automation ideas to save time from day two. A one-day training, no bespoke roadmap, ready-to-use takeaways.",
        duration: "1 day on site (9 a.m. – 5 p.m.)",
        durationDays: 1,
        price: "from €490 (excl. VAT)",
        priceTiers: [
          { size: "2 to 8 people", price: "€490 excl. VAT" },
          { size: "9 to 15 people", price: "On request" },
          { size: "16 to 30 people", price: "On request" },
          { size: "30+ people", price: "On request" },
        ],
        groupSize: "2 to 30+ people",
        format: "On site · France & international",
        audience: "Small / mid-market / enterprise · no AI prerequisites",
        outcomes: [
          "Your team knows the main AI tools (ChatGPT, Claude, Copilot…) and when to use them",
          "They identify 5 to 10 concrete uses on their tasks: writing, research, synthesis, analysis",
          "They leave with automation ideas they can apply to their domain right away",
        ],
        outline: [
          "Intro call (15-min video) to confirm the format",
          "Day · tool discovery + hands-on workshops + live demos",
          "Learning takeaways shared at end of day (reference sheet + use cases)",
        ],
        ctaLabel: "Discover the Essential",
      },
    },
    fr: {
      eyebrow: "Offre phare · Module 1 · 1 jour sur site",
      title: "L'intervention IA",
      titleEm: "Essentielle",
      answer:
        "Une journée de formation IA sur site avec votre équipe (2 à 8 personnes) : découverte des outils principaux, ateliers pratiques sur leurs vraies tâches, idées d'automatisations applicables. Vos équipes repartent avec une boîte à outils standardisée et 5 à 10 usages concrets identifiés. Tous secteurs, tous niveaux.",
      priceEur: ESSENTIELLE_BASE_PRICE_EUR,
      ctaPrimary: "Réserver une intervention",
      ctaSecondary: "Voir les cas concrets",
      benefitsTitle: LEARNING_TITLE_FR,
      benefits: [
        {
          title: "Maîtrise des outils IA principaux",
          description:
            "ChatGPT, Claude, Copilot, Gemini : à quoi ils servent vraiment, quand les choisir, comment les utiliser au quotidien.",
        },
        {
          title: "5 à 10 usages concrets identifiés",
          description:
            "Rédaction, recherche, synthèse, analyse — appliqués aux tâches réelles de chaque participant.",
        },
        {
          title: "Idées d'automatisations applicables",
          description:
            "Repérer où l'IA peut faire gagner du temps dès le lendemain, sans code et sans projet lourd.",
        },
        {
          title: "Gain de temps immédiat & productivité",
          description:
            "Vos équipes ressortent avec des outils opérationnels qui font économiser plusieurs heures par semaine — productivité mesurable dès le retour au bureau, sans phase de transition.",
        },
      ],
      processTitle: RESERVATION_TITLE_FR,
      processSteps: RESERVATION_STEPS_FR,
      metricsTitle: "Résultats observés",
      metrics: [
        { number: "+38", suffix: "%", label: "Productivité moyenne après formation" },
        { number: "2.4", suffix: "h/jour", label: "Temps gagné par collaborateur" },
        { number: "4.9", suffix: "/5", label: "Satisfaction participants" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "duration",
          question: "Quelle est la durée de l'intervention ?",
          answer:
            "Une journée complète sur site (9 h - 17 h), précédée d'un call de cadrage de 15 min en visio.",
        },
        {
          id: "audience",
          question: "Pour qui ?",
          answer:
            "Tous secteurs, tous niveaux. L'Essentielle est conçue pour démarrer vite, sans pré-requis IA.",
        },
        {
          id: "team-size",
          question: "Combien de participants ?",
          answer:
            "Jusqu'à 10 collaborateurs. Au-delà, voir l'intervention « Vos équipes gagnent 1h/jour ».",
        },
        {
          id: "deliverables",
          question: "Que reste-t-il après ?",
          answer:
            "Une boîte à outils standardisée : référentiel d'outils IA, prompts types, cas d'usage par métier — fournis en fin de journée et utilisables immédiatement.",
        },
      ],
      ctaBlockTitle: "Prête à démarrer concrètement avec l'IA ?",
      ctaBlockDescription:
        "Réservez la prochaine intervention disponible. Le calendrier maison affiche les créneaux en temps réel.",
      metaSeo: {
        title: "Intervention IA Essentielle · cabinet AxionIA · 490 € HT",
        description:
          "Une journée de formation IA sur site (2-8 personnes) : découverte des outils, ateliers pratiques, idées d'automatisations. Boîte à outils standardisée fournie. Tous secteurs, tous niveaux, dès 490 € HT.",
      },
      daySchedule: {
        title: "Déroulement de la journée",
        intro:
          "Programme type d'une journée Essentielle (9 h – 17 h). Identique pour toutes les entreprises : pas de document sur-mesure, des ressources pédagogiques standardisées remises en fin de journée.",
        days: [
          {
            items: [
              { time: "9 h 00", title: "Accueil + tour de table + objectifs" },
              {
                time: "9 h 30",
                title: "Découverte des outils IA principaux",
                description:
                  "ChatGPT, Claude, Copilot, Gemini : à quoi ils servent vraiment et quand les choisir.",
              },
              { time: "10 h 30", title: "Pause café" },
              {
                time: "10 h 45",
                title: "Atelier 1 — Rédaction & communication assistées",
                description: "Mails, comptes-rendus, supports : prompts efficaces, garde-fous.",
              },
              { time: "12 h 00", title: "Pause déjeuner (12 h – 14 h)" },
              {
                time: "14 h 00",
                title: "Atelier 2 — Recherche, analyse & synthèse",
                description: "Veille, extraction, traitement de documents et de données.",
              },
              { time: "15 h 00", title: "Pause café" },
              {
                time: "15 h 15",
                title: "Atelier 3 — Idées d'automatisations sur leurs outils",
                description:
                  "Repérer les tâches répétitives et imaginer comment l'IA peut faire gagner du temps.",
              },
              {
                time: "16 h 30",
                title: "Récap des usages + ressources fournies",
                description: "Référentiel des outils, prompts types, cas d'usage par métier.",
              },
              { time: "17 h 00", title: "Q&A ouverte + clôture" },
            ],
          },
        ],
        logisticsNote: LOGISTICS_NOTE_FR,
      },
    },
    en: {
      eyebrow: "Flagship offering · Module 1 · 1 day on site",
      title: "The",
      titleEm: "Essential",
      titleTail: " AI session",
      answer:
        "A one-day on-site AI training with your team (2 to 8 people): discovery of the main tools, hands-on workshops on their real tasks, ready-to-apply automation ideas. Your team leaves with a standardised toolbox and 5 to 10 concrete uses identified. All industries, all levels.",
      priceEur: ESSENTIELLE_BASE_PRICE_EUR,
      ctaPrimary: "Book a session",
      ctaSecondary: "See case studies",
      benefitsTitle: LEARNING_TITLE_EN,
      benefits: [
        {
          title: "Mastery of the main AI tools",
          description:
            "ChatGPT, Claude, Copilot, Gemini: what they really do, when to pick each, and how to use them day to day.",
        },
        {
          title: "5 to 10 concrete uses identified",
          description:
            "Writing, research, synthesis, analysis — applied to each participant's real tasks.",
        },
        {
          title: "Ready-to-apply automation ideas",
          description: "Spot where AI can save time the very next day, no code, no heavy project.",
        },
        {
          title: "Immediate time savings & productivity",
          description:
            "Your team leaves with operational tools that save several hours per week — measurable productivity from day one back at the office, with no transition phase.",
        },
      ],
      processTitle: RESERVATION_TITLE_EN,
      processSteps: RESERVATION_STEPS_EN,
      metricsTitle: "Observed results",
      metrics: [
        { number: "+38", suffix: "%", label: "Average productivity after training" },
        { number: "2.4", suffix: "h/day", label: "Time saved per employee" },
        { number: "4.9", suffix: "/5", label: "Participant satisfaction" },
      ],
      faqTitle: "Frequently asked",
      faqs: [
        {
          id: "duration",
          question: "How long is the session?",
          answer: "A full day on site (9 a.m. - 5 p.m.), preceded by a 15-min framing call.",
        },
        {
          id: "audience",
          question: "Who is it for?",
          answer:
            "All industries, all levels. The Essential is designed to start fast without prior AI exposure.",
        },
        {
          id: "team-size",
          question: "How many participants?",
          answer: "Up to 10 team members. Beyond, see 'Your teams save 1h a day'.",
        },
        {
          id: "deliverables",
          question: "What remains afterwards?",
          answer:
            "A standardised toolbox: AI tool reference, prompt templates, use cases by role — handed over at end of day and usable immediately.",
        },
      ],
      ctaBlockTitle: "Ready to start concretely with AI?",
      ctaBlockDescription:
        "Book the next available session. The on-site calendar shows live availability.",
      metaSeo: {
        title: "Essential AI session · AxionIA consultancy · €490 (excl. VAT)",
        description:
          "A one-day on-site AI training (2 to 8 people): tool discovery, hands-on workshops, automation ideas. Standardised toolbox provided. All industries, all levels, from €490 (excl. VAT).",
      },
      daySchedule: {
        title: "Day-by-day breakdown",
        intro:
          "Standard programme for the Essential day (9 a.m. – 5 p.m.). Identical for every company: no bespoke document, standardised learning takeaways shared at end of day.",
        days: [
          {
            items: [
              { time: "9:00", title: "Welcome + round table + objectives" },
              {
                time: "9:30",
                title: "Discovery of the main AI tools",
                description:
                  "ChatGPT, Claude, Copilot, Gemini: what they really do and when to pick each.",
              },
              { time: "10:30", title: "Coffee break" },
              {
                time: "10:45",
                title: "Workshop 1 — AI-assisted writing & communication",
                description: "Emails, minutes, decks: effective prompts, guardrails.",
              },
              { time: "12:00", title: "Lunch break (12:00 – 14:00)" },
              {
                time: "14:00",
                title: "Workshop 2 — Research, analysis & synthesis",
                description: "Watch, extraction, document and data processing.",
              },
              { time: "15:00", title: "Coffee break" },
              {
                time: "15:15",
                title: "Workshop 3 — Automation ideas on their own tools",
                description: "Spotting repetitive tasks and imagining where AI saves time.",
              },
              {
                time: "16:30",
                title: "Use-case recap + takeaways shared",
                description: "Tool reference sheet, prompt templates, use cases by role.",
              },
              { time: "17:00", title: "Open Q&A + close" },
            ],
          },
        ],
        logisticsNote: LOGISTICS_NOTE_EN,
      },
    },
  },
  {
    slug: "conference",
    pathFr: "/interventions/conference",
    pathEn: "/interventions/conference",
    accent: "terracotta",
    summary: {
      fr: {
        benefitTagline:
          "Sensibiliser toute l'entreprise à l'IA en ½ journée — panorama 2026, démos live, idées d'usages, Q&A. Format collectif standardisé, le moyen le plus rapide de mettre tout le monde au même niveau.",
        duration: "½ journée (3 h)",
        durationDays: 1,
        price: "Sur devis · réponse sous 48 h",
        groupSize: "Format collectif · effectif libre",
        format: "Présentiel ou remote · France & international",
        audience: "Format collectif · TPE → grandes entreprises · tous niveaux",
        outcomes: [
          "Vos collaborateurs comprennent ce que l'IA peut vraiment faire en 2026",
          "Ils repartent avec une liste de 5 à 10 usages IA applicables dès le lendemain",
          "Ils osent expérimenter — la peur de l'IA cède à l'envie d'essayer",
        ],
        outline: [
          "Call de prise de contact (15 min visio) pour valider thèmes et démos",
          "Jour J · 1 h 30 conférence + démos live + 1 h Q&A ouverte",
          "Ressources pédagogiques fournies en fin de session (référentiel + cas d'usage)",
        ],
        ctaLabel: "Demander un devis conférence",
      },
      en: {
        benefitTagline:
          "Upskill your whole company to AI in half a day — 2026 panorama, live demos, use ideas, Q&A. Standardised collective format, the fastest way to bring everyone to the same level.",
        duration: "Half day (3 hours)",
        durationDays: 1,
        price: "On request · reply within 48 hours",
        groupSize: "Collective format · open headcount",
        format: "On site or remote · France & international",
        audience: "Collective format · small to enterprise · all levels",
        outcomes: [
          "Your people understand what AI can really do in 2026",
          "They leave with 5 to 10 ready-to-try uses for the next day",
          "They dare to experiment — fear gives way to curiosity",
        ],
        outline: [
          "Intro call (15-min video) to confirm themes and demos",
          "Day · 1 h 30 talk + live demos + open 1-hour Q&A",
          "Learning takeaways shared at end of session (reference sheet + use cases)",
        ],
        ctaLabel: "Request a talk quote",
      },
    },
    fr: {
      ...makeFr({
        eyebrow: "Format : ½ journée conférence",
        title: "Ce que l'IA peut faire",
        titleEm: "pour vous",
        answer:
          "Conférence d'1/2 journée tous niveaux : panorama clair des usages IA réellement opérationnels en 2026, démos live, sessions Q&A. Format collectif standardisé pour acculturer rapidement un grand groupe.",
        ctaPrimary: "Demander un devis conférence",
        faqIntro: "conférence",
      }),
      daySchedule: CONFERENCE_SCHEDULE_FR,
    },
    en: {
      ...makeEn({
        eyebrow: "Format: half-day talk",
        title: "What AI can do",
        titleEm: "for you",
        answer:
          "A half-day talk for all levels: clear panorama of AI uses actually operational in 2026, live demos, Q&A. Standardised collective format to quickly upskill a large group.",
        ctaPrimary: "Request a talk quote",
        faqIntro: "talk",
      }),
      daySchedule: CONFERENCE_SCHEDULE_EN,
    },
  },
  {
    slug: "dirigeants",
    pathFr: "/interventions/dirigeants",
    pathEn: "/interventions/executives",
    accent: "mocha",
    summary: {
      fr: {
        benefitTagline:
          "Comprendre l'IA en tant que dirigeant — opportunités, risques, état du marché 2026. Une journée pour situer son entreprise et éclairer ses choix. Formation standardisée, ressources fournies.",
        duration: "1 journée sur site",
        durationDays: 1,
        price: "Sur devis · réponse sous 48 h",
        groupSize: "CODIR · dès 2 dirigeants",
        format: "Sur site dirigeant · France & international",
        audience: "Dirigeants, CODIR, COMEX · TPE, PME, ETI, grandes entreprises",
        outcomes: [
          "Vous avez une vision claire de ce que l'IA permet vraiment en 2026",
          "Vous identifiez les usages IA prioritaires pour votre entreprise",
          "Vous repartez avec un référentiel d'arbitrage personnel pour vos décisions IA",
        ],
        outline: [
          "Call de prise de contact (30 min visio) pour valider le format",
          "Jour J · panorama IA 2026 + démos + ateliers de positionnement",
          "Ressources pédagogiques fournies en fin de journée (référentiel CODIR + cas d'usage)",
        ],
        ctaLabel: "Voir l'intervention CODIR",
      },
      en: {
        benefitTagline:
          "Understand AI as an executive — opportunities, risks, 2026 market landscape. One day to situate your company and inform your decisions. Standardised training, takeaways provided.",
        duration: "1 day on site",
        durationDays: 1,
        price: "On request · reply within 48 hours",
        groupSize: "Leadership team · from 2 executives",
        format: "On site · France & international",
        audience: "Executives, leadership, COMEX · small to enterprise",
        outcomes: [
          "You have a clear view of what AI really enables in 2026",
          "You identify the priority AI uses for your company",
          "You leave with a personal decision framework for your AI choices",
        ],
        outline: [
          "Intro call (30-min video) to confirm the format",
          "Day · 2026 AI panorama + demos + positioning workshops",
          "Learning takeaways shared at end of day (leadership reference + use cases)",
        ],
        ctaLabel: "See the leadership session",
      },
    },
    fr: {
      ...makeFr({
        eyebrow: "Cible : dirigeants & CODIR · 1 jour sur site",
        title: "L'IA",
        titleEm: "pour les dirigeants",
        answer:
          "Une journée pour dirigeants et comité de direction : panorama IA 2026, ateliers de positionnement, référentiel d'arbitrage des décisions IA. Formation standardisée, ressources pédagogiques fournies.",
        ctaPrimary: "Réserver l'intervention CODIR",
        faqIntro: "dirigeants",
      }),
      daySchedule: DIRIGEANTS_SCHEDULE_FR,
    },
    en: {
      ...makeEn({
        eyebrow: "Audience: executives & CODIR · 1 day on site",
        title: "AI",
        titleEm: "for executives",
        answer:
          "A day for executives and the leadership committee: 2026 AI panorama, positioning workshops, AI decision framework. Standardised training, learning takeaways provided.",
        ctaPrimary: "Book the executive session",
        faqIntro: "executives",
      }),
      daySchedule: DIRIGEANTS_SCHEDULE_EN,
    },
  },
];

export function getIntervention(slug: InterventionSlug): InterventionContent {
  const found = INTERVENTIONS.find((i) => i.slug === slug);
  if (!found) throw new Error(`Unknown intervention slug: ${slug}`);
  return found;
}

export function getInterventionCopy(slug: InterventionSlug, locale: Locale): PageCopy {
  return getIntervention(slug)[locale];
}

// Default copy templates for the 4 secondary interventions (essential page
// has its own bespoke copy above). Keeps the file readable; copy can be
// upgraded individually later without touching the rest of the site.
function makeFr(args: {
  eyebrow: string;
  title: string;
  titleEm?: string;
  titleTail?: string;
  answer: string;
  ctaPrimary: string;
  faqIntro: string;
}): PageCopy {
  return {
    eyebrow: args.eyebrow,
    title: args.title,
    ...(args.titleEm ? { titleEm: args.titleEm } : {}),
    ...(args.titleTail ? { titleTail: args.titleTail } : {}),
    answer: args.answer,
    ctaPrimary: args.ctaPrimary,
    ctaSecondary: "Voir l'Essentielle 490 €",
    benefitsTitle: LEARNING_TITLE_FR,
    benefits: [
      {
        title: "Maîtrise des outils IA pertinents",
        description:
          "Les bons outils selon les profils de votre équipe — usages prioritaires, garde-fous, qualité de sortie.",
      },
      {
        title: "Usages concrets identifiés",
        description:
          "Sur les vraies tâches récurrentes de votre équipe, applicables dès le lendemain.",
      },
      {
        title: "Boîte à outils standardisée",
        description:
          "Référentiel d'outils, prompts types, cas d'usage par métier — fournis en fin de journée.",
      },
      {
        title: "Gain de temps immédiat & productivité",
        description:
          "Plusieurs heures gagnées par semaine et par collaborateur dès le retour au bureau — productivité mesurable, sans phase de transition.",
      },
    ],
    processTitle: RESERVATION_TITLE_FR,
    processSteps: RESERVATION_STEPS_FR,
    metricsTitle: "Résultats observés",
    metrics: [
      { number: "+30", suffix: "%", label: "Productivité moyenne" },
      { number: "2", suffix: "h/jour", label: "Temps gagné" },
      { number: "90", suffix: "j", label: "Délai d'impact" },
    ],
    faqTitle: "Questions fréquentes",
    faqs: [
      {
        id: "fit",
        question: `Cette intervention est-elle adaptée à mes ${args.faqIntro} ?`,
        answer:
          "Oui — la formation est standardisée et conçue pour s'adresser à tous les profils. Aucun pré-requis IA. Un call de cadrage de 15 min avant la journée valide l'adéquation.",
      },
      {
        id: "support",
        question: "Que reste-t-il après la journée ?",
        answer:
          "Une boîte à outils standardisée : référentiel d'outils IA, prompts types, cas d'usage par métier — fournis en fin de journée et utilisables immédiatement.",
      },
      {
        id: "remote",
        question: "Possible à distance ?",
        answer:
          "Sur site recommandé pour les ateliers. Format remote possible sur demande (devis adapté).",
      },
    ],
    ctaBlockTitle: "Prête à démarrer ?",
    ctaBlockDescription: "Demandez un devis — réponse sous 48 h ouvrées.",
    maturity: {
      eyebrow: "Pour qui ça marche",
      title: "Trois niveaux de maturité IA des équipes",
      intro:
        "L'intervention s'adapte au point de départ de votre équipe. Aucun pré-requis technique — juste l'envie d'avancer ensemble.",
      levels: [
        {
          rank: 1,
          name: "Curieuse",
          description:
            "Première découverte de l'IA. Format pédagogique, vocabulaire de base, démos accessibles, pas de jargon. Tous les profils peuvent suivre.",
        },
        {
          rank: 2,
          name: "Utilisatrice",
          description:
            "Déjà ChatGPT ou Claude en individuel. On structure l'usage pour qu'il devienne collectif, productif et reproductible — référentiel, prompts types, cadre.",
        },
        {
          rank: 3,
          name: "Experte",
          description:
            "IA quotidienne. L'intervention pousse vers les agents, l'automatisation custom, les use cases avancés et la diffusion à toute l'organisation.",
        },
      ],
    },
    metaSeo: {
      title: `${args.title} · cabinet AxionIA`,
      description: args.answer.slice(0, 160),
    },
  };
}

function makeEn(args: {
  eyebrow: string;
  title: string;
  titleEm?: string;
  titleTail?: string;
  answer: string;
  ctaPrimary: string;
  faqIntro: string;
}): PageCopy {
  return {
    eyebrow: args.eyebrow,
    title: args.title,
    ...(args.titleEm ? { titleEm: args.titleEm } : {}),
    ...(args.titleTail ? { titleTail: args.titleTail } : {}),
    answer: args.answer,
    ctaPrimary: args.ctaPrimary,
    ctaSecondary: "See the Essential €490",
    benefitsTitle: LEARNING_TITLE_EN,
    benefits: [
      {
        title: "Mastery of relevant AI tools",
        description:
          "The right tools for your team's roles — priority uses, guardrails, output quality.",
      },
      {
        title: "Concrete uses identified",
        description: "On your team's real recurring tasks, applicable from the very next day.",
      },
      {
        title: "Standardised toolbox",
        description:
          "Tool reference sheet, prompt templates, use cases by role — delivered at end of day.",
      },
      {
        title: "Immediate time savings & productivity",
        description:
          "Several hours saved per week per employee from day one back at the office — measurable productivity, no transition phase.",
      },
    ],
    processTitle: RESERVATION_TITLE_EN,
    processSteps: RESERVATION_STEPS_EN,
    metricsTitle: "Observed results",
    metrics: [
      { number: "+30", suffix: "%", label: "Average productivity" },
      { number: "2", suffix: "h/day", label: "Time saved" },
      { number: "90", suffix: "d", label: "Time to impact" },
    ],
    faqTitle: "Frequently asked",
    faqs: [
      {
        id: "fit",
        question: `Is this session right for my ${args.faqIntro}?`,
        answer:
          "Yes — the training is standardised and designed for all profiles. No AI prerequisites. A 15-min framing call before the day confirms the fit.",
      },
      {
        id: "support",
        question: "What remains after the day?",
        answer:
          "A standardised toolbox: AI tool reference, prompt templates, use cases by role — handed over at end of day and usable immediately.",
      },
      {
        id: "remote",
        question: "Can it run remotely?",
        answer: "On-site recommended for workshops. Remote format on request (adjusted quote).",
      },
    ],
    ctaBlockTitle: "Ready to start?",
    ctaBlockDescription: "Request a quote — reply within 48 business hours.",
    maturity: {
      eyebrow: "Who it works for",
      title: "Three AI maturity levels in teams",
      intro:
        "The session adapts to your team's starting point. No technical prerequisite — just the will to move forward together.",
      levels: [
        {
          rank: 1,
          name: "Curious",
          description:
            "First contact with AI. Pedagogical format, base vocabulary, accessible demos, no jargon. Every profile can follow.",
        },
        {
          rank: 2,
          name: "User",
          description:
            "Already using ChatGPT or Claude individually. We structure the usage to make it collective, productive and reproducible — reference, prompt templates, framework.",
        },
        {
          rank: 3,
          name: "Expert",
          description:
            "AI is daily practice. The session pushes toward agents, custom automation, advanced use cases and rollout across the organisation.",
        },
      ],
    },
    metaSeo: {
      title: `${args.title} · AxionIA consultancy`,
      description: args.answer.slice(0, 160),
    },
  };
}
