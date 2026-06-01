// FAQ — liens internes contextuels curés par catégorie (SSOT maillage).
// Refonte premium hub FAQ 2026-06-01 : le reader `FaqItem` n'expose aucun champ
// de liens (la DB ne porte ni `tags` ni `relatedLinks`), donc le maillage
// contextuel est piloté ici, par catégorie. 100 % interne (décision Will
// 2026-06-01 : pas de liens externes, on ne dilue pas le PageRank).
//
// Les `href` sont SANS préfixe locale ; le composant consommateur préfixe
// `/${locale}`. Les slugs de catégorie DOIVENT correspondre à `FAQ_CATEGORIES`
// (cf. `faq-categories.ts` + enum Prisma `FAQCategory`).

export interface FaqResourceLink {
  /** Chemin canonique sans locale, ex. "/audit". */
  readonly href: string;
  readonly labelFr: string;
  readonly labelEn: string;
  readonly descFr: string;
  readonly descEn: string;
}

// Liens « toujours utiles » servant de complément/fallback (réservation +
// contact restent pertinents quelle que soit la thématique).
const RESERVER: FaqResourceLink = {
  href: "/reserver",
  labelFr: "Réserver un créneau",
  labelEn: "Book a slot",
  descFr: "Choisir une date et démarrer concrètement.",
  descEn: "Pick a date and get started.",
};

export const FAQ_CATEGORY_RESOURCES: Record<string, ReadonlyArray<FaqResourceLink>> = {
  general: [
    {
      href: "/a-propos",
      labelFr: "À propos d'Axion-IA",
      labelEn: "About Axion-IA",
      descFr: "Mission, approche et périmètre d'intervention.",
      descEn: "Mission, approach and scope of work.",
    },
    {
      href: "/interventions",
      labelFr: "Nos interventions IA",
      labelEn: "Our AI sessions",
      descFr: "Formations, ateliers et accompagnements proposés.",
      descEn: "Training, workshops and support offered.",
    },
    {
      href: "/tarifs",
      labelFr: "Tarifs",
      labelEn: "Pricing",
      descFr: "Prix publics et modalités, sans surprise.",
      descEn: "Public pricing and terms, no surprises.",
    },
  ],
  interventions: [
    {
      href: "/interventions",
      labelFr: "Formations & interventions IA",
      labelEn: "AI training & sessions",
      descFr: "Le détail des formats sur site et à distance.",
      descEn: "Details of on-site and remote formats.",
    },
    {
      href: "/methodologie",
      labelFr: "Notre méthode",
      labelEn: "Our method",
      descFr: "Comment se déroule une intervention, étape par étape.",
      descEn: "How a session unfolds, step by step.",
    },
    RESERVER,
  ],
  implementation: [
    {
      href: "/implementation",
      labelFr: "Implémentation IA",
      labelEn: "AI implementation",
      descFr: "Automatisations, IA sur mesure et intégrations.",
      descEn: "Automation, custom AI and integrations.",
    },
    {
      href: "/stack-ia",
      labelFr: "Notre stack IA",
      labelEn: "Our AI stack",
      descFr: "Les outils et modèles que nous mettons en œuvre.",
      descEn: "The tools and models we deploy.",
    },
    {
      href: "/cas-concrets",
      labelFr: "Cas concrets",
      labelEn: "Case studies",
      descFr: "Des réalisations et résultats mesurés.",
      descEn: "Real deliverables and measured results.",
    },
  ],
  audit: [
    {
      href: "/audit",
      labelFr: "Audit IA",
      labelEn: "AI audit",
      descFr: "Diagnostic, périmètre et livrables d'un audit.",
      descEn: "Diagnosis, scope and audit deliverables.",
    },
    {
      href: "/roi",
      labelFr: "ROI de l'IA",
      labelEn: "AI ROI",
      descFr: "Comment nous chiffrons le retour sur investissement.",
      descEn: "How we quantify return on investment.",
    },
    RESERVER,
  ],
  pricing: [
    {
      href: "/tarifs",
      labelFr: "Tarifs détaillés",
      labelEn: "Detailed pricing",
      descFr: "Prix publics, TVA et modalités de paiement.",
      descEn: "Public pricing, VAT and payment terms.",
    },
    {
      href: "/demande-devis",
      labelFr: "Demander un devis",
      labelEn: "Request a quote",
      descFr: "Une estimation adaptée à votre besoin.",
      descEn: "An estimate tailored to your need.",
    },
    RESERVER,
  ],
  process: [
    {
      href: "/methodologie",
      labelFr: "Méthodologie",
      labelEn: "Methodology",
      descFr: "Réservation, déroulé et support après-vente.",
      descEn: "Booking, process and after-sales support.",
    },
    {
      href: "/rgpd",
      labelFr: "RGPD & données",
      labelEn: "GDPR & data",
      descFr: "Souveraineté des données et conformité UE.",
      descEn: "Data sovereignty and EU compliance.",
    },
    RESERVER,
  ],
  "sites-web": [
    {
      href: "/sites-web-augmentes",
      labelFr: "Sites web augmentés à l'IA",
      labelEn: "AI-augmented websites",
      descFr: "Sites et SaaS sur mesure dopés à l'IA.",
      descEn: "Custom AI-powered sites and SaaS.",
    },
    {
      href: "/cas-concrets",
      labelFr: "Cas concrets",
      labelEn: "Case studies",
      descFr: "Des projets web livrés et leurs résultats.",
      descEn: "Delivered web projects and their results.",
    },
    {
      href: "/demande-devis",
      labelFr: "Demander un devis",
      labelEn: "Request a quote",
      descFr: "Cadrer votre projet et obtenir une estimation.",
      descEn: "Scope your project and get an estimate.",
    },
  ],
  "un-a-un": [
    {
      href: "/un-a-un",
      labelFr: "Coaching IA 1-to-1",
      labelEn: "1-to-1 AI coaching",
      descFr: "Accompagnement individuel des dirigeants et managers.",
      descEn: "Individual support for executives and managers.",
    },
    {
      href: "/interventions",
      labelFr: "Toutes nos interventions",
      labelEn: "All our sessions",
      descFr: "Formats collectifs en complément du 1-to-1.",
      descEn: "Group formats alongside 1-to-1 coaching.",
    },
    RESERVER,
  ],
};

const DEFAULT_RESOURCES: ReadonlyArray<FaqResourceLink> = FAQ_CATEGORY_RESOURCES.general ?? [];

/**
 * Liens internes contextuels pour une catégorie FAQ.
 * Fallback sur `general` pour toute catégorie inconnue (ex. legacy/KB).
 */
export function getFaqResources(category: string): ReadonlyArray<FaqResourceLink> {
  return FAQ_CATEGORY_RESOURCES[category] ?? DEFAULT_RESOURCES;
}
