// Content pack — Module 1 Interventions entreprise (6 pages).
// Webflow Blue accent. Source de vérité copy: docs 03 + 21 + 16.
// Sprint 5 ships placeholders that pass the banned-word check; finer copy
// iteration belongs to Sprint 9 polish.

import type { Locale } from "@/i18n/routing";

export type InterventionSlug = "essentielle" | "equipes" | "managers" | "conference" | "dirigeants";

interface InterventionContent {
  slug: InterventionSlug;
  pathFr: string;
  pathEn: string;
  fr: PageCopy;
  en: PageCopy;
}

interface PageCopy {
  eyebrow: string;
  title: string;
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
  metaSeo: { title: string; description: string };
}

export const INTERVENTIONS: ReadonlyArray<InterventionContent> = [
  {
    slug: "essentielle",
    pathFr: "/interventions/essentielle",
    pathEn: "/interventions/essential",
    fr: {
      eyebrow: "Offre phare · Module 1",
      title: "L'intervention IA Essentielle",
      answer:
        "Une journée d'intervention sur site avec votre équipe : diagnostic, démonstrations IA appliquées à votre métier, plan d'action chiffré pour les 90 jours suivants. Livrable : feuille de route + 3 quick-wins implémentables dès le lendemain. Tous secteurs, tous niveaux, à partir de 490 € HT.",
      priceEur: 490,
      ctaPrimary: "Réserver une intervention",
      ctaSecondary: "Voir les cas concrets",
      benefitsTitle: "Ce que vous obtenez",
      benefits: [
        {
          title: "Plan d'action chiffré 90 jours",
          description:
            "Liste priorisée d'usages IA pour votre entreprise, avec ROI estimé et complexité.",
        },
        {
          title: "3 quick-wins opérationnels",
          description:
            "Démonstrations live sur vos données réelles, prêtes à reprendre dès le lendemain.",
        },
        {
          title: "30 jours de support",
          description: "Échanges asynchrones illimités pour itérer sur les premiers déploiements.",
        },
      ],
      processTitle: "Comment ça se déroule",
      processSteps: [
        {
          title: "Préparation",
          description: "Brief de 30 min en visio J-7. Vous nous transmettez 3 process cibles.",
        },
        {
          title: "Jour J · matin",
          description: "Diagnostic + démo IA appliquée à votre métier sur vos données.",
        },
        {
          title: "Jour J · après-midi",
          description: "Co-construction du plan d'action 90 jours avec votre équipe.",
        },
        {
          title: "Suivi 30 j",
          description: "Support asynchrone + check-in à J+30 pour valider l'avancement.",
        },
      ],
      metricsTitle: "Résultats observés",
      metrics: [
        { number: "+38", suffix: "%", label: "ROI moyen sur 90 jours" },
        { number: "2.4", suffix: "h/jour", label: "Temps gagné par collaborateur" },
        { number: "11", suffix: "cas", label: "Études concrètes publiées" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "duration",
          question: "Quelle est la durée de l'intervention ?",
          answer:
            "Une journée complète sur site (9 h - 17 h), brief inclus J-7 (30 min visio) et suivi 30 j inclus.",
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
            "Un plan d'action chiffré + 3 démos prêtes à reprendre + 30 jours de support pour itérer.",
        },
      ],
      ctaBlockTitle: "Prête à démarrer concrètement avec l'IA ?",
      ctaBlockDescription:
        "Réservez la prochaine intervention disponible. Le calendrier maison affiche les créneaux en temps réel.",
      metaSeo: {
        title: "Intervention IA Essentielle · cabinet AxionIA · 490 € HT",
        description:
          "Une journée d'intervention IA sur site : diagnostic, 3 démos opérationnelles, plan 90 jours chiffré + 30 j de support. Tous secteurs, tous niveaux.",
      },
    },
    en: {
      eyebrow: "Flagship offering · Module 1",
      title: "The Essential AI session",
      answer:
        "A one-day on-site session with your team: diagnostic, applied AI demos on your domain, costed 90-day action plan. Deliverable: roadmap + 3 quick-wins your team can pick up on day two. All industries, all levels, from €490 (excl. VAT).",
      priceEur: 490,
      ctaPrimary: "Book a session",
      ctaSecondary: "See case studies",
      benefitsTitle: "What you get",
      benefits: [
        {
          title: "Costed 90-day plan",
          description: "Prioritized AI use cases with estimated ROI and complexity.",
        },
        {
          title: "3 operational quick-wins",
          description: "Live demos on your real data, ready to resume the next day.",
        },
        {
          title: "30 days of support",
          description: "Unlimited async exchanges to iterate on first deployments.",
        },
      ],
      processTitle: "How it runs",
      processSteps: [
        { title: "Prep", description: "30-min remote brief at D-7. Share 3 target processes." },
        { title: "Day · morning", description: "Diagnostic + applied AI demo on your data." },
        {
          title: "Day · afternoon",
          description: "Co-build the 90-day action plan with your team.",
        },
        {
          title: "30-day follow-up",
          description: "Async support + D+30 check-in to validate progress.",
        },
      ],
      metricsTitle: "Observed results",
      metrics: [
        { number: "+38", suffix: "%", label: "Average 90-day ROI" },
        { number: "2.4", suffix: "h/day", label: "Time saved per employee" },
        { number: "11", suffix: "cases", label: "Published case studies" },
      ],
      faqTitle: "Frequently asked",
      faqs: [
        {
          id: "duration",
          question: "How long is the session?",
          answer:
            "A full day on site (9 a.m. - 5 p.m.), including a 30-min remote brief at D-7 and a 30-day follow-up.",
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
            "A costed action plan + 3 demos ready to resume + 30 days of support for iteration.",
        },
      ],
      ctaBlockTitle: "Ready to start concretely with AI?",
      ctaBlockDescription:
        "Book the next available session. The on-site calendar shows live availability.",
      metaSeo: {
        title: "Essential AI session · AxionIA consultancy · €490 (excl. VAT)",
        description:
          "A one-day on-site AI session: diagnostic, 3 operational demos, costed 90-day plan + 30 days of support. All industries, all levels.",
      },
    },
  },
  {
    slug: "equipes",
    pathFr: "/interventions/equipes",
    pathEn: "/interventions/teams",
    fr: makeFr({
      eyebrow: "Cible : équipes & salariés (11+)",
      title: "Vos équipes gagnent 1h par jour",
      answer:
        "Une journée d'intervention dédiée aux équipes opérationnelles (11+ collaborateurs). Cas d'usage IA concrets, ateliers pratiques, plan d'adoption progressif. À l'issue, chaque participant repart avec 3 outils déployés sur son poste.",
      ctaPrimary: "Demander un devis équipes",
      faqIntro: "équipes",
    }),
    en: makeEn({
      eyebrow: "Audience: teams & staff (11+)",
      title: "Your teams save 1h a day",
      answer:
        "A one-day session dedicated to operational teams (11+ members). Concrete AI use cases, hands-on workshops, gradual adoption plan. By the end, each participant leaves with 3 tools deployed on their workstation.",
      ctaPrimary: "Request a team quote",
      faqIntro: "teams",
    }),
  },
  {
    slug: "managers",
    pathFr: "/interventions/managers",
    pathEn: "/interventions/managers",
    fr: makeFr({
      eyebrow: "Cible : managers",
      title: "Réduire vos coûts cachés",
      answer:
        "Une journée pour managers : identifier les coûts cachés (réunions, reporting, validations) et y substituer des automatismes IA. Plan d'action chiffré centré sur le ROI managérial. Mesure d'impact à 90 jours.",
      ctaPrimary: "Réserver l'intervention managers",
      faqIntro: "managers",
    }),
    en: makeEn({
      eyebrow: "Audience: managers",
      title: "Cut your hidden costs",
      answer:
        "A manager-focused day: identify hidden costs (meetings, reporting, sign-offs) and replace them with AI automations. ROI-driven, costed action plan. 90-day impact tracking.",
      ctaPrimary: "Book the manager session",
      faqIntro: "managers",
    }),
  },
  {
    slug: "conference",
    pathFr: "/interventions/conference",
    pathEn: "/interventions/conference",
    fr: makeFr({
      eyebrow: "Format : ½ journée conférence",
      title: "Ce que l'IA peut faire pour VOUS",
      answer:
        "Conférence d'1/2 journée tous niveaux : panorama clair des usages IA réellement opérationnels en 2026, démos live, sessions Q&A. Format pensé pour acculturer rapidement un grand groupe (jusqu'à 100 personnes).",
      ctaPrimary: "Demander un devis conférence",
      faqIntro: "conférence",
    }),
    en: makeEn({
      eyebrow: "Format: half-day talk",
      title: "What AI can do for YOU",
      answer:
        "A half-day talk for all levels: clear panorama of AI uses actually operational in 2026, live demos, Q&A. Designed to quickly upskill a large group (up to 100 attendees).",
      ctaPrimary: "Request a talk quote",
      faqIntro: "talk",
    }),
  },
  {
    slug: "dirigeants",
    pathFr: "/interventions/dirigeants",
    pathEn: "/interventions/executives",
    fr: makeFr({
      eyebrow: "Cible : dirigeants & CODIR",
      title: "Devenir une entreprise IA",
      answer:
        "Une journée stratégique pour dirigeants et comité de direction : positionnement IA de l'entreprise, choix d'investissements à 12-24 mois, gouvernance, gestion des risques. Plan stratégique chiffré, validé en séance.",
      ctaPrimary: "Réserver l'intervention CODIR",
      faqIntro: "dirigeants",
    }),
    en: makeEn({
      eyebrow: "Audience: executives & CODIR",
      title: "Becoming an AI company",
      answer:
        "A strategic day for executives and the leadership committee: AI positioning, 12-24 month investment choices, governance, risk management. Costed strategic plan, validated in session.",
      ctaPrimary: "Book the executive session",
      faqIntro: "executives",
    }),
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
  answer: string;
  ctaPrimary: string;
  faqIntro: string;
}): PageCopy {
  return {
    eyebrow: args.eyebrow,
    title: args.title,
    answer: args.answer,
    ctaPrimary: args.ctaPrimary,
    ctaSecondary: "Voir l'Essentielle 490 €",
    benefitsTitle: "Ce que vous obtenez",
    benefits: [
      {
        title: "Plan d'action chiffré",
        description: "Priorisé selon votre maturité IA et vos contraintes.",
      },
      {
        title: "Démos opérationnelles",
        description: "Sur vos données réelles, prêtes à reprendre dès le lendemain.",
      },
      {
        title: "30 jours de support",
        description: "Itérations asynchrones pour valider les premiers déploiements.",
      },
    ],
    processTitle: "Comment ça se déroule",
    processSteps: [
      { title: "Préparation", description: "Brief 30 min visio à J-7." },
      { title: "Jour J", description: "Intervention sur site, format adapté à la cible." },
      { title: "Suivi 30 j", description: "Check-in J+30 + support asynchrone." },
    ],
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
          "Oui — un brief J-7 personnalise le contenu à votre contexte exact. Aucun pré-requis IA.",
      },
      {
        id: "support",
        question: "Quel suivi après l'intervention ?",
        answer:
          "30 jours de support asynchrone + check-in à J+30 pour valider l'avancement des quick-wins.",
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
    metaSeo: {
      title: `${args.title} · cabinet AxionIA`,
      description: args.answer.slice(0, 160),
    },
  };
}

