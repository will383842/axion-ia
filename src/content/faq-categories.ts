// FAQ — catégories thématiques (SSOT hubs `/faq/par-thematique[/<categorie>]`).
// Fix audit FAQ 2026-05-31 (axe C1) : silo hub → catégorie → page Q/A.
// Les `slug` DOIVENT correspondre à l'enum Prisma `FAQCategory`
// (prisma/schema.prisma : general | interventions | implementation | audit |
// pricing | process). Toute nouvelle catégorie = ajouter ici + dans l'enum.

export interface FaqCategoryDef {
  /** = valeur de l'enum Prisma `FAQCategory`. */
  readonly slug: string;
  readonly labelFr: string;
  readonly labelEn: string;
  readonly descFr: string;
  readonly descEn: string;
}

export const FAQ_CATEGORIES: ReadonlyArray<FaqCategoryDef> = [
  {
    slug: "general",
    labelFr: "Général",
    labelEn: "General",
    descFr: "Qui est Axion-IA, périmètre d'intervention, fonctionnement global.",
    descEn: "Who Axion-IA is, scope of work, how it all works.",
  },
  {
    slug: "interventions",
    labelFr: "Formations IA",
    labelEn: "AI training",
    descFr:
      "Formations et sessions IA sur site et à distance, ateliers, montée en compétence des équipes.",
    descEn: "On-site and remote AI training and sessions, workshops, team upskilling.",
  },
  {
    slug: "implementation",
    labelFr: "Implémentation",
    labelEn: "Implementation",
    descFr: "Automatisations, IA sur mesure, intégrations, délais de mise en œuvre.",
    descEn: "Automation, custom AI, integrations, delivery timelines.",
  },
  {
    slug: "audit",
    labelFr: "Audit IA",
    labelEn: "AI audit",
    descFr: "Diagnostic, ROI chiffré, livrables d'un audit IA.",
    descEn: "Diagnosis, quantified ROI, AI audit deliverables.",
  },
  {
    slug: "pricing",
    labelFr: "Tarifs & facturation",
    labelEn: "Pricing & billing",
    descFr: "Prix publics, modalités de paiement, TVA, annulation.",
    descEn: "Public pricing, payment terms, VAT, cancellation.",
  },
  {
    slug: "process",
    labelFr: "Process & méthode",
    labelEn: "Process & method",
    descFr: "Réservation, déroulé, RGPD, support après-vente.",
    descEn: "Booking, process, GDPR, after-sales support.",
  },
  {
    slug: "sites-web",
    labelFr: "Sites web & SaaS augmentés à l'IA",
    labelEn: "AI-augmented websites & SaaS",
    descFr:
      "Création de sites web et d'applications SaaS sur mesure augmentés à l'intelligence artificielle.",
    descEn: "Custom AI-augmented websites and SaaS applications.",
  },
  {
    slug: "un-a-un",
    labelFr: "Coaching IA 1-to-1",
    labelEn: "1-to-1 AI coaching",
    descFr: "Accompagnement et coaching IA individuel pour dirigeants, cadres et managers.",
    descEn: "Individual AI coaching and support for executives, managers and team leads.",
  },
];

export function getFaqCategory(slug: string): FaqCategoryDef | undefined {
  return FAQ_CATEGORIES.find((c) => c.slug === slug);
}

export function getAllFaqCategorySlugs(): ReadonlyArray<string> {
  return FAQ_CATEGORIES.map((c) => c.slug);
}
