// Transversal content — about, FAQ, blog fixtures, help (Sprint 9).
// Replaced by Prisma in Sprint 15 for blog/help articles.

export const ABOUT_TIMELINE = [
  {
    id: "2024",
    date: "2024",
    fr: { title: "Création d'AxionIA OÜ", description: "Lancement du cabinet IA opérationnel." },
    en: { title: "AxionIA OÜ founded", description: "Operational AI consultancy launched." },
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
        "AxionIA est un cabinet IA opérationnel pour entreprises. Nous intervenons sur site (ou à distance) pour identifier, démontrer et implémenter des usages IA générant un ROI chiffré et mesurable.",
    },
    en: {
      question: "What is AxionIA?",
      answer:
        "AxionIA is an operational AI consultancy for companies. We work on site (or remote) to identify, demonstrate and implement AI use cases generating costed, measurable ROI.",
    },
  },
  {
    id: "modules",
    fr: {
      question: "Quels sont les 3 modules ?",
      answer:
        "Module 1 — Interventions sur site (1 journée à partir de 490 €). Module 2 — Audit IA (4 niveaux : Flash 490 €, Ciblé 1 900-3 900 €, Stratégique PME 4 900-9 900 €, Stratégique ETI dès 12 000 €). Module 3 — Implémentation IA (mise en production, à partir de 990 €).",
    },
    en: {
      question: "What are the 3 modules?",
      answer:
        "Module 1 — On-site sessions (1 day from €490). Module 2 — AI audit (4 tiers: Flash €490, Targeted €1,900-3,900, Strategic SME €4,900-9,900, Strategic Mid-cap from €12,000). Module 3 — AI implementation (production deployment, from €990).",
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
        "AxionIA OÜ. Devis fixe + virement + facture (régime TVA UE selon résidence du client). Aucune mensualité, aucun engagement.",
    },
    en: {
      question: "How does billing work?",
      answer:
        "AxionIA OÜ. Fixed quote + bank transfer + invoice (EU VAT regime according to client residence). No subscriptions, no commitments.",
    },
  },
] as const;

export interface BlogPost {
  slug: string;
  publishedAt: string; // ISO
  readingTime: string;
  category: string;
  author: string;
  tags: ReadonlyArray<string>;
  fr: { title: string; excerpt: string; body: string };
  en: { title: string; excerpt: string; body: string };
}

export const BLOG_POSTS: ReadonlyArray<BlogPost> = [
  {
    slug: "pourquoi-auditer-avant-implementer",
    publishedAt: "2026-04-12",
    readingTime: "6 min",
    category: "Méthodologie",
    author: "Will",
    tags: ["audit", "methodologie", "roi"],
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
    author: "Will",
    tags: ["quick-wins", "automatisation", "pme"],
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
    author: "Will",
    tags: ["ia-custom", "fine-tuning", "strategie"],
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

export function getAllBlogCategorySlugs(): string[] {
  const cats = new Set(BLOG_POSTS.map((p) => slugify(p.category)));
  return [...cats];
}

export function getBlogPostsByCategory(slug: string): BlogPost[] {
  return BLOG_POSTS.filter((p) => slugify(p.category) === slug);
}

export function getBlogCategoryLabel(slug: string): string | undefined {
  const found = BLOG_POSTS.find((p) => slugify(p.category) === slug);
  return found?.category;
}

export function getAllBlogTagSlugs(): string[] {
  const tags = new Set<string>();
  BLOG_POSTS.forEach((p) => p.tags.forEach((t) => tags.add(slugify(t))));
  return [...tags];
}

export function getBlogPostsByTag(slug: string): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.tags.some((t) => slugify(t) === slug));
}

export function getAllBlogAuthorSlugs(): string[] {
  const authors = new Set(BLOG_POSTS.map((p) => slugify(p.author)));
  return [...authors];
}

export function getBlogPostsByAuthor(slug: string): BlogPost[] {
  return BLOG_POSTS.filter((p) => slugify(p.author) === slug);
}

export function getBlogAuthorLabel(slug: string): string | undefined {
  const found = BLOG_POSTS.find((p) => slugify(p.author) === slug);
  return found?.author;
}