function makeEn(args: {
  eyebrow: string;
  title: string;
  answer: string;
  ctaPrimary: string;
  faqIntro: string;
}): PageCopy {
  return {
    eyebrow: args.eyebrow,
    title: args.title,
    answer: args.answer,
    ctaPrimary: args.ctaPrimary,
    ctaSecondary: "See the Essential €490",
    benefitsTitle: "What you get",
    benefits: [
      {
        title: "Costed action plan",
        description: "Prioritized to your AI maturity and constraints.",
      },
      {
        title: "Operational demos",
        description: "On your real data, ready to resume the next day.",
      },
      {
        title: "30 days of support",
        description: "Async iterations to validate first deployments.",
      },
    ],
    processTitle: "How it runs",
    processSteps: [
      { title: "Prep", description: "30-min remote brief at D-7." },
      { title: "Day", description: "On-site session adapted to the audience." },
      { title: "30-day follow-up", description: "D+30 check-in + async support." },
    ],
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
        answer: "Yes — a D-7 brief tailors the content to your exact context. No AI prerequisites.",
      },
      {
        id: "support",
        question: "What follow-up after the session?",
        answer: "30 days of async support + D+30 check-in to validate quick-win progress.",
      },
      {
        id: "remote",
        question: "Can it run remotely?",
        answer: "On-site recommended for workshops. Remote format on request (adjusted quote).",
      },
    ],
    ctaBlockTitle: "Ready to start?",
    ctaBlockDescription: "Request a quote — reply within 48 business hours.",
    metaSeo: {
      title: `${args.title} · AxionIA consultancy`,
      description: args.answer.slice(0, 160),
    },
  };
}
