// Content pack — Module 3 Implémentation IA (10 pages).
// Purple #7a3dff accent. Source: docs 04 + 22.
// Sprint 7 baseline. Note: ban du mot « formation » levé 2026-05-07 (ADR
// `axionia/docs/adr/0003-lift-formation-ban.md`) — vocabulaire libre désormais.
// Sprint 14.10.5 (2026-05-08) : prix IA custom dérivés de pricing.ts (SSOT).
// 2026-08-15 : les `answer` FR, les 3 paliers de maturité et le titre de la
// section chiffrée disent désormais CE QUI EST LIVRÉ — ce qui tourne en
// production, la documentation, la reprise en main par vos équipes — plutôt que
// des bénéfices vagues. L'implémentation est une prestation de CONSEIL (pas une
// action de formation) : aucune garantie de résultat, aucun chiffre de
// performance inventé. Les blocs `benefits` / `metrics` / `faqs` FR restent
// portés par `implementation-fr-overrides.ts` (les valeurs ci-dessous ne sont
// que le repli de forme).

import { IMPLEMENTATION_TIERS, formatAmountRange, getTierById } from "./pricing";
import { IMPL_FR_OVERRIDES } from "./implementation-fr-overrides";

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
  /** Optionnel — 3 avis représentatifs distincts (rendus par ProductPageTemplate). */
  testimonials?: ReadonlyArray<{
    id: string;
    quote: string;
    author: string;
    role: string;
    /** Portrait Unsplash réutilisé (crédit photographe obligatoire). */
    avatar?: string;
    photographer?: string;
    photographerUrl?: string;
  }>;
  /** Optionnel — section "Pourquoi ce cas d'usage" (rendue après le hero). */
  why?: {
    title: string;
    /** Portion de fin du titre, mise en valeur terracotta italique serif. */
    titleEm?: string;
    intro?: string;
    points: ReadonlyArray<{ title: string; description: string }>;
  };
  metaSeo: { title: string; description: string };
}

