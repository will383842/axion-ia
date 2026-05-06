// Transversal content — about, FAQ, blog fixtures, help (Sprint 9).
// Replaced by Prisma in Sprint 15 for blog/help articles.

export const ABOUT_TIMELINE = [
  {
    id: "2024",
    date: "2024",
    fr: { title: "Création d'AxionIA OÜ", description: "Lancement du cabinet à Tallinn." },
    en: { title: "AxionIA OÜ founded", description: "Consultancy launched in Tallinn." },
  },
  {
    id: "2025",
    date: "2025",
    fr: {
      title: "Premières interventions terrain",
      description: "10 missions opérationnelles, méthodologie itérée et stabilisée.",
    },
    en: {
      title: "First field engagements",
      description: "10 operational missions, methodology iterated and stabilized.",
    },
  },
  {
    id: "2026",
    date: "2026",
    fr: {
      title: "Plateforme axion-ia.com",
      description: "Refonte complète, mobile-first, multilingue FR/EN.",
    },
    en: {
      title: "Platform axion-ia.com",
      description: "Full revamp, mobile-first, FR/EN multilingual.",
    },
  },
] as const;

export const ABOUT_TEAM = [
  {
    id: "will",
    fr: {
      name: "Will",
      role: "Fondateur · lead consultant",
      bio: "10 ans en transformation digitale, opérationnel terrain.",
    },
    en: {
      name: "Will",
      role: "Founder · lead consultant",
      bio: "10 years in digital transformation, hands-on field practice.",
    },
  },
] as const;

export const FAQ_GLOBAL = [
  {
    id: "definition",
    fr: {
      question: "Qu'est-ce qu'AxionIA ?",
      answer:
        "AxionIA est un cabinet IA opérationnel pour entreprises. Nous intervenons sur site (ou à distance) pour identifier, démontrer et implémenter des usages IA générant un ROI mesurable en 90 jours.",
    },
    en: {
      question: "What is AxionIA?",
      answer:
        "AxionIA is an operational AI consultancy for companies. We work on site (or remote) to identify, demonstrate and implement AI use cases generating measurable ROI within 90 days.",
    },
  },
  {
    id: "modules",
    fr: {
      question: "Quels sont les 3 modules ?",
      answer:
        "Module 1 — Interventions sur site (1 journée à partir de 490 €). Module 2 — Audit IA (cartographie + plan, 290-1990 €). Module 3 — Implémentation IA (mise en production, à partir de 990 €).",
    },
    en: {
      question: "What are the 3 modules?",
      answer:
        "Module 1 — On-site sessions (1 day from €490). Module 2 — AI audit (mapping + plan, €290-1990). Module 3 — AI implementation (production deployment, from €990).",
    },
  },
  {
    id: "data-security",
    fr: {
      question: "Mes données sont-elles partagées ?",
      answer:
        "Non. Hébergement UE par défaut (Hetzner Frankfurt). Aucun envoi de données sensibles à des tiers sans consentement explicite. Modèles IA hébergés chez vous ou sur infra dédiée si requis.",
    },
    en: {
      question: "Is my data shared?",
      answer:
        "No. EU hosting by default (Hetzner Frankfurt). No sensitive data sent to third parties without explicit consent. AI models hosted with you or on dedicated infra if required.",
    },
  },
  {
    id: "tools",
    fr: {
      question: "Quels outils IA utilisez-vous ?",
      answer:
        "Mix de modèles open-source (Llama, Mistral) et propriétaires (GPT-4, Claude) selon le cas. Justifié dans chaque devis. Aucun lock-in technologique.",
    },
    en: {
      question: "Which AI tools do you use?",
      answer:
        "Mix of open-source (Llama, Mistral) and proprietary models (GPT-4, Claude) depending on the case. Justified in every quote. No technology lock-in.",
    },
  },
  {
    id: "billing",
    fr: {
      question: "Comment se passe la facturation ?",
      answer:
        "Société estonienne (OÜ). Devis fixe + virement + facture (TVA EE selon résidence). Aucune mensualité, aucun engagement.",
    },
    en: {
      question: "How does billing work?",
      answer:
        "Estonian company (OÜ). Fixed quote + bank transfer + invoice (EU VAT according to residence). No subscriptions, no commitments.",
    },
  },
] as const;

