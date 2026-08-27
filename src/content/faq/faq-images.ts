// SSOT — Images éditoriales des pages FAQ (alt/dimensions/URL crawlable).
//
// Séparé des crédits Unsplash (`faq-photos.ts`, auto-généré par le script de
// curation) : ici on tient les `alt`/`name` SEO/a11y et les dimensions réelles.
// Consommé par :
//   1. Les pages FAQ (rendu `<Image>` du héro + <UnsplashCredit>).
//   2. Le manifeste `page-images.ts` (JSON-LD ImageObject + sitemap images) via
//      `FAQ_PAGE_IMAGES` pour les chemins statiques (hub, index thématiques, 8
//      catégories). Les fiches `/faq/[slug]` (dynamiques) réutilisent l'image de
//      leur catégorie en rendu, sans entrée sitemap dédiée.
//
// `slot` = "hub" | "topics" | slug de catégorie FAQ (cf. faq-categories.ts).
// Toutes les photos sont produites en 1280×960 (4:3) par le script de curation.

export interface FaqImage {
  readonly src: string;
  readonly nameFr: string;
  readonly nameEn: string;
  readonly altFr: string;
  readonly altEn: string;
  readonly width: number;
  readonly height: number;
}

const W = 1280;
const H = 960;
const base = (slot: string) => `/illustrations/faq/${slot}.avif`;

export const FAQ_IMAGES: Record<string, FaqImage> = {
  hub: {
    src: base("hub"),
    nameFr: "FAQ Axion-IA — base de connaissances IA en entreprise",
    nameEn: "Axion-IA FAQ — enterprise AI knowledge base",
    altFr:
      "Base de connaissances Axion-IA : réponses aux questions fréquentes sur l'intelligence artificielle en entreprise — interventions, audit, implémentation, tarifs.",
    altEn:
      "Axion-IA knowledge base: answers to frequently asked questions about enterprise artificial intelligence — sessions, audit, implementation, pricing.",
    width: W,
    height: H,
  },
  topics: {
    src: base("topics"),
    nameFr: "FAQ Axion-IA par thématique",
    nameEn: "Axion-IA FAQ by topic",
    altFr:
      "FAQ Axion-IA organisée par thématique : familles de questions sur l'IA en entreprise — formations, implémentation, audit, tarifs, RGPD, coaching.",
    altEn:
      "Axion-IA FAQ organised by topic: families of questions about enterprise AI — training, implementation, audit, pricing, GDPR, coaching.",
    width: W,
    height: H,
  },
  general: {
    src: base("general"),
    nameFr: "Axion-IA — cabinet IA opérationnel français",
    nameEn: "Axion-IA — French operational AI consultancy",
    altFr:
      "Équipe Axion-IA en réunion — cabinet IA opérationnel français qui accompagne PME, ETI, grands groupes et TPE dans leur transformation par l'intelligence artificielle.",
    altEn:
      "Axion-IA team in a meeting — French operational AI consultancy supporting small businesses, SMEs, mid-caps and large enterprises in their AI transformation.",
    width: W,
    height: H,
  },
  interventions: {
    src: base("interventions"),
    nameFr: "Formation IA en entreprise Axion-IA",
    nameEn: "Axion-IA enterprise AI training",
    altFr:
      "Session de formation IA en entreprise animée par Axion-IA — montée en compétence des équipes sur les outils d'intelligence artificielle, sur site et à distance.",
    altEn:
      "Enterprise AI training session led by Axion-IA — upskilling teams on artificial intelligence tools, on site and remotely.",
    width: W,
    height: H,
  },
  implementation: {
    src: base("implementation"),
    nameFr: "Implémentation IA sur mesure Axion-IA",
    nameEn: "Axion-IA custom AI implementation",
    altFr:
      "Développement et implémentation de solutions IA sur mesure par Axion-IA — automatisations, IA générative et intégrations dans les outils métier de l'entreprise.",
    altEn:
      "Development and implementation of custom AI solutions by Axion-IA — automation, generative AI and integrations into the company's business tools.",
    width: W,
    height: H,
  },
  audit: {
    src: base("audit"),
    nameFr: "Audit IA Axion-IA",
    nameEn: "Axion-IA AI audit",
    altFr:
      "Audit IA Axion-IA — diagnostic et analyse de données pour identifier les opportunités d'automatisation et chiffrer le ROI de l'intelligence artificielle.",
    altEn:
      "Axion-IA AI audit — diagnosis and data analysis to identify automation opportunities and quantify the ROI of artificial intelligence.",
    width: W,
    height: H,
  },
  pricing: {
    src: base("pricing"),
    nameFr: "Tarifs et facturation Axion-IA",
    nameEn: "Axion-IA pricing and billing",
    altFr:
      "Tarifs et facturation des prestations IA Axion-IA — devis, budget, TVA et modalités de paiement des formations, audits et implémentations.",
    altEn:
      "Pricing and billing of Axion-IA AI services — quotes, budget, VAT and payment terms for training, audits and implementations.",
    width: W,
    height: H,
  },
  process: {
    src: base("process"),
    nameFr: "Méthode et process Axion-IA",
    nameEn: "Axion-IA method and process",
    altFr:
      "Méthode et process Axion-IA — déroulé d'une mission IA, de la réservation au suivi, avec cadre RGPD et support après-vente.",
    altEn:
      "Axion-IA method and process — how an AI mission unfolds, from booking to follow-up, with a GDPR framework and after-sales support.",
    width: W,
    height: H,
  },
  "sites-web": {
    src: base("sites-web"),
    nameFr: "Sites web et SaaS augmentés à l'IA Axion-IA",
    nameEn: "Axion-IA AI-augmented websites and SaaS",
    altFr:
      "Création de sites web et d'applications SaaS augmentés à l'intelligence artificielle par Axion-IA — interfaces sur mesure et expériences pilotées par l'IA.",
    altEn:
      "Creation of AI-augmented websites and SaaS applications by Axion-IA — custom interfaces and AI-driven experiences.",
    width: W,
    height: H,
  },
  "un-a-un": {
    src: base("un-a-un"),
    nameFr: "Coaching IA individuel 1-to-1 Axion-IA",
    nameEn: "Axion-IA 1-to-1 AI coaching",
    altFr:
      "Coaching IA individuel 1-to-1 Axion-IA pour dirigeants, cadres et managers — accompagnement personnalisé à la maîtrise de l'intelligence artificielle.",
    altEn:
      "Axion-IA 1-to-1 AI coaching for executives, managers and team leads — personalised support to master artificial intelligence.",
    width: W,
    height: H,
  },
};

/** Image d'une catégorie/slot, avec repli sur l'image « général » puis « hub ». */
export function getFaqImage(slot: string): FaqImage {
  return FAQ_IMAGES[slot] ?? FAQ_IMAGES.general ?? FAQ_IMAGES.hub!;
}