export const IMPLEMENTATIONS: ReadonlyArray<ImplementationContent> = [
  {
    slug: "ia-custom",
    pathFr: "/implementation/ia-custom",
    pathEn: "/implementation/custom-ai",
    fr: makeFr({
      ...IMPL_FR_OVERRIDES["ia-custom"],
      eyebrow: "Service premium · Module 3",
      title: `IA custom d'entreprise (${IA_CUSTOM_RANGE_FR})`,
      answer: `Implémentation IA sur mesure pour grands comptes : modèles ajustés à vos données, intégration profonde dans vos systèmes, équipe dédiée. Vous repartez avec la solution en production, son code, ses pipelines et sa documentation d'exploitation, hébergés dans votre périmètre. Tarif sur devis, livraison ${IA_CUSTOM_TIER.durationFr}.`,
    }),
    en: makeEn({
      eyebrow: "Premium service · Module 3",
      title: `Custom enterprise AI (${IA_CUSTOM_RANGE_EN})`,
      answer: `Tailor-made AI implementation for large accounts: models fine-tuned on your data, deep integration into your systems, dedicated team. Pricing on request, ${IA_CUSTOM_TIER.durationEn} delivery.`,
    }),
  },
  {
    slug: "chatbot",
    pathFr: "/implementation/chatbot",
    pathEn: "/implementation/chatbot",
    fr: makeFr({
      ...IMPL_FR_OVERRIDES["chatbot"],
      eyebrow: "Implémentation IA · Module 3",
      title: "Chatbots IA pour entreprise",
      answer:
        "Déploiement de chatbots IA d'entreprise : SAV, support interne, qualification de leads. À la livraison : l'assistant branché sur vos canaux (Slack, Teams, site web), une base de connaissances RAG que vos équipes mettent à jour elles-mêmes, des règles d'escalade écrites et le suivi des conversations.",
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
      ...IMPL_FR_OVERRIDES["processus"],
      eyebrow: "Implémentation IA · Module 3",
      title: "Automatiser vos processus métier",
      answer:
        "Automatisation IA de processus métier : ordres de mission, validations, reporting, workflows conditionnels. Le flux tourne en production, branché sur vos outils (CRM, ERP, mail, calendrier) ; vous gardez le code, la documentation, les seuils de validation et le journal des exécutions.",
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
      ...IMPL_FR_OVERRIDES["structuration"],
      eyebrow: "Implémentation IA · Module 3",
      title: "Structurer vos données métier",
      answer:
        "Mise en forme de données non structurées (e-mails, PDF, contrats, factures) en JSON exploitable. Vous récupérez le pipeline de parsing, le schéma de données validé champ par champ, les règles de contrôle qualité et la file de relecture des cas douteux, poussés vers vos systèmes.",
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
      ...IMPL_FR_OVERRIDES["crm-erp"],
      eyebrow: "Implémentation IA · Module 3",
      title: "IA pour CRM et ERP",
      answer:
        "Greffer de l'IA sur votre CRM/ERP : enrichissement de fiches, scoring de leads, prévisions de ventes, génération de comptes-rendus. Sans migration : les scores et les synthèses s'écrivent dans vos propres champs, et les connecteurs vous restent documentés. Compatible Salesforce, HubSpot, Sage, Cegid, Microsoft Dynamics.",
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
      ...IMPL_FR_OVERRIDES["documents"],
      eyebrow: "Implémentation IA · Module 3",
      title: "Génération et analyse documentaire IA",
      answer:
        "Production assistée de documents (devis, contrats, comptes-rendus) à partir de vos modèles et de vos données métier. Lecture IA des pièces entrantes pour extraction, classement et rattachement au bon dossier ; corpus indexé et recherche par le sens, chaque réponse citant son document source.",
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
      ...IMPL_FR_OVERRIDES["agents"],
      eyebrow: "Implémentation IA · Module 3",
      title: "Agents IA autonomes",
      answer:
        "Déploiement d'agents IA capables d'enchaîner plusieurs étapes : recherche, synthèse, action sur vos systèmes. Cas d'usage : prospection, support, veille concurrentielle, opérations. L'agent démarre en mode suggestion, passe en autonomie une fois son comportement vérifié, et journalise chaque décision ; son code et ses prompts vous sont livrés.",
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
      ...IMPL_FR_OVERRIDES["integrations"],
      eyebrow: "Implémentation IA · Module 3",
      title: "Intégrations IA + outils existants",
      answer:
        "Connecteurs IA vers vos outils : Slack, Teams, Notion, Airtable, Google Workspace, mail. APIs documentées, authentification à portée limitée, reprise sur erreur, plafonds de coûts par flux et tableau de suivi de la dépense — un outil de plus se relie sans tout refaire.",
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
      ...IMPL_FR_OVERRIDES["no-code"],
      eyebrow: "Implémentation IA · Module 3 · Sur demande",
      title: "IA dans vos outils no-code existants",
      answer:
        "Sur demande client uniquement : si votre équipe utilise déjà n8n, Make, Zapier, Bubble ou Airtable, nous y intégrons l'IA proprement. Vous récupérez des scénarios documentés, un nommage clair et la main sur vos automatisations. Notre approche par défaut reste le code custom (souveraineté des données, zéro lock-in éditeur, coûts maîtrisés à l'échelle). Voir notre position sur le sujet en FAQ globale.",
    }),
    en: makeEn({
      eyebrow: "Implémentation IA · Module 3 · Sur demande",
      title: "IA dans vos outils no-code existants",
      answer:
        "Sur demande client uniquement : si votre équipe utilise déjà n8n, Make, Zapier, Bubble ou Airtable, nous y intégrons l'IA proprement. Vous récupérez des scénarios documentés, un nommage clair et la main sur vos automatisations. Notre approche par défaut reste le code custom (souveraineté des données, zéro lock-in éditeur, coûts maîtrisés à l'échelle). Voir notre position sur le sujet en FAQ globale.",
    }),
  },
];

export function getImplementation(slug: ImplementationSlug): ImplementationContent {
  const found = IMPLEMENTATIONS.find((i) => i.slug === slug);
  if (!found) throw new Error(`Unknown implementation slug: ${slug}`);
  return found;
}

/**
 * Tronque proprement une meta description à ≤155 caractères (best practice SEO
 * 2026 : Google rend ~155-160 car desktop). Coupe à une frontière de phrase si
 * possible, sinon au dernier mot — jamais au milieu d'un mot, sans ponctuation
 * orpheline. Remplace l'ancien `answer.slice(0, 160)` (coupe brute > 155).
 */
