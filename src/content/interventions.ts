// Content pack — Module 1 Interventions entreprise (6 pages).
// Source de vérité copy: docs 03 + 21 + 16.
// Sprint 5 ships placeholders; finer copy iteration belongs to Sprint 9 polish.
// 2026-05-07 : extension `summary` pour la refonte du listing /interventions
// (post-ADR 0003 lift formation ban) — la page met chaque format en valeur
// dans un gros bloc dédié orienté conversion B2B.

import type { Locale } from "@/i18n/routing";
import {
  APPROFONDIE_SUB_TIERS,
  ESSENTIELLE_SUB_TIERS,
  INTERVENTION_TIERS,
  formatAmount,
  formatPrice,
  getTierById,
} from "./pricing";

// Sprint 14.10.3 / 14.10.5 — prix dérivés de `src/content/pricing.ts` (source unique).
// Aucun montant ne doit être hardcodé ici : tout pointe vers les tiers centraux.
const ESSENTIELLE_TIER = getTierById(INTERVENTION_TIERS, "intervention-essentielle");
const ESSENTIELLE_BASE_PRICE_EUR = ESSENTIELLE_TIER.priceFlat!;
const APPROFONDIE_TIER = getTierById(INTERVENTION_TIERS, "intervention-approfondie");
const APPROFONDIE_BASE_PRICE_EUR = APPROFONDIE_TIER.priceFlat!;
const DIRIGEANTS_TIER = getTierById(INTERVENTION_TIERS, "intervention-dirigeants");
const DIRIGEANTS_PRICE_FR = formatPrice(DIRIGEANTS_TIER, "fr");
const DIRIGEANTS_PRICE_EN = formatPrice(DIRIGEANTS_TIER, "en");
const TEMPS_TIER = getTierById(INTERVENTION_TIERS, "intervention-temps");
const TEMPS_PRICE_FR = formatPrice(TEMPS_TIER, "fr");
const TEMPS_PRICE_EN = formatPrice(TEMPS_TIER, "en");
const CLAUDE_TIER = getTierById(INTERVENTION_TIERS, "intervention-claude");
const CLAUDE_PRICE_FR = formatPrice(CLAUDE_TIER, "fr");
const CLAUDE_PRICE_EN = `${formatAmount(CLAUDE_TIER.priceFlat!, "en", { compact: true })} (excl. VAT)`;

// Grille des 3 paliers Approfondie résumée en une phrase — prix dérivés SSOT
// (APPROFONDIE_SUB_TIERS) pour que la prose FAQ reste alignée sur pricing.ts.
const APPROFONDIE_BRACKETS_FR = `${APPROFONDIE_SUB_TIERS.map((s) =>
  formatAmount(s.priceFlat, "fr", { compact: true }),
).join(" / ")} HT`;
const APPROFONDIE_BRACKETS_EN = APPROFONDIE_SUB_TIERS.map((s) =>
  formatAmount(s.priceFlat, "en", { compact: true }),
).join(" / ");

// Paliers d'effectif Essentielle pour le listing public — Sprint 14.10.5
// (Will 2026-05-08). Source unique = `pricing.ts::ESSENTIELLE_SUB_TIERS`
// (3 brackets : 2-8 / 9-15 / 16-30 personnes → voir ESSENTIELLE_SUB_TIERS).
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

// Paliers Approfondie 2 jours (Sprint 14.10.6) — même grille d'effectif
// qu'Essentielle (2-8 / 9-15 / 16-30 personnes), prix × 1.8 environ pour
// la 2ème journée (cf. APPROFONDIE_SUB_TIERS). Source unique pricing.ts.
const APPROFONDIE_PRICE_TIERS_FR: ReadonlyArray<{ size: string; price: string }> =
  APPROFONDIE_SUB_TIERS.map((sub) => ({
    size: sub.rangeFr,
    price: formatAmount(sub.priceFlat, "fr"),
  }));

const APPROFONDIE_PRICE_TIERS_EN: ReadonlyArray<{ size: string; price: string }> =
  APPROFONDIE_SUB_TIERS.map((sub) => ({
    size: sub.rangeEn,
    price: formatAmount(sub.priceFlat, "en"),
  }));

export type InterventionSlug =
  | "essentielle"
  | "approfondie"
  | "dirigeants"
  | "gagner-du-temps"
  | "intervention-claude";

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
  /** Optionnel — 2-3 testimonials clients illustratifs (D6 Proof), même shape
      et même traitement que /implementation. Photos réutilisées (gender-matched)
      depuis /images/reviews/ + crédit photographe Unsplash. */
  testimonials?: ReadonlyArray<{
    id: string;
    quote: string;
    author: string;
    role: string;
    avatar?: string;
    photographer?: string;
    photographerUrl?: string;
  }>;
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