export interface BlogPost {
  slug: string;
  publishedAt: string; // ISO
  readingTime: string;
  category: string;
  fr: { title: string; excerpt: string; body: string };
  en: { title: string; excerpt: string; body: string };
}

export const BLOG_POSTS: ReadonlyArray<BlogPost> = [
  {
    slug: "pourquoi-auditer-avant-implementer",
    publishedAt: "2026-04-12",
    readingTime: "6 min",
    category: "Méthodologie",
    fr: {
      title: "Pourquoi auditer avant d'implémenter",
      excerpt: "L'audit identifie où l'IA crée de la valeur sans casser vos workflows existants.",
      body: "Implémenter de l'IA sans audit revient à ouvrir un projet de digitalisation sans backlog priorisé : on consomme du temps et du budget sur des sujets qui n'ont pas de valeur. L'audit IA AxionIA cartographie en 5 jours toutes les opportunités, scorées par ROI estimé et complexité, livrant un plan d'attaque actionnable.",
    },
    en: {
      title: "Why audit before you implement",
      excerpt:
        "The audit pinpoints where AI creates value without breaking your existing workflows.",
      body: "Implementing AI without an audit is like running a digitalization project without a prioritized backlog: time and budget go to topics that don't drive value. The AxionIA AI audit maps every opportunity in 5 days, scored by estimated ROI and complexity, delivering an actionable plan.",
    },
  },
  {
    slug: "3-quick-wins-2026",
    publishedAt: "2026-04-22",
    readingTime: "8 min",
    category: "Cas d'usage",
    fr: {
      title: "3 quick-wins IA opérationnels en 2026",
      excerpt:
        "Lecture de factures, comptes-rendus de réunion, qualification de leads — déployables en moins d'un mois.",
      body: "En 2026, les modèles IA matures permettent trois quick-wins déployables sous 30 jours dans presque toute organisation : 1) Lecture automatisée des factures entrantes (gain 30-50 % temps comptable). 2) Génération de comptes-rendus de réunions (gain 1-2 h/jour/cadre). 3) Qualification IA des leads entrants (gain 30 % conversion). Chacun coûte moins de 5 000 € à déployer pour une PME.",
    },
    en: {
      title: "3 operational AI quick-wins in 2026",
      excerpt:
        "Invoice reading, meeting minutes, lead qualification — deployable in under a month.",
      body: "In 2026, mature AI models enable three quick-wins deployable within 30 days in almost any organization: 1) Automated reading of incoming invoices (30-50% accounting time savings). 2) Meeting minute generation (1-2h/day/manager savings). 3) AI lead qualification (30% conversion uplift). Each costs less than €5k to deploy for an SME.",
    },
  },
  {
    slug: "ia-custom-quand-vraiment",
    publishedAt: "2026-05-01",
    readingTime: "12 min",
    category: "Stratégie",
    fr: {
      title: "IA Custom : quand est-ce vraiment nécessaire ?",
      excerpt: "À partir de quel moment passer de l'IA générique au fine-tuning sur vos données ?",
      body: "Le fine-tuning IA n'est rarement justifié avant 6-12 mois d'usage de modèles génériques. Les signaux objectifs : volume de données spécifiques métier > 10 k exemples, exigence de latence sous 100 ms, contraintes de souveraineté ou de coût d'inférence. AxionIA déconseille systématiquement le fine-tuning prématuré, qui consomme 8 000 à 50 000 € sans garantie de gain par rapport à du prompt engineering soigné.",
    },
    en: {
      title: "Custom AI: when is it really necessary?",
      excerpt: "When do you move from generic AI to fine-tuning on your data?",
      body: "AI fine-tuning is rarely justified before 6-12 months of using generic models. Objective signals: domain-specific data volume > 10k examples, sub-100ms latency requirement, sovereignty or inference cost constraints. AxionIA systematically discourages premature fine-tuning, which costs €8k-50k with no guaranteed gain over careful prompt engineering.",
    },
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getAllBlogSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}
