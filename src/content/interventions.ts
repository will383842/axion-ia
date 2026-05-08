// Content pack — Module 1 Interventions entreprise (6 pages).
// Source de vérité copy: docs 03 + 21 + 16.
// Sprint 5 ships placeholders; finer copy iteration belongs to Sprint 9 polish.
// 2026-05-07 : extension `summary` pour la refonte du listing /interventions
// (post-ADR 0003 lift formation ban) — la page met chaque format en valeur
// dans un gros bloc dédié orienté conversion B2B.

import type { Locale } from "@/i18n/routing";
import {
  ESSENTIELLE_SUB_TIERS,
  INTERVENTION_TIERS,
  formatAmount,
  formatPrice,
  getTierById,
} from "./pricing";

// Sprint 14.10.3 / 14.10.5 — prix dérivés de `src/content/pricing.ts` (source unique).
// Aucun montant ne doit être hardcodé ici : tout pointe vers ESSENTIELLE_SUB_TIERS.
const ESSENTIELLE_TIER = getTierById(INTERVENTION_TIERS, "intervention-essentielle");
const ESSENTIELLE_BASE_PRICE_EUR = ESSENTIELLE_TIER.priceFlat!;
const DIRIGEANTS_TIER = getTierById(INTERVENTION_TIERS, "intervention-dirigeants");
const DIRIGEANTS_PRICE_FR = formatPrice(DIRIGEANTS_TIER, "fr");
const DIRIGEANTS_PRICE_EN = formatPrice(DIRIGEANTS_TIER, "en");

// Paliers d'effectif Essentielle pour le listing public — Sprint 14.10.5
// (Will 2026-05-08). Source unique = `pricing.ts::ESSENTIELLE_SUB_TIERS`
// (3 brackets fines : 2-4 / 5-6 / 7-8 personnes → 490 / 790 / 1190 € HT).
//
// Au-delà de 8 personnes : format Approfondie 2 jours (cf. APPROFONDIE_SUB_TIERS).
// Au-delà de 30 personnes : Conférence ou Sur demande particulière.
//
// La grille publique reprend exactement les ranges + prix des sous-tiers
// pricing.ts → 1 SSOT, pas de remapping de labels.
const ESSENTIELLE_PRICE_TIERS_FR: ReadonlyArray<{ size: string; price: string }> =
  ESSENTIELLE_SUB_TIERS.map((sub) => ({
    size: sub.rangeFr,
    price: formatAmount(sub.priceFlat, "fr"),
  }));

const ESSENTIELLE_PRICE_TIERS_EN: ReadonlyArray<{ size: string; price: string }> =
  ESSENTIELLE_SUB_TIERS.map((sub) => ({
    size: sub.rangeEn,
    price: formatAmount(sub.priceFlat, "en"),
  }));

export type InterventionSlug = "essentielle" | "conference" | "dirigeants";

/** Accent visuel par intervention — conserve la palette Editorial v3. */
export type InterventionAccent = "terracotta" | "primary" | "sage" | "mocha";

/** Bloc résumé orienté conversion utilisé par la page listing /interventions. */
export interface InterventionSummary {
  /** Bénéfice tagline 1 ligne — promesse principale, conversion-friendly. */
  benefitTagline: string;
  /** Durée affichée (ex "1 jour", "2 jours" — pas de demi-journée depuis Sprint 14.10.4). */
  duration: string;
  /** Durée numérique pour bloquer N jours consécutifs sur le calendrier
      de réservation. Minimum 1 (pas de demi-journée — Sprint 14.10.4). */
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
    /** Étiquette du jour (ex "Jour 1", "Jour 2"). Optionnel si un seul
        jour est rendu (auto-masqué). */
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

// Sprint 14.10.5 — dérivé de `pricing.ts::ESSENTIELLE_SUB_TIERS` pour zéro
// duplication. La shape `EssentielleTierDef` reste exposée pour compat avec
// les consommateurs (BookingCalendar + page essentielle).
//
// Mapping id : `pricing.ts` utilise `essentielle-intimiste` / `-standard` /
// `-complete` → strip du préfixe « essentielle- » pour matcher le type local.
export const ESSENTIELLE_TIERS: ReadonlyArray<EssentielleTierDef> = ESSENTIELLE_SUB_TIERS.map(
  (sub) => ({
    id: sub.id.replace(/^essentielle-/, "") as EssentielleTier,
    labelFr: sub.labelFr,
    labelEn: sub.labelEn,
    sizeFr: sub.rangeFr,
    sizeEn: sub.rangeEn,
    priceEur: sub.priceFlat,
    ...(sub.isFeatured ? { isFeatured: true } : {}),
  }),
);

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
    description: "Un appel pour valider le format choisi, l'effectif et les modalités pratiques.",
  },
  {
    title: "Paiement 50 %",
    description:
      "Acompte de 50 % du prix de la formation — virement bancaire ou carte. Facture immédiate.",
  },
  {
    title: "Déroulement de la formation",
    description:
      "Journée d'intervention sur site selon le programme type publié — ressources pédagogiques standardisées remises en fin de journée.",
  },
  {
    title: "Solde + frais annexes",
    description:
      "Solde 50 % après l'intervention, accompagné des frais de logement, repas et forfait trajet — facturés au cas par cas selon la distance et la durée (devis transparent fourni avant signature).",
  },
];

