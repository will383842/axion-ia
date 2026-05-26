// Content pack — Module 3 Implémentation IA (10 pages).
// Purple #7a3dff accent. Source: docs 04 + 22.
// Sprint 7 baseline. Note: ban du mot « formation » levé 2026-05-07 (ADR
// `axionia/docs/adr/0003-lift-formation-ban.md`) — vocabulaire libre désormais.
// Sprint 14.10.5 (2026-05-08) : prix IA custom dérivés de pricing.ts (SSOT).

import { IMPLEMENTATION_TIERS, formatAmount, formatAmountRange, getTierById } from "./pricing";

const IA_CUSTOM_TIER = getTierById(IMPLEMENTATION_TIERS, "impl-ia-custom");
const IA_CUSTOM_RANGE_FR = formatAmountRange(
  IA_CUSTOM_TIER.priceMin!,
  IA_CUSTOM_TIER.priceMax!,
  "fr",
  { compact: true },
);
const IA_CUSTOM_RANGE_EN = formatAmountRange(
  IA_CUSTOM_TIER.priceMin!,
  IA_CUSTOM_TIER.priceMax!,
  "en",
  { compact: true },
);

export type ImplementationSlug =
  | "ia-custom"
  | "chatbot"
  | "processus"
  | "structuration"
  | "crm-erp"
  | "documents"
  | "agents"
  | "integrations"
  | "no-code";

interface ImplementationContent {
  slug: ImplementationSlug;
  pathFr: string;
  pathEn: string;
  fr: PageCopy;
  en: PageCopy;
}

interface PageCopy {
  eyebrow: string;
  title: string;
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
}

