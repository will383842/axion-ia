// Transversal content — about, FAQ, blog fixtures, help (Sprint 9).
// Replaced by Prisma in Sprint 15 for blog/help articles.

import {
  AUDIT_TIERS,
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  MAINTENANCE_TIERS,
  formatAmount,
  formatAmountRange,
  formatPrice,
  getEntryLabel,
  getTierById,
} from "@/content/pricing";

// Helpers locaux pour dériver les phrases FAQ multilingues à partir du SSOT
// pricing. Aucun prix hardcodé : si Will modifie un tier, ces phrases se
// mettent à jour automatiquement au build/start.
const auditFlashTier = getTierById(AUDIT_TIERS, "audit-flash");
const auditCibleTier = getTierById(AUDIT_TIERS, "audit-cible");
const auditPmeTier = getTierById(AUDIT_TIERS, "audit-strategique-pme");
const auditEtiTier = getTierById(AUDIT_TIERS, "audit-strategique-eti");
const maintenanceStandard = getTierById(MAINTENANCE_TIERS, "maintenance-standard");

function modulesAnswerFr(): string {
  const interventionsEntry = getEntryLabel(INTERVENTION_TIERS, "fr", { compact: false });
  const flash = formatAmount(auditFlashTier.priceFlat!, "fr", { compact: true });
  const cibleRange = formatAmountRange(auditCibleTier.priceMin!, auditCibleTier.priceMax!, "fr", {
    compact: true,
  });
  const pmeRange = formatAmountRange(auditPmeTier.priceMin!, auditPmeTier.priceMax!, "fr", {
    compact: true,
  });
  const etiFrom = formatAmount(auditEtiTier.priceMin!, "fr", { compact: true });
  const implEntry = getEntryLabel(IMPLEMENTATION_TIERS, "fr", { compact: false });
  return `Module 1 — Interventions sur site (1 journée à partir de ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "fr", { compact: true })}, ${interventionsEntry}). Module 2 — Audit IA (4 niveaux : Flash ${flash}, Ciblé ${cibleRange}, Stratégique PME ${pmeRange}, Stratégique ETI dès ${etiFrom}). Module 3 — Implémentation IA (mise en production, ${implEntry}).`;
}

function modulesAnswerEn(): string {
  const interventionsEntry = getEntryLabel(INTERVENTION_TIERS, "en", { compact: false });
  const flash = formatAmount(auditFlashTier.priceFlat!, "en", { compact: true });
  const cibleRange = formatAmountRange(auditCibleTier.priceMin!, auditCibleTier.priceMax!, "en", {
    compact: true,
  });
  const pmeRange = formatAmountRange(auditPmeTier.priceMin!, auditPmeTier.priceMax!, "en", {
    compact: true,
  });
  const etiFrom = formatAmount(auditEtiTier.priceMin!, "en", { compact: true });
  const implEntry = getEntryLabel(IMPLEMENTATION_TIERS, "en", { compact: false });
  return `Module 1 — On-site sessions (1 day from ${formatAmount(getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!, "en", { compact: true })}, ${interventionsEntry}). Module 2 — AI audit (4 tiers: Flash ${flash}, Targeted ${cibleRange}, Strategic SME ${pmeRange}, Strategic Mid-cap from ${etiFrom}). Module 3 — AI implementation (production deployment, ${implEntry}).`;
}

