// Migré depuis `transversal.ts` en Sprint 14.10 (split content factory).
import type { BlogPost } from "../types";

export const POST: BlogPost = {
  slug: "3-quick-wins-2026",
  publishedAt: "2026-04-22",
  updatedAt: "2026-04-22",
  readingTime: "8 min",
  category: "Cas d'usage",
  author: "Will",
  tags: ["quick-wins", "automatisation", "pme"],
  companySizes: ["pme", "tpe"],
  serviceTypes: ["implementation"],
  format: "article",
  // V1 stub court — sera enrichi (>600 mots + directAnswer + FAQ) puis re-promu tier-1.
  indexationTier: "tier-2-noindex-follow",
  qualityScore: 58,
  fr: {
    title: "3 quick-wins IA opérationnels en 2026",
    excerpt:
      "Lecture de factures, comptes-rendus de réunion, qualification de leads — déployables en moins d'un mois.",
    body: "En 2026, les modèles IA matures permettent trois quick-wins déployables sous 30 jours dans presque toute organisation : 1) Lecture automatisée des factures entrantes (gain 30-50 % temps comptable). 2) Génération de comptes-rendus de réunions (gain 1-2 h/jour/cadre). 3) Qualification IA des leads entrants (gain 30 % conversion). Chacun coûte moins de 5 000 € à déployer pour une PME.",
  },
  en: {
    title: "3 operational AI quick-wins in 2026",
    excerpt: "Invoice reading, meeting minutes, lead qualification — deployable in under a month.",
    body: "In 2026, mature AI models enable three quick-wins deployable within 30 days in almost any organization: 1) Automated reading of incoming invoices (30-50% accounting time savings). 2) Meeting minute generation (1-2h/day/manager savings). 3) AI lead qualification (30% conversion uplift). Each costs less than €5k to deploy for an SME.",
  },
};