export const IMPLEMENTATIONS: ReadonlyArray<ImplementationContent> = [
  {
    slug: "ia-custom",
    pathFr: "/implementation/ia-custom",
    pathEn: "/implementation/custom-ai",
    fr: makeFr({
      eyebrow: "Service premium · Module 3",
      title: `IA custom d'entreprise (${IA_CUSTOM_RANGE_FR})`,
      answer: `Implémentation IA sur mesure pour grands comptes : modèles fine-tuned sur vos données, intégration profonde dans vos systèmes, équipe dédiée. Prestations ${formatAmount(IA_CUSTOM_TIER.priceMin!, "fr", { compact: true })} à ${formatAmount(IA_CUSTOM_TIER.priceMax!, "fr")}, livraison ${IA_CUSTOM_TIER.durationFr}.`,
    }),
    en: makeEn({
      eyebrow: "Premium service · Module 3",
      title: `Custom enterprise AI (${IA_CUSTOM_RANGE_EN})`,
      answer: `Tailor-made AI implementation for large accounts: models fine-tuned on your data, deep integration into your systems, dedicated team. Engagements ${formatAmount(IA_CUSTOM_TIER.priceMin!, "en", { compact: true })} to ${formatAmount(IA_CUSTOM_TIER.priceMax!, "en")}, ${IA_CUSTOM_TIER.durationEn} delivery.`,
    }),
  },
  {
    slug: "chatbot",
    pathFr: "/implementation/chatbot",
    pathEn: "/implementation/chatbot",
    fr: makeFr({
      eyebrow: "Implémentation IA · Module 3",
      title: "Chatbots IA pour entreprise",
      answer:
        "Déploiement de chatbots IA d'entreprise : SAV, support interne, qualification de leads. Intégrations Slack/Teams/site web, base de connaissances RAG sur vos documents, monitoring des performances.",
    }),
    en: makeEn({
      eyebrow: "AI implementation · Module 3",
      title: "Enterprise AI chatbots",
      answer:
        "Enterprise AI chatbot rollout: customer support, internal helpdesk, lead qualification. Slack/Teams/web integrations, RAG knowledge base over your documents, performance monitoring.",
    }),
  },
  {
    slug: "processus",
    pathFr: "/implementation/processus",
    pathEn: "/implementation/processes",
    fr: makeFr({
      eyebrow: "Implémentation IA · Module 3",
      title: "Automatiser vos processus métier",
      answer:
        "Automatisation IA de processus métier : ordres de mission, validations, reporting, workflow conditionnels. Connexion à vos outils (CRM, ERP, mail, calendrier). ROI mesurable.",
    }),
    en: makeEn({
      eyebrow: "AI implementation · Module 3",
      title: "Automate your business processes",
      answer:
        "AI process automation: work orders, sign-offs, reporting, conditional workflows. Connection to your tools (CRM, ERP, mail, calendar). Measurable ROI.",
    }),
  },
  {
    slug: "structuration",
    pathFr: "/implementation/structuration",
    pathEn: "/implementation/structuring",
    fr: makeFr({
      eyebrow: "Implémentation IA · Module 3",
      title: "Structurer vos données métier",
      answer:
        "Mise en forme de données non structurées (emails, PDFs, contrats, factures) en JSON exploitable. Pipelines de parsing IA, contrôle qualité, push vers vos systèmes downstream.",
    }),
    en: makeEn({
      eyebrow: "AI implementation · Module 3",
      title: "Structure your business data",
      answer:
        "Turn unstructured data (emails, PDFs, contracts, invoices) into actionable JSON. AI parsing pipelines, quality control, push to your downstream systems.",
    }),
  },
  {
    slug: "crm-erp",
    pathFr: "/implementation/crm-erp",
    pathEn: "/implementation/crm-erp",
    fr: makeFr({
      eyebrow: "Implémentation IA · Module 3",
      title: "IA pour CRM et ERP",
      answer:
        "Greffer de l'IA sur votre CRM/ERP : enrichissement de fiches, scoring leads, prévisions ventes, génération de comptes-rendus. Compatible Salesforce, HubSpot, Sage, Cegid, Microsoft Dynamics.",
    }),
    en: makeEn({
      eyebrow: "AI implementation · Module 3",
      title: "AI for CRM and ERP",
      answer:
        "Graft AI onto your CRM/ERP: record enrichment, lead scoring, sales forecasting, meeting summaries. Compatible with Salesforce, HubSpot, Sage, Microsoft Dynamics.",
    }),
  },
  {
    slug: "documents",
    pathFr: "/implementation/documents",
    pathEn: "/implementation/documents",
    fr: makeFr({
      eyebrow: "Implémentation IA · Module 3",
      title: "Génération et analyse documentaire IA",
      answer:
        "Production assistée de documents (devis, contrats, comptes-rendus) à partir de templates et de données métier. Lecture IA de documents entrants pour extraction et classification automatique.",
    }),
    en: makeEn({
      eyebrow: "AI implementation · Module 3",
      title: "AI document generation & analysis",
      answer:
        "AI-assisted document production (quotes, contracts, minutes) from templates and business data. AI reading of incoming documents for automatic extraction and classification.",
    }),
  },
  {
    slug: "agents",
    pathFr: "/implementation/agents",
    pathEn: "/implementation/agents",
    fr: makeFr({
      eyebrow: "Implémentation IA · Module 3",
      title: "Agents IA autonomes",
      answer:
        "Déploiement d'agents IA capables d'enchaîner plusieurs étapes : recherche, synthèse, action sur vos systèmes. Cas d'usage : prospection, support, veille concurrentielle, opérations.",
    }),
    en: makeEn({
      eyebrow: "AI implementation · Module 3",
      title: "Autonomous AI agents",
      answer:
        "Deployment of AI agents capable of chaining multiple steps: search, synthesis, action on your systems. Use cases: prospecting, support, competitive intel, operations.",
    }),
  },
  {
    slug: "integrations",
    pathFr: "/implementation/integrations",
    pathEn: "/implementation/integrations",
    fr: makeFr({
      eyebrow: "Implémentation IA · Module 3",
      title: "Intégrations IA + outils existants",
      answer:
        "Connecteurs IA vers vos outils : Slack, Teams, Notion, Airtable, Google Workspace, mail. APIs propres, monitoring, gestion des limites de taux et coûts par usage.",
    }),
    en: makeEn({
      eyebrow: "AI implementation · Module 3",
      title: "AI + existing tools integrations",
      answer:
        "AI connectors to your tools: Slack, Teams, Notion, Airtable, Google Workspace, mail. Clean APIs, monitoring, rate limit and per-usage cost management.",
    }),
  },
  {
    slug: "no-code",
    pathFr: "/implementation/no-code",
    pathEn: "/implementation/no-code",
    fr: makeFr({
      eyebrow: "Implémentation IA · Module 3 · Sur demande",
      title: "IA dans vos outils no-code existants",
      answer:
        "Sur demande client uniquement : si votre équipe utilise déjà n8n, Make, Zapier, Bubble ou Airtable, nous y intégrons l'IA proprement. Notre approche par défaut reste le code custom (souveraineté des données, zéro lock-in éditeur, performances 10× supérieures). Voir notre position sur le sujet en FAQ globale.",
    }),
    en: makeEn({
      eyebrow: "Implémentation IA · Module 3 · Sur demande",
      title: "IA dans vos outils no-code existants",
      answer:
        "Sur demande client uniquement : si votre équipe utilise déjà n8n, Make, Zapier, Bubble ou Airtable, nous y intégrons l'IA proprement. Notre approche par défaut reste le code custom (souveraineté des données, zéro lock-in éditeur, performances 10× supérieures). Voir notre position sur le sujet en FAQ globale.",
    }),
  },
];

