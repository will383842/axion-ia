// Source unique de vérité des catégories d'offres d'emploi (carrières).
// Doit rester aligné avec l'enum Prisma `JobCategory`. Utilisé partout :
// formulaire admin, liste admin, hub public, page offre (maillage), filtres.

export interface CareerCategory {
  /** = valeur enum Prisma JobCategory. */
  slug: string;
  fr: string;
  en: string;
  /** Page métier/service liée (maillage interne GEO sur la page offre). */
  service: { href: string; fr: string; en: string };
}

/** Slugs dans l'ordre d'affichage (tuple littéral pour z.enum). */
export const CAREER_CATEGORY_SLUGS = [
  "developpement",
  "ia",
  "data",
  "design",
  "produit",
  "conseil",
  "commercial",
  "marketing",
  "operations",
  "support",
  "autre",
] as const;

export type CareerCategorySlug = (typeof CAREER_CATEGORY_SLUGS)[number];

export const CAREER_CATEGORIES: ReadonlyArray<CareerCategory> = [
  {
    slug: "developpement",
    fr: "Développement",
    en: "Software development",
    service: {
      href: "/sites-web",
      fr: "Sites web & SaaS IA",
      en: "Websites & AI SaaS",
    },
  },
  {
    slug: "ia",
    fr: "IA / Machine Learning",
    en: "AI / Machine Learning",
    service: {
      href: "/implementation",
      fr: "Implémentation IA",
      en: "AI implementation",
    },
  },
  {
    slug: "data",
    fr: "Data",
    en: "Data",
    service: {
      href: "/implementation",
      fr: "Implémentation IA & data",
      en: "AI & data",
    },
  },
  {
    slug: "design",
    fr: "Design / UX-UI",
    en: "Design / UX-UI",
    service: {
      href: "/sites-web",
      fr: "Design & sites web",
      en: "Design & websites",
    },
  },
  {
    slug: "produit",
    fr: "Produit",
    en: "Product",
    service: {
      href: "/audit",
      fr: "Audit & stratégie IA",
      en: "AI audit & strategy",
    },
  },
  {
    slug: "conseil",
    fr: "Conseil / Audit IA",
    en: "Consulting / AI audit",
    service: { href: "/audit", fr: "Audit IA", en: "AI audit" },
  },
  {
    slug: "commercial",
    fr: "Commercial / Vente",
    en: "Sales",
    service: {
      href: "/devenir-commercial-ia",
      fr: "Réseau commercial",
      en: "Sales network",
    },
  },
  {
    slug: "marketing",
    fr: "Marketing / Growth",
    en: "Marketing / Growth",
    service: { href: "/cas-concrets", fr: "Cas concrets", en: "Case studies" },
  },
  {
    slug: "operations",
    fr: "Opérations / Gestion de projet",
    en: "Operations / Project management",
    service: {
      href: "/methodologie",
      fr: "Notre méthodologie",
      en: "Our methodology",
    },
  },
  {
    slug: "support",
    fr: "Support / Customer Success",
    en: "Support / Customer Success",
    service: { href: "/contact", fr: "Nous contacter", en: "Contact us" },
  },
  {
    slug: "autre",
    fr: "Autre",
    en: "Other",
    service: {
      href: "/a-propos",
      fr: "À propos d'Axion-IA",
      en: "About Axion-IA",
    },
  },
];

const BY_SLUG = new Map(CAREER_CATEGORIES.map((c) => [c.slug, c]));

export function careerCategoryLabel(slug: string, isFr: boolean): string {
  const c = BY_SLUG.get(slug);
  return c ? (isFr ? c.fr : c.en) : slug;
}

export function careerCategoryService(slug: string): CareerCategory["service"] | undefined {
  return BY_SLUG.get(slug)?.service;
}

/**
 * Les 5 verticales Axion-IA.com (maillage interne SEO) — URLs alignées sur la nav
 * principale (Header.tsx). Affichées sur chaque page offre.
 */
export const CAREER_VERTICALS: ReadonlyArray<{
  href: string;
  fr: string;
  en: string;
}> = [
  {
    href: "/formations",
    fr: "Formations IA",
    en: "AI training",
  },
  { href: "/un-a-un", fr: "Coaching 1 to 1", en: "1-to-1 coaching" },
  { href: "/audit", fr: "Audit IA", en: "AI audit" },
  { href: "/implementation", fr: "Intégration IA", en: "AI integration" },
  {
    href: "/sites-web-augmentes",
    fr: "Sites web & SaaS IA",
    en: "AI websites & SaaS",
  },
];