// Will (audit /interventions 2026-05-12) — Approfondie a la MÊME grille
// d'effectif qu'Essentielle (2-8 / 9-15 / 16-30) mais des prix différents
// (880 / 1420 / 2140 €). Avant cet ajout, la page produit Approfondie
// n'exposait aucune section paliers (vs Essentielle qui en a une), et le
// calendrier soumettait toujours participantsCount=1 → facturation 880 €
// systématique au lieu du palier réel.
export const APPROFONDIE_TIERS: ReadonlyArray<EssentielleTierDef> = APPROFONDIE_SUB_TIERS.map(
  (sub) => ({
    id: sub.id.replace(/^approfondie-/, "") as EssentielleTier,
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

export const DIRIGEANTS_SCHEDULE_FR: DaySchedule = {
  title: "Déroulement de la journée",
  intro:
    "Programme type d'une journée Dirigeants (9 h – 17 h). Identique pour toutes les entreprises : panorama, ateliers de positionnement, référentiel d'arbitrage IA pour vos décisions futures.",
  days: [
    {
      items: [
        { time: "9 h 00", title: "Accueil + cadrage 1-to-1 avec le dirigeant" },
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
        { time: "12 h 00", title: "Déjeuner avec le dirigeant (12 h – 14 h)" },
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
          description: "Référentiel dirigeant, cas d'usage, lectures recommandées.",
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
        { time: "9:00", title: "Welcome + 1-on-1 framing with the executive" },
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
        { time: "12:00", title: "Lunch with the executive (12:00 – 14:00)" },
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
          description: "Executive reference sheet, use cases, recommended reading.",
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
          "Découvrir l'IA appliquée au quotidien — outils, usages concrets, idées d'usages IA pour gagner du temps dès le lendemain. Une journée de formation sur site, ressources prêtes à utiliser dès le retour au bureau.",
        duration: "1 journée sur site (9 h – 17 h)",
        durationDays: 1,
        price: `à partir de ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "fr")}`,
        priceTiers: ESSENTIELLE_PRICE_TIERS_FR,
        groupSize: "2 à 30 personnes",
        format: "Sur site · France & international",
        audience: "TPE / PME / Grandes entreprises · sans pré-requis IA",
        outcomes: [
          "Vos équipes connaissent les principaux outils IA (ChatGPT, Claude, Copilot…) et savent quand s'en servir",
          "Elles identifient 5 à 10 usages concrets sur leurs tâches : rédaction, recherche, synthèse, analyse",
          "Elles repartent avec des idées d'usages IA applicables immédiatement à leur métier",
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
          "Discover AI applied to your day-to-day — tools, concrete uses, AI usage ideas to save time from day two. A one-day on-site training with ready-to-use takeaways from day one back at the office.",
        duration: "1 day on site (9 a.m. – 5 p.m.)",
        durationDays: 1,
        price: `Starting at ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "en")}`,
        priceTiers: ESSENTIELLE_PRICE_TIERS_EN,
        groupSize: "2 to 30 people",
        format: "On site · France & international",
        audience: "Small / mid-market / enterprise · no AI prerequisites",
        outcomes: [
          "Your team knows the main AI tools (ChatGPT, Claude, Copilot…) and when to use them",
          "They identify 5 to 10 concrete uses on their tasks: writing, research, synthesis, analysis",
          "They leave with AI usage ideas they can apply to their domain right away",
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
        "Une journée de formation IA sur site avec votre équipe (2 à 30 personnes) : découverte des outils principaux, ateliers pratiques sur leurs vraies tâches, idées d'usages IA applicables. Vos équipes repartent avec une boîte à outils standardisée et 5 à 10 usages concrets identifiés. Tous secteurs, tous niveaux.",
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
          title: "Idées d'usages IA applicables",
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
            "Une journée complète sur site (9 h - 17 h), précédée d'un call de cadrage en visio pour préparer le format.",
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
          answer: `Trois paliers d'effectif : ${ESSENTIELLE_PRICE_TIERS_FR.map((t) => `${t.size} (${t.price})`).join(", ")}. Au-delà de 30 collaborateurs : voir « Sur demande particulière » pour un format adapté.`,
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
      testimonials: [
        {
          id: "ess-t1",
          quote:
            "Une équipe partie de zéro. Le soir, chacun avait repéré 2 à 3 usages concrets sur ses propres tâches. Concret, sans jargon, directement applicable.",
          author: "Sabrina T.",
          role: "Office manager · cabinet d'expertise comptable",
          avatar: "/images/reviews/avis-impl-catherine.webp",
          photographer: "Michael Dam",
          photographerUrl: "https://unsplash.com/@michaeldam",
        },
        {
          id: "ess-t2",
          quote:
            "Enfin une journée qui parle notre langue. On est repartis avec des réflexes IA utilisables dès le lundi matin, pas de la théorie.",
          author: "Damien R.",
          role: "Dirigeant · PME du bâtiment",
          avatar: "/images/reviews/avis-impl-marc.webp",
          photographer: "Jurica Koletić",
          photographerUrl: "https://unsplash.com/@juricakoletic",
        },
        {
          id: "ess-t3",
          quote:
            "Mes commerciaux ont vu en une journée ce qu'ils cherchaient depuis des mois. Le temps gagné s'est senti dès la semaine suivante.",
          author: "Karim B.",
          role: "Responsable commercial · distribution B2B",
          avatar: "/images/reviews/avis-impl-thomas.webp",
          photographer: "Joseph Gonzalez",
          photographerUrl: "https://unsplash.com/@miracletwentyone",
        },
      ],
      metaSeo: {
        title: `Intervention IA Essentielle · cabinet Axion-IA · ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "fr")}`,
        description: `Une journée de formation IA sur site (2-8 personnes) : découverte des outils, ateliers pratiques, idées d'usages IA opérationnels. Boîte à outils standardisée fournie. Tous secteurs, tous niveaux, à partir de ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "fr")}.`,
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
                title: "Atelier 3 — Idées d'usages sur leurs outils",
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
        "A one-day on-site AI training with your team (2 to 30 people): discovery of the main tools, hands-on workshops on their real tasks, ready-to-apply AI usage ideas. Your team leaves with a standardised toolbox and 5 to 10 concrete uses identified. All industries, all levels.",
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
          title: "Ready-to-apply AI usage ideas",
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
          answer:
            "A full day on site (9 a.m. - 5 p.m.), preceded by a framing video call to prep the format.",
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
          answer: `Three headcount tiers: ${ESSENTIELLE_PRICE_TIERS_EN.map((t) => `${t.size} (${t.price})`).join(", ")}. Beyond 30: see 'Bespoke session' for an adapted format.`,
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
        title: `Essential AI session · Axion-IA consultancy · ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "en")}`,
        description: `A one-day on-site AI training (2 to 30 people): tool discovery, hands-on workshops, AI usage ideas. Standardised toolbox provided. All industries, all levels, starting at ${formatAmount(ESSENTIELLE_BASE_PRICE_EUR, "en")}.`,
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
  // Sprint 14.10.6 — Approfondie 2 jours, format équipes étendu (Will, 2026-05-08).
  // Même grille d'effectif qu'Essentielle (2-8 / 9-15 / 16-30) mais 2 jours
  // consécutifs pour creuser : co-construction d'usages IA sur leurs
  // vrais cas d'usage métier + plan d'action 30 jours.
  {
    slug: "approfondie",
    pathFr: "/interventions/approfondie",
    pathEn: "/interventions/deep-dive",
    accent: "primary",
    summary: {
      fr: {
        benefitTagline:
          "Deux journées consécutives sur site pour aller au fond du sujet : ateliers étendus, co-construction d'usages IA sur leurs vrais cas d'usage métier, plan d'action 30 jours partagé. Pour les équipes qui ne se contentent pas de découvrir.",
        duration: "2 jours consécutifs sur site",
        durationDays: 2,
        price: `À partir de ${formatAmount(APPROFONDIE_BASE_PRICE_EUR, "fr")}`,
        priceTiers: APPROFONDIE_PRICE_TIERS_FR,
        groupSize: "2 à 30 personnes",
        format: "Sur site · France & international",
        audience: "Équipes opérationnelles complètes · TPE, PME, ETI",
        outcomes: [
          "Vos équipes maîtrisent l'IA appliquée à leurs métiers — pas de théorie générique",
          "Co-construction de 10 à 20 méthodes opérationnelles sur leurs vrais outils",
          "Plan d'action 30 jours partagé, mesurable en gains de temps par personne",
        ],
        outline: [
          "Call de cadrage en visio pour préparer les 2 journées sur leurs vrais cas d'usage",
          "Jour 1 · panorama outils + ateliers pratiques · Jour 2 · co-construction d'usages IA + plan d'action 30 jours",
          "Ressources fournies : référentiel d'outils, prompts maison, méthodes maîtrisées prêtes à utiliser",
        ],
        ctaLabel: "Découvrir l'Approfondie",
      },
      en: {
        benefitTagline:
          "Two consecutive on-site days to go deep: extended workshops, co-built AI methods on their real domain use cases, shared 30-day action plan. For teams that don't settle for discovery.",
        duration: "2 consecutive days on site",
        durationDays: 2,
        price: `Starting at ${formatAmount(APPROFONDIE_BASE_PRICE_EUR, "en")}`,
        priceTiers: APPROFONDIE_PRICE_TIERS_EN,
        groupSize: "2 to 30 people",
        format: "On site · France & international",
        audience: "Full operational teams · small to mid-market",
        outcomes: [
          "Your teams master AI applied to their domain — no generic theory",
          "Co-build 10 to 20 operational methods on their real tools",
          "Shared 30-day action plan, measurable in time saved per person",
        ],
        outline: [
          "Framing call by video to prep the 2 days on their real use cases",
          "Day 1 · tools panorama + hands-on workshops · Day 2 · automation co-build + 30-day action plan",
          "Takeaways: tool reference, in-house prompts, ready-to-use mastered methods",
        ],
        ctaLabel: "Discover Deep Dive",
      },
    },
    fr: {
      ...makeFr({
        eyebrow: "Format équipes étendu · 2 jours sur site",
        title: "Approfondie",
        titleEm: "2 jours équipes",
        answer: `Deux journées consécutives sur site (à partir de ${formatAmount(APPROFONDIE_BASE_PRICE_EUR, "fr")}) pour creuser l'IA en équipe (2 à 30 personnes selon le palier choisi : ${APPROFONDIE_BRACKETS_FR}). Ateliers étendus, co-construction d'usages IA sur vos vrais cas d'usage métier, plan d'action 30 jours partagé. Pour les équipes qui ne se contentent pas de découvrir.`,
        ctaPrimary: "Réserver l'Approfondie",
        faqIntro: "équipes",
      }),
      benefits: [
        {
          title: "Aller au fond du sujet · 2 jours",
          description:
            "Le 2ème jour change tout : on dépasse la découverte pour entrer dans la mise en pratique réelle, l'expérimentation et la co-construction.",
        },
        {
          title: "10 à 20 méthodes co-construites",
          description:
            "Pas des slides : des usages IA testés sur vos vrais outils métier, prêtes à utiliser dès le retour au bureau.",
        },
        {
          title: "Plan d'action 30 jours partagé",
          description:
            "À la fin du jour 2, plan d'action concret partagé : qui fait quoi, quand, avec quels outils, quels gains attendus.",
        },
        {
          title: "Tarif dégressif au nombre de participants",
          description: `3 paliers d'effectif : 2-8 personnes (${formatAmount(APPROFONDIE_SUB_TIERS[0]!.priceFlat, "fr")}), 9-15 (${formatAmount(APPROFONDIE_SUB_TIERS[1]!.priceFlat, "fr")}), 16-30 (${formatAmount(APPROFONDIE_SUB_TIERS[2]!.priceFlat, "fr")}). Plus l'équipe est grande, plus le coût par personne baisse.`,
        },
      ],
      metrics: [
        { number: "2", suffix: "jours", label: "Format consécutif sur site" },
        { number: "10-20", suffix: "usages IA", label: "Maîtrisés avec vos équipes" },
        { number: "30", suffix: "jours", label: "Plan d'action partagé après" },
      ],
      faqs: [
        {
          id: "vs-essentielle",
          question: "Différence avec l'Essentielle 1 jour ?",
          answer:
            "L'Essentielle découvre, l'Approfondie creuse. 1 jour = panorama + premiers usages IA. 2 jours = ateliers étendus + co-construction sur vos vrais cas d'usage + plan d'action 30 jours partagé. Pour équipes qui veulent passer à l'échelle.",
        },
        {
          id: "headcount",
          question: "Quelle taille d'équipe ?",
          answer:
            "De 2 à 30 personnes, mêmes paliers que l'Essentielle (2-8 / 9-15 / 16-30) avec tarif dégressif. Au-delà de 30, voir « Sur demande particulière ».",
        },
        {
          id: "tools",
          question: "On travaille sur quels outils ?",
          answer:
            "Vos vrais outils du quotidien (Office 365, Google Workspace, votre CRM, votre ERP, etc.) + les outils IA grand public. Le call de cadrage permet de préparer les 2 jours.",
        },
        {
          id: "deliverables",
          question: "Que reste-t-il après ?",
          answer:
            "10 à 20 méthodes maîtrisées prêtes à utiliser, référentiel d'outils, prompts maison + plan d'action 30 jours partagé. Suivi à 30 jours sur demande.",
        },
      ],
      ctaBlockTitle: "Allez au fond du sujet en 2 jours",
      ctaBlockDescription: `Réservez la prochaine Approfondie disponible — calendrier en temps réel. Tarif fixe à partir de ${formatAmount(APPROFONDIE_BASE_PRICE_EUR, "fr")}, 3 paliers d'effectif.`,
      testimonials: [
        {
          id: "app-t1",
          quote:
            "Le deuxième jour change tout. On n'a pas écouté des slides : on a co-construit nos automatisations sur nos vrais outils, avec un plan derrière.",
          author: "Hélène M.",
          role: "Directrice des opérations · ETI de services",
          avatar: "/images/reviews/avis-impl-nadia.webp",
          photographer: "Christina @ wocintechchat.com",
          photographerUrl: "https://unsplash.com/@wocintechchat",
        },
        {
          id: "app-t2",
          quote:
            "Le plan d'action 30 jours, on l'a vraiment suivi. Trois mois après, l'équipe est autonome sur ses propres cas.",
          author: "Vincent D.",
          role: "Responsable SI · PME industrielle",
          avatar: "/images/reviews/avis-impl-marc.webp",
          photographer: "Jurica Koletić",
          photographerUrl: "https://unsplash.com/@juricakoletic",
        },
        {
          id: "app-t3",
          quote:
            "Deux jours pour passer de la curiosité à la maîtrise. Le format intra, sur nos propres dossiers, fait toute la différence.",
          author: "Aurélie P.",
          role: "Responsable RH · groupe régional",
          avatar: "/images/reviews/avis-impl-catherine.webp",
          photographer: "Michael Dam",
          photographerUrl: "https://unsplash.com/@michaeldam",
        },
      ],
    },
    en: {
      ...makeEn({
        eyebrow: "Extended team format · 2 days on site",
        title: "Deep Dive",
        titleEm: "2-day teams",
        answer: `Two consecutive on-site days (starting at ${formatAmount(APPROFONDIE_BASE_PRICE_EUR, "en")}) to go deep on AI as a team (2 to 30 people depending on tier: ${APPROFONDIE_BRACKETS_EN}). Extended workshops, automation co-build on your real domain use cases, shared 30-day action plan. For teams that don't settle for discovery.`,
        ctaPrimary: "Book Deep Dive",
        faqIntro: "teams",
      }),
      benefits: [
        {
          title: "Go deep · 2 days",
          description:
            "Day 2 changes everything: we go beyond discovery into real practice, experimentation and co-build.",
        },
        {
          title: "10 to 20 co-built AI methods",
          description:
            "No slides: AI usages tested on your real domain tools, ready to use back at the office.",
        },
        {
          title: "Shared 30-day action plan",
          description:
            "By end of day 2, concrete shared action plan: who does what, when, with which tools, expected gains.",
        },
        {
          title: "Pricing scales with headcount",
          description: `3 tiers: 2-8 people (${formatAmount(APPROFONDIE_SUB_TIERS[0]!.priceFlat, "en")}), 9-15 (${formatAmount(APPROFONDIE_SUB_TIERS[1]!.priceFlat, "en")}), 16-30 (${formatAmount(APPROFONDIE_SUB_TIERS[2]!.priceFlat, "en")}). The bigger the team, the lower the per-person cost.`,
        },
      ],
      metrics: [
        { number: "2", suffix: "days", label: "Consecutive on-site format" },
        { number: "10-20", suffix: "AI methods", label: "Mastered with your teams" },
        { number: "30", suffix: "days", label: "Action plan shared afterwards" },
      ],
      faqs: [
        {
          id: "vs-essentielle",
          question: "Difference with the 1-day Essential?",
          answer:
            "Essential discovers, Deep Dive digs. 1 day = panorama + first AI usages. 2 days = extended workshops + co-build on your real cases + shared 30-day action plan. For teams ready to scale.",
        },
        {
          id: "headcount",
          question: "What team size?",
          answer:
            "From 2 to 30 people, same tiers as the Essential (2-8 / 9-15 / 16-30) with scaling pricing. Beyond 30, see 'Bespoke session'.",
        },
        {
          id: "tools",
          question: "Which tools do we work on?",
          answer:
            "Your real day-to-day tools (Office 365, Google Workspace, your CRM, your ERP, etc.) + the mainstream AI tools. The framing call lets us prep the 2 days.",
        },
        {
          id: "deliverables",
          question: "What remains afterwards?",
          answer:
            "10 to 20 mastered methods, tool reference, in-house prompts + shared 30-day action plan. 30-day follow-up on request.",
        },
      ],
      ctaBlockTitle: "Go deep on AI in 2 days",
      ctaBlockDescription: `Book the next available Deep Dive — live calendar. Fixed fee starting at ${formatAmount(APPROFONDIE_BASE_PRICE_EUR, "en")}, 3 headcount tiers.`,
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
          "Une journée strictement 1-to-1 (vous seul·e avec moi) pour structurer votre entreprise et chiffrer précisément les gains d'implémentation IA poste par poste. Le soir, 3 actions immédiates. Sous 7 jours, votre rapport complet de mise en œuvre — gains chiffrés en € attendus.",
        duration: "1 journée + rapport sous 7 jours",
        durationDays: 1,
        price: DIRIGEANTS_PRICE_FR,
        groupSize: "1 dirigeant (1-to-1)",
        format: "Sur site dirigeant · France & international",
        audience: "Dirigeant TPE, PME, ETI ou grande entreprise",
        outcomes: [
          "3 actions immédiates activables dès le lendemain — gain de temps tout de suite, sans attendre",
          "Leviers chiffrés pour vos marges : frais de personnel, accélération commerciale, coûts cachés",
          "Vision IA 12-24 mois + grille d'arbitrage pour décider seul, sans dépendre d'un cabinet",
          "Rapport sous 7 jours : plan d'exécution priorisé et chiffré, prêt à lancer par vos équipes ou par nous",
        ],
        outline: [
          "Call de cadrage en visio — premier portrait de votre quotidien et de vos enjeux",
          "Jour J · 100 % stratégie : emploi du temps · chronophages · coûts cachés · leviers IA · vision 12-24 mois",
          "Sous 7 jours · rapport complet de mise en œuvre, chiffré et priorisé",
        ],
        ctaLabel: "Réserver votre journée Direction",
      },
      en: {
        benefitTagline:
          "A strictly 1-on-1 day (just you and me) to structure your company and quantify AI implementation gains role by role. That evening, 3 immediate actions. Within 7 days, your full implementation report — gains quantified in expected €.",
        duration: "1 day + report within 7 days",
        durationDays: 1,
        price: DIRIGEANTS_PRICE_EN,
        groupSize: "1 executive (1-on-1)",
        format: "On site · France & international",
        audience: "Executive of small business, mid-market or enterprise",
        outcomes: [
          "3 immediate actions activable the next morning — time gain right away, no waiting",
          "Quantified levers for your margins: headcount costs, sales acceleration, hidden costs",
          "12-24 month AI vision + decision framework so you call your own shots, no consulting dependency",
          "Within 7 days · prioritised quantified execution plan, ready to ship by your teams or by us",
        ],
        outline: [
          "Framing call by video — first portrait of your daily life and stakes",
          "Day · 100 % strategy: schedule · time-sinks · hidden costs · AI levers · 12-24 month vision",
          "Within 7 days · full implementation report, quantified and prioritised",
        ],
        ctaLabel: "Book your Director's day",
      },
    },
    fr: {
      ...makeFr({
        eyebrow: "Journée stratégique 1-to-1 dirigeant",
        title: "Dirigeant",
        titleEm: "Journée stratégique",
        answer:
          "Une journée stratégique 1-to-1 sur votre site, vous seul·e avec moi. On met à plat votre quotidien dirigeant, on structure votre entreprise et on identifie les leviers IA qui libèrent vos heures, augmentent vos marges et réduisent vos frais de personnel — chiffrés précisément poste par poste. Le soir : 3 actions activables dès le lendemain. Sous 7 jours : rapport complet de mise en œuvre, chiffré et priorisé.",
        ctaPrimary: "Réserver votre journée Direction",
        faqIntro: "dirigeants",
      }),
      benefits: [
        {
          title: "Libérer vos heures dirigeant",
          description:
            "Boîte mail, préparation de réunions, reporting, comptes-rendus, suivi commercial : on cartographie vos chronophages réels et on identifie ce qui peut passer en IA — chiffré en heures par semaine.",
        },
        {
          title: "Augmenter vos marges",
          description:
            "Leviers IA × frais de personnel (gains de productivité équipes), accélération commerciale, réduction des coûts cachés — chaque levier chiffré en € attendus, pas en promesses vagues.",
        },
        {
          title: "Décider seul sur l'IA",
          description:
            "Vision 12-24 mois pour votre entreprise + grille d'arbitrage personnelle — vous tranchez vos prochains investissements IA en autonomie, sans dépendre d'un cabinet.",
        },
        {
          title: "Plan d'exécution sous 7 jours",
          description:
            "Rapport complet livré sous 7 jours : synthèse de la journée + recherches & vérifications post-séance + plan d'exécution priorisé et chiffré, prêt à lancer par vos équipes ou par nous.",
        },
      ],
      metrics: [
        { number: "3", suffix: "actions", label: "activables dès le lendemain" },
        { number: "12-24", suffix: "mois", label: "Vision IA cadrée pour l'entreprise" },
        { number: "7", suffix: "jours", label: "Rapport complet livré" },
      ],
      faqs: [
        {
          id: "no-implementation",
          question: "Y a-t-il de l'implémentation pendant la journée ?",
          answer:
            "Non. La journée est 100 % stratégique : on identifie, on chiffre, on priorise. L'implémentation se fait après — soit par vos équipes (le rapport est prêt à exécuter), soit par nous via les autres modules (Implémentation IA).",
        },
        {
          id: "report",
          question: "Que contient exactement le rapport sous 7 jours ?",
          answer:
            "Synthèse de la journée + recherches complémentaires faites après la séance (vérification des outils, comparatifs, chiffrages affinés) + plan d'exécution priorisé avec coûts, gains attendus et calendrier indicatif. Document directement actionnable.",
        },
        {
          id: "fit",
          question: "Pour qui est-ce vraiment fait ?",
          answer:
            "Fondateurs, DG, dirigeants de TPE / PME / ETI / grandes entreprises. Le format strictement 1-to-1 (vous seul·e avec moi, pas de comité) garantit que la journée colle exactement à votre contexte et à vos enjeux personnels — confidentialité totale.",
        },
        {
          id: "follow-up",
          question: "Y a-t-il un suivi après le rapport ?",
          answer:
            "Le rapport est livré clés en main. Si vous voulez une exécution accompagnée, on bascule sur le module Implémentation IA — sur devis selon le périmètre.",
        },
      ],
      ctaBlockTitle: "Prêt·e à libérer vos heures dirigeant ?",
      ctaBlockDescription:
        "Réservez la prochaine date disponible. Calendrier maison en temps réel, confirmation immédiate, rapport sous 7 jours après la journée.",
      daySchedule: DIRIGEANTS_SCHEDULE_FR,
    },
    en: {
      ...makeEn({
        eyebrow: "Strategic 1-on-1 executive day",
        title: "Executive",
        titleEm: "Strategic day",
        answer:
          "A strictly 1-on-1 strategic day on site, just you and me. We lay your executive daily life flat, structure your company, and map the AI levers that free your hours, lift your margins and reduce headcount costs — quantified precisely role by role. That evening: 3 actions activable the next morning. Within 7 days: a full quantified, prioritised implementation report.",
        ctaPrimary: "Book your Director's day",
        faqIntro: "executives",
      }),
      benefits: [
        {
          title: "Free your executive hours",
          description:
            "Inbox, board prep, reporting, meeting minutes, sales follow-up: we map your real time-sinks and identify what can move to AI — quantified in hours per week.",
        },
        {
          title: "Lift your margins",
          description:
            "AI × headcount levers (team productivity gains), sales acceleration, hidden cost reduction — each lever quantified in expected €, not vague promises.",
        },
        {
          title: "Call your own AI shots",
          description:
            "12-24 month vision for your company + personal decision framework — you decide on future AI investments in autonomy, no consulting dependency.",
        },
        {
          title: "Execution plan within 7 days",
          description:
            "Full report delivered within 7 days: day-of synthesis + post-session research & validation + prioritised quantified execution plan, ready to ship by your teams or by us.",
        },
      ],
      metrics: [
        { number: "3", suffix: "actions", label: "activable the next morning" },
        { number: "12-24", suffix: "months", label: "AI vision framed for the company" },
        { number: "7", suffix: "days", label: "Full report delivered" },
      ],
      faqs: [
        {
          id: "no-implementation",
          question: "Is there implementation during the day?",
          answer:
            "No. The day is 100 % strategic: we identify, quantify, prioritise. Implementation happens after — either by your teams (the report is ready to execute), or by us via other modules (AI Implementation).",
        },
        {
          id: "report",
          question: "What's exactly in the 7-day report?",
          answer:
            "Day-of synthesis + complementary research done after the session (tool validation, comparisons, refined quantification) + prioritised execution plan with costs, expected gains and indicative timeline. A directly actionable document.",
        },
        {
          id: "fit",
          question: "Who is this really for?",
          answer:
            "Founders, CEOs, executives of small to enterprise companies. The strictly 1-on-1 format (just you and me, no committee) guarantees the day fits your context and personal stakes exactly — total confidentiality.",
        },
        {
          id: "follow-up",
          question: "Is there a follow-up after the report?",
          answer:
            "The report is delivered turn-key. If you want supported execution, we move to the AI Implementation module — quoted based on scope.",
        },
      ],
      ctaBlockTitle: "Ready to free your executive hours?",
      ctaBlockDescription:
        "Book the next available date. Live in-house calendar, instant confirmation, full report within 7 days after the day.",
      daySchedule: DIRIGEANTS_SCHEDULE_EN,
    },
  },
  // Sprint 14.10.6 — page produit dédiée pour les 2 formats nouveaux du listing
  // (Will, 2026-05-08). Avant : CTAs pointaient direct vers /reserver et
  // /contact, ce qui sautait l'étape « pourquoi je devrais cliquer » côté
  // visiteur. Maintenant : page complète avec hero + benefits + outline + FAQs.
  {
    slug: "gagner-du-temps",
    pathFr: "/interventions/gagner-du-temps",
    pathEn: "/interventions/save-time",
    accent: "primary",
    summary: {
      fr: {
        benefitTagline:
          "Une journée pour gagner du temps concrètement : méthodes IA appliquées sur les tâches répétitives, prompts efficaces, intégration dans le flux de travail quotidien. Vos équipes ressortent avec des heures gagnées chaque semaine.",
        duration: "1 journée sur site",
        durationDays: 1,
        price: TEMPS_PRICE_FR,
        groupSize: "2 à 20 personnes",
        format: "Sur site · France & international",
        audience: "Équipes opérationnelles · TPE, PME, ETI",
        outcomes: [
          "Vos équipes identifient leurs tâches répétitives chronophages et y appliquent l'IA",
          "Chaque participant repart avec 5 à 10 méthodes maîtrisées sur ses propres outils",
          "Gain mesurable dès le retour au bureau — plusieurs heures par personne et par semaine",
        ],
        outline: [
          "Call de cadrage en visio pour préparer la journée sur vos outils réels",
          "Jour J · ateliers pratiques sur les chronophages identifiés + pratique en live sur les vrais cas",
          "Ressources fournies en fin de journée : prompts types, référentiel d'outils, plan d'application personnel",
        ],
        ctaLabel: "Réserver Gagner du temps",
      },
      en: {
        benefitTagline:
          "One day to save time concretely: AI methods on repetitive tasks, effective prompts, integration into daily workflow. Your teams leave with hours saved every week.",
        duration: "1 day on site",
        durationDays: 1,
        price: TEMPS_PRICE_EN,
        groupSize: "2 to 20 people",
        format: "On site · France & international",
        audience: "Operational teams · small to mid-market",
        outcomes: [
          "Your teams spot their time-consuming repetitive tasks and apply AI to them",
          "Each participant leaves with 5 to 10 methods mastered on their own tools",
          "Measurable gains the day back at the office — hours per person, per week",
        ],
        outline: [
          "Framing call by video to prep the day on your real tools",
          "Day · hands-on workshops on identified time-sinks + live automation tests",
          "Takeaways at end of day: prompt templates, tool reference, personal application plan",
        ],
        ctaLabel: "Book Save Time",
      },
    },
    fr: {
      ...makeFr({
        eyebrow: "Productivité équipes · 1 journée sur site",
        title: "Gagner du temps",
        titleEm: "concrètement",
        answer: `Une journée à ${TEMPS_PRICE_FR} sur site, dédiée à la productivité de vos équipes (2 à 20 personnes). On identifie les tâches répétitives qui mangent leurs heures, on apprend à les traiter avec l'IA, on intègre dans leur flux de travail quotidien. Vos équipes repartent avec 5 à 10 méthodes maîtrisées et un gain mesurable de plusieurs heures par semaine et par personne.`,
        ctaPrimary: "Réserver Gagner du temps",
        faqIntro: "équipes",
      }),
      benefits: [
        {
          title: "Identifier les chronophages réels",
          description:
            "Audit collaboratif des tâches répétitives qui mangent les heures de vos équipes — pas une formation théorique, on travaille sur leurs vraies tâches.",
        },
        {
          title: "5 à 10 méthodes maîtrisées",
          description:
            "Chaque participant repart avec ses méthodes IA maîtrisées à utiliser, testées en live sur ses propres outils — pas des slides, des choses qui tournent.",
        },
        {
          title: "Prompts efficaces & garde-fous",
          description:
            "Bibliothèque de prompts types par profil métier + cadre d'usage pour éviter les erreurs courantes (hallucinations, qualité de sortie, confidentialité).",
        },
        {
          title: "Gain mesurable dès le lendemain",
          description:
            "Plusieurs heures gagnées par semaine et par collaborateur dès le retour au bureau — productivité visible sans phase de transition.",
        },
      ],
      metrics: [
        { number: `${CLAUDE_TIER.priceFlat}`, suffix: "€ HT", label: "Tarif fixe, sans surprise" },
        { number: "5-10", suffix: "AI methods", label: "Testées par participant" },
        { number: "+2", suffix: "h/jour", label: "Gain moyen par collaborateur" },
      ],
      faqs: [
        {
          id: "headcount",
          question: "Quelle taille d'équipe ?",
          answer:
            "De 2 à 20 personnes pour garder l'aspect atelier (chacun manipule ses outils). Au-delà, voir l'Essentielle (3 paliers jusqu'à 30 personnes) ou la Conférence (effectif libre).",
        },
        {
          id: "tools",
          question: "On travaille sur quels outils ?",
          answer:
            "Vos vrais outils du quotidien (Office 365, Google Workspace, votre CRM, votre ERP, etc.) + les outils IA grand public (ChatGPT, Claude, Copilot). Le call de cadrage permet de préparer.",
        },
        {
          id: "level",
          question: "Faut-il un niveau IA préalable ?",
          answer:
            "Non. La journée s'adapte au niveau réel des participants — du débutant à l'utilisateur régulier. Aucun pré-requis technique.",
        },
        {
          id: "deliverables",
          question: "Que reste-t-il après ?",
          answer:
            "Bibliothèque de prompts types, référentiel d'outils, plan d'application personnel par participant + suivi à 30 jours sur demande.",
        },
      ],
      ctaBlockTitle: "Gagnez plusieurs heures par semaine et par personne",
      ctaBlockDescription: `Réservez la prochaine date — calendrier en temps réel, confirmation immédiate. Tarif fixe ${TEMPS_PRICE_FR}, pas de surprise.`,
      testimonials: [
        {
          id: "gdt-t1",
          quote:
            "On a chiffré les heures perdues le matin, on les a automatisées l'après-midi. Plusieurs heures récupérées chaque semaine, mesurées.",
          author: "Mathieu G.",
          role: "Gérant · agence immobilière",
          avatar: "/images/reviews/avis-impl-thomas.webp",
          photographer: "Joseph Gonzalez",
          photographerUrl: "https://unsplash.com/@miracletwentyone",
        },
        {
          id: "gdt-t2",
          quote:
            "Mes tâches répétitives — comptes-rendus, mails types, relances — passent maintenant par l'IA. Je respire, et je me concentre sur l'essentiel.",
          author: "Claire V.",
          role: "Assistante de direction · PME",
          avatar: "/images/reviews/avis-impl-nadia.webp",
          photographer: "Christina @ wocintechchat.com",
          photographerUrl: "https://unsplash.com/@wocintechchat",
        },
        {
          id: "gdt-t3",
          quote:
            "Le reporting hebdo me prenait une demi-journée. Aujourd'hui, une heure. Rentabilisé dès la première semaine de retour.",
          author: "Romain C.",
          role: "Responsable ADV · négoce",
          avatar: "/images/reviews/avis-impl-marc.webp",
          photographer: "Jurica Koletić",
          photographerUrl: "https://unsplash.com/@juricakoletic",
        },
      ],
    },
    en: {
      ...makeEn({
        eyebrow: "Team productivity · 1 day on site",
        title: "Save Time",
        titleEm: "concretely",
        answer: `A ${TEMPS_PRICE_EN} day on site, dedicated to your teams' productivity (2 to 20 people). We identify the repetitive tasks eating their hours, learn to handle them with AI, embed them in their daily workflow. Your teams leave with 5 to 10 methods mastered and a measurable gain of several hours per week and per person.`,
        ctaPrimary: "Book Save Time",
        faqIntro: "teams",
      }),
      benefits: [
        {
          title: "Spot the real time-sinks",
          description:
            "Collaborative audit of the repetitive tasks eating your teams' hours — no theory, we work on their actual tasks.",
        },
        {
          title: "5 to 10 methods mastered",
          description:
            "Each participant leaves with their AI methods mastered to use, tested live on their own tools — no slides, things that actually run.",
        },
        {
          title: "Effective prompts & guardrails",
          description:
            "Prompt template library by role + usage framework to avoid common mistakes (hallucinations, output quality, confidentiality).",
        },
        {
          title: "Measurable gains the next day",
          description:
            "Hours saved per week per employee from day one back at the office — visible productivity, no transition phase.",
        },
      ],
      metrics: [
        { number: `€${CLAUDE_TIER.priceFlat}`, suffix: "flat", label: "Fixed fee, no surprises" },
        { number: "5-10", suffix: "AI methods", label: "Tested per participant" },
        { number: "+2", suffix: "h/day", label: "Average gain per employee" },
      ],
      faqs: [
        {
          id: "headcount",
          question: "What team size?",
          answer:
            "From 2 to 20 people to keep the workshop feel (everyone uses their own tools). Beyond, see the Essential (3 tiers up to 30 people) or the Talk (open headcount).",
        },
        {
          id: "tools",
          question: "Which tools do we work on?",
          answer:
            "Your real day-to-day tools (Office 365, Google Workspace, your CRM, your ERP, etc.) + the mainstream AI tools (ChatGPT, Claude, Copilot). The framing call lets us prep.",
        },
        {
          id: "level",
          question: "Is prior AI level required?",
          answer:
            "No. The day adapts to the participants' real level — from beginner to regular user. No technical prerequisite.",
        },
        {
          id: "deliverables",
          question: "What remains afterwards?",
          answer:
            "Prompt template library, tool reference, personal application plan per participant + 30-day follow-up on request.",
        },
      ],
      ctaBlockTitle: "Save several hours per week per person",
      ctaBlockDescription: `Book the next date — live calendar, instant confirmation. Fixed fee ${TEMPS_PRICE_EN}, no surprise.`,
    },
  },
  {
    slug: "intervention-claude",
    pathFr: "/interventions/intervention-claude",
    pathEn: "/interventions/intervention-claude",
    // Note : `accent` est typé `InterventionAccent` (palette globale).
    // L'accent peach Anthropic est appliqué uniquement sur le listing
    // /interventions (override local `claude`). Sur la page produit
    // dédiée, on retient `terracotta` qui est le tone le plus proche
    // visuellement du peach Claude dans la palette Axion-IA standard.
    accent: "terracotta",
    summary: {
      fr: {
        benefitTagline:
          "Une journée 100 % dédiée à Claude (Anthropic). Trois volets : Chat (rédaction, analyse, synthèse), Cowork (Projects, fichiers, mémoire) et Code (Claude Code en CLI, génération et refactoring). Vos équipes ressortent autonomes sur l'outil de pointe IA.",
        duration: "1 journée sur site",
        durationDays: 1,
        price: CLAUDE_PRICE_FR,
        groupSize: "Selon besoin (2 à 12 conseillé)",
        format: "Sur site · France & international",
        audience: "Équipes qui veulent maîtriser Claude en profondeur",
        outcomes: [
          "Maîtrise des 3 surfaces Claude : Chat (web/app), Cowork (Projects, mémoire de projet, fichiers attachés), Code (CLI)",
          "Workflows IA avancés sur Claude : prompts longs et structurés, system prompts, tool use, agents",
          "Pour les équipes tech : Claude Code en CLI, génération et refactoring de code, intégration dans le flow git",
        ],
        outline: [
          "Call de cadrage en visio pour comprendre vos profils et adapter les 3 volets à votre contexte",
          "Jour J · matin Chat (rédaction, analyse, synthèse) · midi Cowork (Projects, fichiers, mémoire) · après-midi Code (CLI, refactoring)",
          "Ressources fournies : prompts maison, exemples d'utilisation, intégrations recommandées",
        ],
        ctaLabel: "Réserver la Formation Claude",
      },
      en: {
        benefitTagline:
          "A full day 100 % focused on Claude (Anthropic). Three tracks: Chat (writing, analysis, synthesis), Cowork (Projects, files, memory) and Code (Claude Code CLI, generation and refactoring). Your teams leave autonomous on the cutting-edge AI tool.",
        duration: "1 day on site",
        durationDays: 1,
        price: CLAUDE_PRICE_EN,
        groupSize: "As needed (2 to 12 recommended)",
        format: "On site · France & international",
        audience: "Teams that want to master Claude in depth",
        outcomes: [
          "Mastery of all 3 Claude surfaces: Chat (web/app), Cowork (Projects, project memory, file attachments), Code (CLI)",
          "Advanced AI workflows on Claude: long structured prompts, system prompts, tool use, agents",
          "For tech teams: Claude Code CLI, code generation and refactoring, git flow integration",
        ],
        outline: [
          "Framing call by video to understand your profiles and adapt the 3 tracks to your context",
          "Day · morning Chat (writing, analysis, synthesis) · noon Cowork (Projects, files, memory) · afternoon Code (CLI, refactoring)",
          "Takeaways: in-house prompts, usage examples, recommended integrations",
        ],
        ctaLabel: "Book the Claude Training",
      },
    },
    fr: {
      ...makeFr({
        eyebrow: "Intervention outil-spécifique · Claude (Anthropic) · 1 journée",
        title: "Intervention Claude",
        titleEm: "Chat · Cowork · Code",
        answer: `Une journée 100 % dédiée à Claude (Anthropic) sur site, structurée en trois volets pratiques : Chat (rédaction, analyse, synthèse), Cowork (Projects, fichiers, mémoire de projet) et Code (Claude Code en CLI, génération et refactoring de code). Format petit groupe (2 à 8 personnes) pour profondeur maximale. Tarif fixe ${CLAUDE_PRICE_FR} — réservation directe sur le calendrier.`,
        ctaPrimary: "Réserver la Formation Claude",
        faqIntro: "équipes Claude",
      }),
      benefits: [
        {
          title: "Maîtrise des 3 surfaces Claude",
          description:
            "Chat (web/app pour la rédaction et l'analyse), Cowork (Projects, mémoire de projet, fichiers attachés), Code (Claude Code CLI pour générer et refactorer). Les trois usages, dans la même journée.",
        },
        {
          title: "Workflows IA avancés",
          description:
            "Prompts longs et structurés, system prompts, tool use, premiers agents — au-delà de la simple « question dans une boîte de chat ».",
        },
        {
          title: "Volet Code pour équipes tech",
          description:
            "Claude Code en CLI : génération de code, refactoring, lecture de codebase, intégration dans le flow git existant — gain de productivité dev mesurable.",
        },
        {
          title: "Outil-spécifique, pas générique",
          description:
            "Contrairement à une formation IA générale, on creuse uniquement Claude. Vous ressortez expert·e d'un outil — pas survoleur·euse de cinq.",
        },
      ],
      metrics: [
        { number: "3", suffix: "volets", label: "Chat · Cowork · Code" },
        { number: "1", suffix: "outil", label: "Claude (Anthropic), en profondeur" },
        { number: "100", suffix: "%", label: "Pratique sur vos cas réels" },
      ],
      faqs: [
        {
          id: "why-claude",
          question: "Pourquoi une formation dédiée à Claude ?",
          answer:
            "Parce qu'une formation générique « tous les chatbots IA » survole. Claude (Anthropic) a des particularités fortes (Projects, mémoire, fichiers, Code CLI) qui méritent une journée dédiée pour vraiment exploiter le potentiel.",
        },
        {
          id: "code-track",
          question: "Le volet Code est-il obligatoire ?",
          answer:
            "Non. Si votre équipe n'est pas tech, le volet Code peut être remplacé par un approfondissement Cowork (Projects multi-fichiers, usages IA métier avancés). Le call de cadrage adapte les 3 volets à votre contexte.",
        },
        {
          id: "level",
          question: "Faut-il déjà utiliser Claude ?",
          answer:
            "Non. La journée part du niveau zéro et monte progressivement. Si vos équipes ont déjà une pratique, on accélère et on creuse plus loin.",
        },
        {
          id: "tools",
          question: "Faut-il des comptes Claude payants ?",
          answer:
            "Recommandé pour la journée (Claude Pro / Team) — sinon les fonctionnalités Projects et Code ne sont pas accessibles. On peut conseiller le bon plan dans le call de cadrage.",
        },
      ],
      ctaBlockTitle: "Maîtrisez Claude (Anthropic) en profondeur",
      ctaBlockDescription: `Réservez la prochaine date — calendrier en temps réel, confirmation immédiate. Tarif fixe ${CLAUDE_PRICE_FR} pour 2 à 8 personnes.`,
      testimonials: [
        {
          id: "cld-t1",
          quote:
            "On utilisait Claude en surface. La journée nous a ouvert Projects et la mémoire de projet — un tout autre niveau de travail.",
          author: "Léa F.",
          role: "Cheffe de projet · scale-up",
          avatar: "/images/reviews/avis-impl-catherine.webp",
          photographer: "Michael Dam",
          photographerUrl: "https://unsplash.com/@michaeldam",
        },
        {
          id: "cld-t2",
          quote:
            "Claude Code adopté par toute l'équipe tech dès le lendemain. Génération, refactoring, lecture de codebase : on ne revient pas en arrière.",
          author: "Antoine B.",
          role: "Lead dev · éditeur de logiciel",
          avatar: "/images/reviews/avis-impl-thomas.webp",
          photographer: "Joseph Gonzalez",
          photographerUrl: "https://unsplash.com/@miracletwentyone",
        },
        {
          id: "cld-t3",
          quote:
            "Prompts longs, structurés, system prompts… j'ai gagné en profondeur d'analyse sur tous mes livrables. Une journée qui se rentabilise vite.",
          author: "Margaux D.",
          role: "Consultante · cabinet de conseil",
          avatar: "/images/reviews/avis-impl-nadia.webp",
          photographer: "Christina @ wocintechchat.com",
          photographerUrl: "https://unsplash.com/@wocintechchat",
        },
      ],
      metaSeo: {
        title: "Expert Claude (Anthropic) · Formation IA outil-spécifique · Axion-IA",
        description:
          "Formation sur site dédiée à Claude (Anthropic) : Chat (rédaction, analyse, synthèse), Cowork (Projects, fichiers, mémoire) et Code (CLI). Groupe 2-8 personnes. Tarif fixe.",
      },
    },
    en: {
      ...makeEn({
        eyebrow: "Tool-specific intervention · Claude (Anthropic) · 1 day",
        title: "Claude intervention",
        titleEm: "Chat · Cowork · Code",
        answer: `A full day 100 % focused on Claude (Anthropic) on site, structured around three practical tracks: Chat (writing, analysis, synthesis), Cowork (Projects, files, project memory) and Code (Claude Code CLI, code generation and refactoring). Small-group format (2 to 8 people) for maximum depth. Fixed fee ${CLAUDE_PRICE_EN} — direct calendar booking.`,
        ctaPrimary: "Book the Claude Training",
        faqIntro: "Claude teams",
      }),
      benefits: [
        {
          title: "Mastery of all 3 Claude surfaces",
          description:
            "Chat (web/app for writing and analysis), Cowork (Projects, project memory, file attachments), Code (Claude Code CLI to generate and refactor). All three uses, in the same day.",
        },
        {
          title: "Advanced AI workflows",
          description:
            "Long structured prompts, system prompts, tool use, first agents — beyond the simple 'question in a chat box'.",
        },
        {
          title: "Code track for tech teams",
          description:
            "Claude Code CLI: code generation, refactoring, codebase reading, integration into existing git flow — measurable dev productivity gains.",
        },
        {
          title: "Tool-specific, not generic",
          description:
            "Unlike a general AI training, we dig only into Claude. You leave expert on one tool — not a tourist of five.",
        },
      ],
      metrics: [
        { number: "3", suffix: "tracks", label: "Chat · Cowork · Code" },
        { number: "1", suffix: "tool", label: "Claude (Anthropic), in depth" },
        { number: "100", suffix: "%", label: "Hands-on on your real cases" },
      ],
      faqs: [
        {
          id: "why-claude",
          question: "Why a Claude-specific training?",
          answer:
            "Because a generic 'all AI chatbots' training stays surface. Claude (Anthropic) has strong specifics (Projects, memory, files, Code CLI) that deserve a dedicated day to truly tap the potential.",
        },
        {
          id: "code-track",
          question: "Is the Code track mandatory?",
          answer:
            "No. If your team isn't tech, the Code track can be replaced with deeper Cowork (multi-file Projects, advanced business AI usages). The framing call adapts the 3 tracks to your context.",
        },
        {
          id: "level",
          question: "Do we need to already use Claude?",
          answer:
            "No. The day starts from zero and ramps up. If your teams already practice, we accelerate and go further.",
        },
        {
          id: "tools",
          question: "Do we need paid Claude accounts?",
          answer:
            "Recommended for the day (Claude Pro / Team) — otherwise Projects and Code features aren't accessible. We can advise on the right plan in the framing call.",
        },
      ],
      ctaBlockTitle: "Master Claude (Anthropic) in depth",
      ctaBlockDescription: `Book the next date — live calendar, instant confirmation. Fixed fee ${CLAUDE_PRICE_EN} for 2 to 8 people.`,
      metaSeo: {
        title: "Claude (Anthropic) Expert Training · AI Tool-specific Session · Axion-IA",
        description:
          "On-site training dedicated to Claude (Anthropic): Chat (writing, analysis), Cowork (Projects, files, memory) and Code (CLI). Groups of 2-8 people. Fixed fee.",
      },
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
          "Oui — la formation est standardisée et conçue pour s'adresser à tous les profils. Aucun pré-requis IA. Un call de cadrage en visio avant la journée valide l'adéquation.",
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
            "IA quotidienne. L'intervention pousse vers les agents, des usages IA avancés sur mesure, les use cases avancés et la diffusion à toute l'organisation.",
        },
      ],
    },
    metaSeo: {
      title: `${args.title} · cabinet Axion-IA`,
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
          "Yes — the training is standardised and designed for all profiles. No AI prerequisites. A framing video call before the day confirms the fit.",
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
      title: `${args.title} · Axion-IA consultancy`,
      description: args.answer.slice(0, 160),
    },
  };
}