export function getImplementation(slug: ImplementationSlug): ImplementationContent {
  const found = IMPLEMENTATIONS.find((i) => i.slug === slug);
  if (!found) throw new Error(`Unknown implementation slug: ${slug}`);
  return found;
}

function makeFr(args: { eyebrow: string; title: string; answer: string }): PageCopy {
  return {
    eyebrow: args.eyebrow,
    title: args.title,
    answer: args.answer,
    ctaPrimary: "Demander un devis",
    ctaSecondary: "Voir les cas concrets",
    benefitsTitle: "Ce que vous obtenez",
    benefits: [
      {
        title: "Spécification chiffrée",
        description: "Périmètre, jalons, budgets fermés avant tout démarrage.",
      },
      {
        title: "Implémentation guidée",
        description: "Sprints courts, démos hebdomadaires, validation continue.",
      },
      {
        title: "Hand-off documenté",
        description: "Documentation, runbook, 30 j de support post-livraison.",
      },
    ],
    processTitle: "Comment ça se déroule",
    processSteps: [
      { title: "Cadrage", description: "1 sprint de cadrage technique + budget chiffré." },
      { title: "Build", description: "Sprints itératifs avec démo et validation." },
      { title: "Déploiement", description: "Mise en production progressive, tests utilisateurs." },
      { title: "Support 30 j", description: "Maintenance corrective + évolutions mineures." },
    ],
    metricsTitle: "Résultats observés",
    metrics: [
      { number: "4-12", suffix: "sem", label: "Délai de livraison" },
      { number: "+40", suffix: "%", label: "Productivité moyenne" },
      { number: "30", suffix: "j", label: "Support post-livraison" },
    ],
    faqTitle: "Questions fréquentes",
    faqs: [
      {
        id: "fit",
        question: "Comment savoir si c'est adapté à mon entreprise ?",
        answer:
          "Démarrez par un audit (Module 2) ou une intervention Essentielle (Module 1) pour cadrer le besoin.",
      },
      {
        id: "tech",
        question: "Quelle stack technique ?",
        answer:
          "Mix de modèles open-source et propriétaires selon le cas (Llama, Mistral, GPT-4, Claude). Choix justifié dans le devis.",
      },
      {
        id: "data",
        question: "Mes données sont-elles partagées ?",
        answer:
          "Non. Hébergement UE par défaut. Modèles fine-tuned hébergés chez vous ou sur infra dédiée si requis.",
      },
    ],
    ctaBlockTitle: "Prête à industrialiser un usage IA ?",
    ctaBlockDescription:
      "Demandez un devis — réponse sous 48 h ouvrées avec spécification chiffrée du projet.",
    maturity: {
      eyebrow: "Pour qui ça marche",
      title: "Trois niveaux de maturité technique",
      intro:
        "L'implémentation s'adapte à l'état de votre stack et de vos équipes. On part de votre point de départ, pas d'un état idéal théorique.",
      levels: [
        {
          rank: 1,
          name: "Découverte",
          description:
            "Aucune intégration IA en production. On part de zéro et on déploie un quick-win d'abord — preuve de valeur en 4-6 semaines.",
        },
        {
          rank: 2,
          name: "En cours",
          description:
            "Premiers POCs ou outils SaaS IA isolés. On industrialise et on connecte au reste de votre stack (CRM, ERP, data warehouse).",
        },
        {
          rank: 3,
          name: "Avancée",
          description:
            "IA en production sur plusieurs cas. On apporte expertise sur les sujets complexes (RAG custom, agents, fine-tuning ciblé).",
        },
      ],
    },
    metaSeo: {
      title: `${args.title} · Implémentation IA · Axion-IA`,
      description: args.answer.slice(0, 160),
    },
  };
}