// Help center articles — Sprint 14 fixtures, replaced by Prisma in Sprint 15.
export interface HelpArticle {
  slug: string;
  category: string; // displayed label
  fr: { title: string; excerpt: string; body: string };
  en: { title: string; excerpt: string; body: string };
}

export const HELP_ARTICLES: ReadonlyArray<HelpArticle> = [
  {
    slug: "preparer-une-intervention",
    category: "Avant l'intervention",
    fr: {
      title: "Comment préparer une intervention IA ?",
      excerpt: "Liste des données, participants et objectifs à clarifier avant le jour J.",
      body: "Une intervention AxionIA réussie repose sur 4 préparatifs : (1) lister 3-5 process candidats à l'IA, (2) inviter 1 décideur + 2-3 opérationnels concernés, (3) préparer un échantillon de données anonymisées (factures, emails, comptes-rendus) pour démos, (4) bloquer 1 journée complète sans réunions parallèles. Aucune installation logicielle n'est requise — l'intervenant arrive avec son équipement et ses modèles IA.",
    },
    en: {
      title: "How to prepare an AI session?",
      excerpt: "List the data, participants and objectives to clarify before the day.",
      body: "A successful AxionIA session relies on 4 preparations: (1) list 3-5 candidate processes for AI, (2) invite 1 decision-maker + 2-3 operational staff, (3) prepare an anonymised data sample (invoices, emails, meeting notes) for demos, (4) block a full day with no parallel meetings. No software installation is required — the consultant arrives with their own equipment and AI models.",
    },
  },
  {
    slug: "perimetre-audit-ia",
    category: "Comprendre un audit IA",
    fr: {
      title: "Quel est le périmètre d'un audit IA AxionIA ?",
      excerpt: "Cartographie complète, chiffrage par opportunité, plan d'implémentation priorisé.",
      body: "L'audit IA AxionIA couvre 5 jours d'analyse : (1) cartographie de vos process actuels via interviews ; (2) identification de 8-15 opportunités IA scorées ROI/complexité ; (3) chiffrage individuel chaque opportunité (effort + coût + délai) ; (4) plan d'implémentation priorisé ; (5) recommandations gouvernance données + sourcing modèles. Livrable : document PDF 25-40 pages + atelier de restitution 2 h.",
    },
    en: {
      title: "What is the scope of an AxionIA AI audit?",
      excerpt: "Complete mapping, per-opportunity costing, prioritised implementation plan.",
      body: "The AxionIA AI audit covers 5 days of analysis: (1) mapping your current processes via interviews; (2) identifying 8-15 AI opportunities scored ROI/complexity; (3) individual costing of each opportunity (effort + cost + timeline); (4) prioritised implementation plan; (5) data governance + model sourcing recommendations. Deliverable: 25-40 page PDF + 2h debrief workshop.",
    },
  },
  {
    slug: "phases-implementation",
    category: "Implémentation IA",
    fr: {
      title: "Quelles sont les phases d'un projet d'implémentation ?",
      excerpt: "5 phases clés : cadrage, prototype, tests, déploiement, support.",
      body: "Un projet d'implémentation IA AxionIA suit 5 phases : (1) cadrage technique 1 semaine — choix du modèle, architecture, données ; (2) prototype 2-4 semaines — version fonctionnelle sur jeu de données réel ; (3) tests utilisateurs 1-2 semaines — validation par 3-5 opérationnels ; (4) déploiement production 1 semaine — mise en service progressive ; (5) support 30 jours inclus. Total 6-8 semaines pour la majorité des cas.",
    },
    en: {
      title: "What are the phases of an implementation project?",
      excerpt: "5 key phases: scoping, prototype, testing, deployment, support.",
      body: "An AxionIA AI implementation project follows 5 phases: (1) technical scoping 1 week — model choice, architecture, data; (2) prototype 2-4 weeks — functional version on real data; (3) user testing 1-2 weeks — validation by 3-5 operational staff; (4) production deployment 1 week — progressive go-live; (5) 30-day support included. Total 6-8 weeks for most cases.",
    },
  },
  {
    slug: "facturation-tva-ee",
    category: "Facturation & TVA EE",
    fr: {
      title: "Comment fonctionne la facturation TVA UE ?",
      excerpt: "AxionIA OÜ, virement, TVA selon résidence du client.",
      body: "AxionIA OÜ applique le régime TVA UE. Pour les clients UE B2B avec n° TVA intracommunautaire valide : autoliquidation, facture sans TVA. Pour clients UE B2C ou sans n° TVA : TVA UE applicable selon le siège du cabinet. Pour clients hors UE : facture sans TVA, hors-champ. Paiement par virement SEPA/SWIFT, devis fixe, aucune mensualité. La facture est livrée par PDF signé sous 48 h après prestation.",
    },
    en: {
      title: "How does EU VAT billing work?",
      excerpt: "AxionIA OÜ, bank transfer, VAT according to client residence.",
      body: "AxionIA OÜ applies the EU VAT regime. For EU B2B clients with valid intracommunity VAT number: reverse charge, invoice without VAT. For EU B2C or clients without VAT number: EU VAT applicable based on the consultancy's home jurisdiction. For non-EU clients: invoice without VAT, out of scope. Payment via SEPA/SWIFT bank transfer, fixed quote, no subscriptions. Signed PDF invoice delivered within 48h of service.",
    },
  },
  {
    slug: "securite-donnees",
    category: "Sécurité & données",
    fr: {
      title: "Comment AxionIA sécurise mes données ?",
      excerpt: "Hébergement UE Hetzner Frankfurt, RGPD strict, pas de partage tiers.",
      body: "Toutes les données client sont hébergées sur Hetzner CX32 à Frankfurt (UE). Aucun partage avec des tiers sans consentement explicite. Les modèles IA peuvent être hébergés chez vous (on-prem) ou sur infrastructure dédiée si requis. Politique RGPD complète, exercice des droits sous 30 jours, DPO joignable à dpo@axion-ia.com. Anonymisation systématique des échantillons utilisés pour démos.",
    },
    en: {
      title: "How does AxionIA secure my data?",
      excerpt: "EU hosting Hetzner Frankfurt, strict GDPR, no third-party sharing.",
      body: "All client data is hosted on Hetzner CX32 in Frankfurt (EU). No sharing with third parties without explicit consent. AI models can be hosted with you (on-prem) or on dedicated infrastructure if required. Complete GDPR policy, rights exercise within 30 days, DPO reachable at dpo@axion-ia.com. Systematic anonymisation of samples used for demos.",
    },
  },
  {
    slug: "support-post-livraison",
    category: "Support post-livraison",
    fr: {
      title: "Quel support après livraison ?",
      excerpt: "30 jours de maintenance corrective inclus, escalade chaude.",
      body: "Tout projet AxionIA inclut 30 jours de support post-livraison : maintenance corrective sur les bugs identifiés, escalade chaude par email/téléphone (réponse sous 4 h ouvrées), 1 itération de fine-tuning si dérive de qualité observée. Au-delà, contrat de maintenance optionnel à 290 € HT/mois (4 h/mois forfait). Aucun support n'est facturé pendant les 30 jours initiaux.",
    },
    en: {
      title: "What post-delivery support?",
      excerpt: "30 days of corrective maintenance included, warm escalation.",
      body: "Every AxionIA project includes 30 days of post-delivery support: corrective maintenance on identified bugs, warm escalation by email/phone (response within 4 business hours), 1 fine-tuning iteration if quality drift observed. Beyond that, optional maintenance contract at €290/month (4h/month flat fee). No support is billed during the initial 30 days.",
    },
  },
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function getAllHelpSlugs(): string[] {
  return HELP_ARTICLES.map((a) => a.slug);
}

export function getAllHelpCategorySlugs(): string[] {
  const cats = new Set(HELP_ARTICLES.map((a) => slugify(a.category)));
  return [...cats];
}

export function getHelpArticlesByCategory(slug: string): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => slugify(a.category) === slug);
}

export function getHelpCategoryLabel(slug: string): string | undefined {
  const found = HELP_ARTICLES.find((a) => slugify(a.category) === slug);
  return found?.category;
}

export type FaqEntry = (typeof FAQ_GLOBAL)[number];

export function getFaqEntry(id: string): FaqEntry | undefined {
  return FAQ_GLOBAL.find((f) => f.id === id);
}

export function getAllFaqIds(): string[] {
  return FAQ_GLOBAL.map((f) => f.id);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export { slugify };