function clampMeta(text: string, max = 155): string {
  if (text.length <= max) return text;
  const window = text.slice(0, max + 1);
  // Frontière de phrase (. ! ?) la plus tardive qui tient dans la fenêtre.
  let sentenceEnd = -1;
  const re = /[.!?](?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(window)) !== null) {
    if (m.index <= max && m.index >= 80) sentenceEnd = m.index;
  }
  if (sentenceEnd >= 0) return text.slice(0, sentenceEnd + 1).trim();
  // Sinon : dernier espace, ponctuation orpheline retirée.
  let cut = text.lastIndexOf(" ", max);
  if (cut < 80) cut = max;
  let out = text
    .slice(0, cut)
    .replace(/[\s,;:.\-–—(«"']+$/u, "")
    .trim();
  while (out.length > max) {
    const sp = out.lastIndexOf(" ");
    out = (sp > 80 ? out.slice(0, sp) : out.slice(0, max))
      .replace(/[\s,;:.\-–—(«"']+$/u, "")
      .trim();
  }
  return out;
}

function makeFr(args: {
  eyebrow: string;
  title: string;
  answer: string;
  // Overrides FR par sous-page (dé-duplication 2026-06-02). Si absents, on
  // retombe sur les valeurs partagées ci-dessous. EN garde les défauts
  // (non live, 301→FR ; traduction prévue dans plusieurs mois).
  benefits?: PageCopy["benefits"];
  processSteps?: PageCopy["processSteps"];
  metrics?: PageCopy["metrics"];
  faqs?: PageCopy["faqs"];
  maturityIntro?: string;
  ctaBlockTitle?: string;
  ctaBlockDescription?: string;
  testimonials?: PageCopy["testimonials"];
  why?: PageCopy["why"];
}): PageCopy {
  return {
    eyebrow: args.eyebrow,
    title: args.title,
    answer: args.answer,
    ctaPrimary: "Décrire mon besoin",
    ctaSecondary: "Voir les cas concrets",
    benefitsTitle: "Ce que vous obtenez",
    benefits: args.benefits ?? [
      {
        title: "Spécification chiffrée",
        description: "Périmètre, jalons et budget fermés par écrit avant tout démarrage.",
      },
      {
        title: "Une solution qui tourne",
        description: "Mise en production progressive, testée sur vos cas réels.",
      },
      {
        title: "Hand-off documenté",
        description: "Code, documentation, runbook et 30 j de support après livraison.",
      },
    ],
    processTitle: "Comment ça se déroule",
    processSteps: args.processSteps ?? [
      { title: "Cadrage", description: "1 sprint de cadrage technique + budget chiffré." },
      { title: "Build", description: "Sprints itératifs avec démo et validation." },
      { title: "Déploiement", description: "Mise en production progressive, tests utilisateurs." },
      { title: "Support 30 j", description: "Maintenance corrective + évolutions mineures." },
    ],
    // « Repères chiffrés » et non « Résultats observés » : ces chiffres sont des
    // ordres de grandeur de LIVRAISON (délais, couverture, périmètre), pas des
    // performances constatées chez des clients. Ne pas y réintroduire de gain de
    // productivité chiffré — les CGV posent une obligation de moyens.
    metricsTitle: "Repères chiffrés",
    metrics: args.metrics ?? [
      { number: "4-12", suffix: "sem", label: "Délai de livraison" },
      { number: "100", suffix: "%", label: "Livrables documentés" },
      { number: "30", suffix: "j", label: "Support post-livraison" },
    ],
    faqTitle: "Questions fréquentes",
    faqs: args.faqs ?? [
      {
        id: "fit",
        question: "Comment savoir si c'est adapté à mon entreprise ?",
        answer:
          "Démarrez par un audit (Module 2) ou une formation collective (Module 1) pour cadrer le besoin.",
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
    ctaBlockTitle: args.ctaBlockTitle ?? "Prête à industrialiser un usage IA ?",
    ctaBlockDescription:
      args.ctaBlockDescription ??
      "Demandez un devis — réponse sous 48 h ouvrées avec spécification chiffrée du projet.",
    maturity: {
      eyebrow: "Pour qui ça marche",
      title: "Trois niveaux de maturité technique",
      intro:
        args.maturityIntro ??
        "L'implémentation s'adapte à l'état de votre stack et de vos équipes. On part de votre point de départ, pas d'un état idéal théorique.",
      levels: [
        {
          rank: 1,
          name: "Découverte",
          description:
            "Aucune intégration IA en production. On part de zéro sur un premier périmètre restreint : à l'arrivée, un cas qui tourne pour de vrai, sa documentation et la prise en main par vos équipes.",
        },
        {
          rank: 2,
          name: "En cours",
          description:
            "Premiers POC ou outils SaaS IA isolés. On industrialise l'existant et on le connecte au reste de votre stack (CRM, ERP, entrepôt de données) : un flux stable, monitoré, dont vous gardez le code et les clés.",
        },
        {
          rank: 3,
          name: "Avancée",
          description:
            "IA en production sur plusieurs cas. On intervient sur les sujets complexes (RAG custom, agents, fine-tuning ciblé) et on transmet : documentation d'exploitation, procédures de mise à jour, passation à vos équipes.",
        },
      ],
    },
    ...(args.testimonials ? { testimonials: args.testimonials } : {}),
    ...(args.why ? { why: args.why } : {}),
    metaSeo: {
      title: `${args.title} · Implémentation IA · Axion-IA`,
      description: clampMeta(args.answer, 155),
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
        answer: "Start with an audit (Module 2) or a group training (Module 1) to frame the need.",
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
      description: clampMeta(args.answer, 155),
    },
  };
}