function makeEn(args: { eyebrow: string; title: string; answer: string }): PageCopy {
  return {
    eyebrow: args.eyebrow,
    title: args.title,
    answer: args.answer,
    ctaPrimary: "Request a quote",
    ctaSecondary: "See case studies",
    benefitsTitle: "What you get",
    benefits: [
      {
        title: "Costed spec",
        description: "Scope, milestones, fixed budgets before any kick-off.",
      },
      {
        title: "Guided implementation",
        description: "Short sprints, weekly demos, continuous validation.",
      },
      { title: "Documented hand-off", description: "Docs, runbook, 30-day post-delivery support." },
    ],
    processTitle: "How it runs",
    processSteps: [
      { title: "Framing", description: "1 framing sprint + costed budget." },
      { title: "Build", description: "Iterative sprints with demos and validation." },
      { title: "Deployment", description: "Gradual rollout, user tests." },
      { title: "30-day support", description: "Bug fixes + minor enhancements." },
    ],
    metricsTitle: "Observed results",
    metrics: [
      { number: "4-12", suffix: "wk", label: "Delivery window" },
      { number: "+40", suffix: "%", label: "Average productivity" },
      { number: "30", suffix: "d", label: "Post-delivery support" },
    ],
    faqTitle: "Frequently asked",
    faqs: [
      {
        id: "fit",
        question: "How do I know this fits my company?",
        answer:
          "Start with an audit (Module 2) or an Essential session (Module 1) to frame the need.",
      },
      {
        id: "tech",
        question: "What tech stack?",
        answer:
          "Mix of open-source and proprietary models depending on the case (Llama, Mistral, GPT-4, Claude). Choices justified in the quote.",
      },
      {
        id: "data",
        question: "Is my data shared?",
        answer:
          "No. EU hosting by default. Fine-tuned models hosted with you or on dedicated infra if required.",
      },
    ],
    ctaBlockTitle: "Ready to industrialize an AI use case?",
    ctaBlockDescription:
      "Request a quote — reply within 48 business hours with a costed project specification.",
    maturity: {
      eyebrow: "Who it works for",
      title: "Three technical maturity levels",
      intro:
        "Implementation adapts to your stack and your team — we start from where you are, not from an idealised end state.",
      levels: [
        {
          rank: 1,
          name: "Discovery",
          description:
            "No AI integration in production. We start from zero and deploy a quick-win first — proof of value in 4-6 weeks.",
        },
        {
          rank: 2,
          name: "In progress",
          description:
            "Early POCs or isolated AI SaaS tools. We industrialise and connect to the rest of your stack (CRM, ERP, data warehouse).",
        },
        {
          rank: 3,
          name: "Advanced",
          description:
            "AI in production on several cases. We bring expertise on complex topics (custom RAG, agents, targeted fine-tuning).",
        },
      ],
    },
    metaSeo: {
      title: `${args.title} · AI implementation · Axion-IA`,
      description: args.answer.slice(0, 160),
    },
  };
}