export const RESERVATION_STEPS_EN: ReadonlyArray<{ title: string; description: string }> = [
  {
    title: "I book on the calendar",
    description: "Pick an available slot on our live booking calendar. Instant confirmation.",
  },
  {
    title: "Framing call",
    description: "A call to confirm the chosen format, headcount and practicalities.",
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
  "Frais de logement, repas et forfait trajet en sus, facturés au cas par cas selon la distance et la durée. Devis transparent fourni avant signature. Disponibilités confirmées sous 48 h ouvrées.";

const LOGISTICS_NOTE_EN =
  "Lodging, meals and travel allowance billed separately, calculated case by case based on distance and duration. Transparent quote provided before signature. Availability confirmed within 48 business hours.";

export const CONFERENCE_SCHEDULE_FR: DaySchedule = {
  title: "Déroulement de la conférence",
  intro:
    "Programme type d'une journée conférence (9 h – 17 h). Format collectif standardisé pour mettre tous vos collaborateurs au même niveau, indépendamment de leur métier.",
  days: [
    {
      items: [
        { time: "9 h 00", title: "Accueil + cadrage des thèmes" },
        {
          time: "9 h 30",
          title: "Conférence — panorama IA opérationnelle 2026",
          description: "2 h · outils principaux + démos live + idées d'usages par secteur.",
        },
        { time: "11 h 30", title: "Pause" },
        {
          time: "11 h 45",
          title: "Ateliers pratiques par groupes",
          description: "1 h 15 · mise en pratique sur les cas d'usage métier.",
        },
        { time: "13 h 00", title: "Pause déjeuner" },
        {
          time: "14 h 00",
          title: "Démos live + retours d'ateliers",
          description: "2 h · approfondissement et confrontation à la réalité terrain.",
        },
        { time: "16 h 00", title: "Pause" },
        {
          time: "16 h 15",
          title: "Q&A ouverte",
          description: "45 min · questions libres et plan d'action.",
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
    "Standard programme for the 1-day talk (9 a.m. – 5 p.m.). Standardised collective format to bring everyone in your company to the same level, regardless of their role.",
  days: [
    {
      items: [
        { time: "9:00", title: "Welcome + theme framing" },
        {
          time: "9:30",
          title: "Talk — 2026 operational AI panorama",
          description: "2 h · main tools + live demos + use-case ideas by sector.",
        },
        { time: "11:30", title: "Break" },
        {
          time: "11:45",
          title: "Hands-on group workshops",
          description: "1 h 15 · applied practice on domain use cases.",
        },
        { time: "13:00", title: "Lunch break" },
        {
          time: "14:00",
          title: "Live demos + workshop debrief",
          description: "2 h · deepening and confrontation with field reality.",
        },
        { time: "16:00", title: "Break" },
        {
          time: "16:15",
          title: "Open Q&A",
          description: "45 min · open questions and action plan.",
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
          "Découvrir l'IA appliquée au quotidien — outils, usages concrets, idées d'automatisations pour gagner du temps dès le lendemain. Une journée de formation sur site, ressources prêtes à utiliser dès le retour au bureau.",
        duration: "1 journée sur site (9 h – 17 h)",
        durationDays: 1,
        price: `à partir de ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "fr")}`,
        priceTiers: ESSENTIELLE_PRICE_TIERS_FR,
        groupSize: "2 à 8 personnes (au-delà : Approfondie 2 jours)",
        format: "Sur site · France & international",
        audience: "TPE / PME / Grandes entreprises · sans pré-requis IA",
        outcomes: [
          "Vos équipes connaissent les principaux outils IA (ChatGPT, Claude, Copilot…) et savent quand s'en servir",
          "Elles identifient 5 à 10 usages concrets sur leurs tâches : rédaction, recherche, synthèse, analyse",
          "Elles repartent avec des idées d'automatisations applicables immédiatement à leur métier",
        ],
        outline: [
          "Call de prise de contact en visio pour valider le format",
          "Jour J · découverte des outils + ateliers pratiques + démos",
          "Ressources pédagogiques fournies en fin de journée (référentiel + cas d'usage)",
        ],
        ctaLabel: "Découvrir l'Essentielle",
      },
      en: {
        benefitTagline:
          "Discover AI applied to your day-to-day — tools, concrete uses, automation ideas to save time from day two. A one-day on-site training with ready-to-use takeaways from day one back at the office.",
        duration: "1 day on site (9 a.m. – 5 p.m.)",
        durationDays: 1,
        price: `from ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "en")}`,
        priceTiers: ESSENTIELLE_PRICE_TIERS_EN,
        groupSize: "2 to 8 people (above: 2-day Deep Dive)",
        format: "On site · France & international",
        audience: "Small / mid-market / enterprise · no AI prerequisites",
        outcomes: [
          "Your team knows the main AI tools (ChatGPT, Claude, Copilot…) and when to use them",
          "They identify 5 to 10 concrete uses on their tasks: writing, research, synthesis, analysis",
          "They leave with automation ideas they can apply to their domain right away",
        ],
        outline: [
          "Intro call by video to confirm the format",
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
        title: `Intervention IA Essentielle · cabinet AxionIA · ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "fr")}`,
        description: `Une journée de formation IA sur site (2-8 personnes) : découverte des outils, ateliers pratiques, idées d'automatisations. Boîte à outils standardisée fournie. Tous secteurs, tous niveaux, dès ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "fr")}.`,
      },
      daySchedule: {
        title: "Déroulement de la journée",
        intro:
          "Programme type d'une journée Essentielle (9 h – 17 h). Identique pour toutes les entreprises : des ressources pédagogiques standardisées remises en fin de journée pour être réutilisées dès le lendemain.",
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
        title: `Essential AI session · AxionIA consultancy · ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "en")}`,
        description: `A one-day on-site AI training (2 to 8 people): tool discovery, hands-on workshops, automation ideas. Standardised toolbox provided. All industries, all levels, from ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "en")}.`,
      },
      daySchedule: {
        title: "Day-by-day breakdown",
        intro:
          "Standard programme for the Essential day (9 a.m. – 5 p.m.). Identical for every company: standardised learning takeaways shared at end of day, ready to reuse the next morning.",
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
          "Sensibiliser toute l'entreprise à l'IA en 1 journée — panorama 2026, démos live, idées d'usages, ateliers pratiques. Format collectif standardisé, le moyen le plus rapide de mettre tout le monde au même niveau.",
        duration: "1 journée sur site (9 h – 17 h)",
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
          "Call de prise de contact en visio pour valider thèmes et démos",
          "Jour J · matin conférence + démos live · après-midi ateliers pratiques + Q&A ouverte",
          "Ressources pédagogiques fournies en fin de journée (référentiel + cas d'usage)",
        ],
        ctaLabel: "Demander un devis conférence",
      },
      en: {
        benefitTagline:
          "Upskill your whole company to AI in one day — 2026 panorama, live demos, use ideas, hands-on workshops. Standardised collective format, the fastest way to bring everyone to the same level.",
        duration: "1 day on site (9 a.m. – 5 p.m.)",
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
          "Intro call by video to confirm themes and demos",
          "Day · morning talk + live demos · afternoon hands-on workshops + open Q&A",
          "Learning takeaways shared at end of day (reference sheet + use cases)",
        ],
        ctaLabel: "Request a talk quote",
      },
    },
    fr: {
      ...makeFr({
        eyebrow: "Format : 1 journée conférence",
        title: "Ce que l'IA peut faire",
        titleEm: "pour vous",
        answer:
          "Conférence d'une journée tous niveaux : panorama clair des usages IA réellement opérationnels en 2026, démos live, ateliers pratiques, sessions Q&A. Format collectif standardisé pour acculturer rapidement un grand groupe.",
        ctaPrimary: "Demander un devis conférence",
        faqIntro: "conférence",
      }),
      daySchedule: CONFERENCE_SCHEDULE_FR,
    },
    en: {
      ...makeEn({
        eyebrow: "Format: 1-day talk",
        title: "What AI can do",
        titleEm: "for you",
        answer:
          "A 1-day talk for all levels: clear panorama of AI uses actually operational in 2026, live demos, hands-on workshops, Q&A. Standardised collective format to quickly upskill a large group.",
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
          "Une journée 100 % stratégique avec vous pour mettre à plat votre quotidien dirigeant. On étudie votre emploi du temps, ce qui vous pèse, les tâches répétitives, vos coûts cachés. Ensemble, on identifie les leviers IA & automatisations qui vont vous faire gagner du temps, augmenter vos marges et réduire vos frais de personnel. Vous repartez le soir avec 3 à 5 actions activables dès le lendemain — et sous 7 jours, vous recevez le rapport complet de mise en œuvre chiffré, prêt à exécuter.",
        duration: "1 journée stratégique sur site + rapport sous 7 jours",
        durationDays: 1,
        price: DIRIGEANTS_PRICE_FR,
        groupSize: "Vous + équipe rapprochée (1 à 5 personnes)",
        format: "Sur site dirigeant · France & international",
        audience: "Fondateurs, DG, dirigeants, CODIR, COMEX · TPE → grandes entreprises",
        outcomes: [
          "Le soir même : 3 à 5 actions concrètes activables dès le lendemain matin (outils à utiliser, prompts prêts à coller, premiers paramétrages simples) — pour un gain de temps immédiat sur votre semaine",
          "Cartographie de votre semaine type : où va réellement votre temps, quelles tâches mangent vos heures à forte valeur, lesquelles peuvent passer en IA ou en automatisation",
          "3 à 5 leviers chiffrés pour augmenter vos marges : automatisations équipes (gain frais de personnel), accélération commerciale, réduction des coûts cachés, productivité dirigeant",
          "Vision IA 12-24 mois pour votre entreprise + grille d'arbitrage personnelle pour décider seul sur les futurs investissements IA, sans dépendre d'un cabinet",
          "Sous 7 jours · rapport complet de mise en œuvre : synthèse de la journée + recherches & vérifications post-séance + plan d'exécution priorisé et chiffré, prêt à lancer par vos équipes ou par nous",
        ],
        outline: [
          "Call de cadrage en visio — premier portrait de votre quotidien et de vos enjeux 2026 pour préparer la journée",
          "Jour J — 100 % stratégie : matin · audit emploi du temps + tâches répétitives + coûts cachés · après-midi · conception des leviers IA & automatisations + chiffrage · fin de journée · vous repartez avec vos 3 à 5 actions immédiates + la vision 12-24 mois",
          "Sous 7 jours · envoi du rapport complet de mise en œuvre — synthèse de la journée + recherches complémentaires + plan d'exécution priorisé et chiffré",
        ],
        ctaLabel: "Réserver votre journée Direction",
      },
      en: {
        benefitTagline:
          "A fully strategic day at your side to lay your executive daily life flat. We study your schedule, what weighs on you, repetitive tasks, hidden costs. Together, we map the AI & automation levers that will save you time, lift your margins and reduce headcount costs. You leave that evening with 3 to 5 actions you can activate the next morning — and within 7 days, you receive the full quantified implementation report, ready to execute.",
        duration: "1 strategic day on site + report within 7 days",
        durationDays: 1,
        price: DIRIGEANTS_PRICE_EN,
        groupSize: "You + inner circle (1 to 5)",
        format: "On site · France & international",
        audience: "Founders, CEOs, executives, leadership, COMEX · small to enterprise",
        outcomes: [
          "That same evening: 3 to 5 concrete actions activable the next morning (tools to use, ready-to-paste prompts, first simple setups) — for an immediate time gain on your week",
          "Mapping of your typical week: where your time really goes, which tasks eat your high-value hours, which ones can move to AI or automation",
          "3 to 5 quantified levers to lift your margins: team automations (headcount savings), sales acceleration, hidden-cost reduction, executive productivity",
          "12-24 month AI vision for your company + personal decision framework so you call your own shots on future AI investments — no consulting dependency",
          "Within 7 days · full implementation report: day-of synthesis + post-session research & validation + prioritised quantified execution plan, ready to ship by your teams or by us",
        ],
        outline: [
          "Framing call by video — first portrait of your daily life and 2026 stakes to prepare the day",
          "Day — 100 % strategy: morning · audit of schedule + repetitive tasks + hidden costs · afternoon · design of AI levers & automations + quantification · end of day · you leave with 3 to 5 immediate actions + the 12-24 month vision",
          "Within 7 days · full implementation report — day-of synthesis + complementary research + prioritised quantified execution plan",
        ],
        ctaLabel: "Book your Director's day",
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
    ctaSecondary: `Voir l'Essentielle ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "fr", { compact: true })}`,
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
    ctaSecondary: `See the Essential ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "en", { compact: true })}`,
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