export const ABOUT_TIMELINE = [
  {
    id: "2024",
    date: "2024",
    fr: { title: "Création d'Axion-IA OÜ", description: "Lancement du cabinet IA opérationnel." },
    en: { title: "Axion-IA OÜ founded", description: "Operational AI consultancy launched." },
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
  // City Domination 2026-05-18 P1-13 (audit A11 P0) — Manon EN bio.
  // Persona éditoriale IA d'Axion-IA, transparence AI Act EU art. 50.
  // Doctrine v2.1 : zéro réseau social, supervision humaine, contenus IA-assistés.
  // Cf. /equipe/manon (FR) + /team/manon (EN) + AiContentDisclaimer composant.
  {
    id: "manon",
    fr: {
      name: "Manon",
      role: "Plume éditoriale IA · supervision humaine",
      bio: "Persona éditoriale IA d'Axion-IA. Rédige les contenus éditoriaux avec assistance d'IA générative (OpenAI, Anthropic, Perplexity), supervisée par l'équipe Axion-IA avant publication. Transparence AI Act EU art. 50.",
    },
    en: {
      name: "Manon",
      role: "AI editorial author · human supervision",
      bio: "Axion-IA's AI editorial persona. Drafts editorial content with generative AI assistance (OpenAI, Anthropic, Perplexity), supervised by the Axion-IA team before publication. EU AI Act art. 50 transparency.",
    },
  },
] as const;

export interface FaqEntry {
  id: string;
  fr: { question: string; answer: string };
  en: { question: string; answer: string };
}

export const FAQ_GLOBAL: ReadonlyArray<FaqEntry> = [
  {
    id: "definition",
    fr: {
      question: "Qu'est-ce qu'Axion-IA ?",
      answer:
        "Axion-IA est un cabinet IA opérationnel pour entreprises. Nous intervenons sur site (ou à distance) pour identifier, démontrer et implémenter des usages IA générant un ROI chiffré et mesurable.",
    },
    en: {
      question: "What is Axion-IA?",
      answer:
        "Axion-IA is an operational AI consultancy for companies. We work on site (or remote) to identify, demonstrate and implement AI use cases generating costed, measurable ROI.",
    },
  },
  {
    id: "modules",
    fr: {
      question: "Quels sont les 3 modules ?",
      answer: modulesAnswerFr(),
    },
    en: {
      question: "What are the 3 modules?",
      answer: modulesAnswerEn(),
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
        "Axion-IA OÜ. Devis fixe + virement + facture (régime TVA UE selon résidence du client). Aucune mensualité, aucun engagement.",
    },
    en: {
      question: "How does billing work?",
      answer:
        "Axion-IA OÜ. Fixed quote + bank transfer + invoice (EU VAT regime according to client residence). No subscriptions, no commitments.",
    },
  },
];

// Blog : split Sprint 14.10 (2026-05-08) — `BlogPost` + données + helpers
// déplacés dans `src/content/blog/`. Les exports ci-dessous restent disponibles
// pour rétrocompatibilité avec les pages /blog/* + sitemap + getRelatedBlogPosts.
export type { BlogPost, BlogPostCopy, BlogFaqItem } from "@/content/blog";
export {
  BLOG_POSTS,
  getBlogPost,
  getAllBlogSlugs,
  getAllBlogCategorySlugs,
  getBlogPostsByCategory,
  getBlogCategoryLabel,
  getAllBlogTagSlugs,
  getBlogPostsByTag,
  getAllBlogAuthorSlugs,
  getBlogPostsByAuthor,
  getBlogAuthorLabel,
} from "@/content/blog";

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
      body: "Une intervention Axion-IA réussie repose sur 4 préparatifs : (1) lister 3-5 process candidats à l'IA, (2) inviter 1 décideur + 2-3 opérationnels concernés, (3) préparer un échantillon de données anonymisées (factures, emails, comptes-rendus) pour démos, (4) bloquer 1 journée complète sans réunions parallèles. Aucune installation logicielle n'est requise — l'intervenant arrive avec son équipement et ses modèles IA.",
    },
    en: {
      title: "How to prepare an AI session?",
      excerpt: "List the data, participants and objectives to clarify before the day.",
      body: "A successful Axion-IA session relies on 4 preparations: (1) list 3-5 candidate processes for AI, (2) invite 1 decision-maker + 2-3 operational staff, (3) prepare an anonymised data sample (invoices, emails, meeting notes) for demos, (4) block a full day with no parallel meetings. No software installation is required — the consultant arrives with their own equipment and AI models.",
    },
  },
  {
    slug: "perimetre-audit-ia",
    category: "Comprendre un audit IA",
    fr: {
      title: "Quel est le périmètre d'un audit IA Axion-IA ?",
      excerpt: "Cartographie complète, chiffrage par opportunité, plan d'implémentation priorisé.",
      body: "L'audit IA Axion-IA couvre 5 jours d'analyse : (1) cartographie de vos process actuels via interviews ; (2) identification de 8-15 opportunités IA scorées ROI/complexité ; (3) chiffrage individuel chaque opportunité (effort + coût + délai) ; (4) plan d'implémentation priorisé ; (5) recommandations gouvernance données + sourcing modèles. Livrable : document PDF 25-40 pages + atelier de restitution 2 h.",
    },
    en: {
      title: "What is the scope of an Axion-IA AI audit?",
      excerpt: "Complete mapping, per-opportunity costing, prioritised implementation plan.",
      body: "The Axion-IA AI audit covers 5 days of analysis: (1) mapping your current processes via interviews; (2) identifying 8-15 AI opportunities scored ROI/complexity; (3) individual costing of each opportunity (effort + cost + timeline); (4) prioritised implementation plan; (5) data governance + model sourcing recommendations. Deliverable: 25-40 page PDF + 2h debrief workshop.",
    },
  },
  {
    slug: "phases-implementation",
    category: "Implémentation IA",
    fr: {
      title: "Quelles sont les phases d'un projet d'implémentation ?",
      excerpt: "5 phases clés : cadrage, prototype, tests, déploiement, support.",
      body: "Un projet d'implémentation IA Axion-IA suit 5 phases : (1) cadrage technique 1 semaine — choix du modèle, architecture, données ; (2) prototype 2-4 semaines — version fonctionnelle sur jeu de données réel ; (3) tests utilisateurs 1-2 semaines — validation par 3-5 opérationnels ; (4) déploiement production 1 semaine — mise en service progressive ; (5) support 30 jours inclus. Total 6-8 semaines pour la majorité des cas.",
    },
    en: {
      title: "What are the phases of an implementation project?",
      excerpt: "5 key phases: scoping, prototype, testing, deployment, support.",
      body: "An Axion-IA AI implementation project follows 5 phases: (1) technical scoping 1 week — model choice, architecture, data; (2) prototype 2-4 weeks — functional version on real data; (3) user testing 1-2 weeks — validation by 3-5 operational staff; (4) production deployment 1 week — progressive go-live; (5) 30-day support included. Total 6-8 weeks for most cases.",
    },
  },
  {
    slug: "facturation-tva-ee",
    category: "Facturation & TVA EE",
    fr: {
      title: "Comment fonctionne la facturation TVA UE ?",
      excerpt: "Axion-IA OÜ, virement, TVA selon résidence du client.",
      body: "Axion-IA OÜ applique le régime TVA UE. Pour les clients UE B2B avec n° TVA intracommunautaire valide : autoliquidation, facture sans TVA. Pour clients UE B2C ou sans n° TVA : TVA UE applicable selon le siège du cabinet. Pour clients hors UE : facture sans TVA, hors-champ. Paiement par virement SEPA/SWIFT, devis fixe, aucune mensualité. La facture est livrée par PDF signé sous 48 h après prestation.",
    },
    en: {
      title: "How does EU VAT billing work?",
      excerpt: "Axion-IA OÜ, bank transfer, VAT according to client residence.",
      body: "Axion-IA OÜ applies the EU VAT regime. For EU B2B clients with valid intracommunity VAT number: reverse charge, invoice without VAT. For EU B2C or clients without VAT number: EU VAT applicable based on the consultancy's home jurisdiction. For non-EU clients: invoice without VAT, out of scope. Payment via SEPA/SWIFT bank transfer, fixed quote, no subscriptions. Signed PDF invoice delivered within 48h of service.",
    },
  },
  {
    slug: "securite-donnees",
    category: "Sécurité & données",
    fr: {
      title: "Comment Axion-IA sécurise mes données ?",
      excerpt: "Hébergement UE Hetzner Frankfurt, RGPD strict, pas de partage tiers.",
      body: "Toutes les données client sont hébergées sur Hetzner CPX32 à Frankfurt (UE). Aucun partage avec des tiers sans consentement explicite. Les modèles IA peuvent être hébergés chez vous (on-prem) ou sur infrastructure dédiée si requis. Politique RGPD complète, exercice des droits sous 30 jours, DPO joignable à contact@axion-ia.com. Anonymisation systématique des échantillons utilisés pour démos.",
    },
    en: {
      title: "How does Axion-IA secure my data?",
      excerpt: "EU hosting Hetzner Frankfurt, strict GDPR, no third-party sharing.",
      body: "All client data is hosted on Hetzner CPX32 in Frankfurt (EU). No sharing with third parties without explicit consent. AI models can be hosted with you (on-prem) or on dedicated infrastructure if required. Complete GDPR policy, rights exercise within 30 days, DPO reachable at contact@axion-ia.com. Systematic anonymisation of samples used for demos.",
    },
  },
  {
    slug: "support-post-livraison",
    category: "Support post-livraison",
    fr: {
      title: "Quel support après livraison ?",
      excerpt: "30 jours de maintenance corrective inclus, escalade chaude.",
      body: `Tout projet Axion-IA inclut 30 jours de support post-livraison : maintenance corrective sur les bugs identifiés, escalade chaude par email/téléphone (réponse sous 4 h ouvrées), 1 itération de fine-tuning si dérive de qualité observée. Au-delà, contrat de maintenance optionnel à ${formatPrice(maintenanceStandard, "fr")} (4 h/mois forfait). Aucun support n'est facturé pendant les 30 jours initiaux.`,
    },
    en: {
      title: "What post-delivery support?",
      excerpt: "30 days of corrective maintenance included, warm escalation.",
      body: `Every Axion-IA project includes 30 days of post-delivery support: corrective maintenance on identified bugs, warm escalation by email/phone (response within 4 business hours), 1 fine-tuning iteration if quality drift observed. Beyond that, optional maintenance contract at ${formatPrice(maintenanceStandard, "en")} (4h/month flat fee). No support is billed during the initial 30 days.`,
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
