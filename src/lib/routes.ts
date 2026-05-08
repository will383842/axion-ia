// SSOT routes ergonomiques — Sprint cert 14.x (2026-05-08).
// Ré-expose les pathnames `next-intl` pour Header / Footer / MobileNav /
// sitemap / breadcrumbs / JSON-LD avec une API stable.
//
// La SSOT VRAIE des routes reste `src/i18n/routing.ts` (next-intl pathnames).
// Ce fichier ajoute juste un alias typé pour les routes les plus utilisées
// — ce qui évite les 290 strings éparses `"/audit"`, `"/interventions"`, etc.
// dans les composants. Le `satisfies` garantit que chaque entrée correspond
// à un pathname réellement déclaré : si un composant route est supprimé de
// `routing.ts`, ce fichier ne compile plus.

import { routing } from "@/i18n/routing";

export type RouteKey = keyof typeof routing.pathnames;

/**
 * Constants ergonomiques pour les routes top-level (≈ 25 routes).
 * Pour les routes paramétrées (`[slug]`, `[ville]`, `[region]`),
 * importer directement depuis `next-intl/navigation` + `Link href`.
 */
export const ROUTES = {
  // Home + listings
  home: "/",
  about: "/a-propos",
  contact: "/contact",
  press: "/presse",
  blog: "/blog",
  faq: "/faq",
  help: "/centre-aide",
  search: "/recherche",
  reserve: "/reserver",
  comparisons: "/comparaisons",
  methodology: "/methodologie",
  stackIa: "/stack-ia",
  glossary: "/glossaire",
  guideAi: "/guide-ia",

  // Module 1 — Interventions
  interventions: "/interventions",
  interventionsEssentielle: "/interventions/essentielle",
  interventionsApprofondie: "/interventions/approfondie",
  interventionsConference: "/interventions/conference",
  interventionsDirigeants: "/interventions/dirigeants",
  interventionsGagnerDuTemps: "/interventions/gagner-du-temps",
  interventionsClaude: "/interventions/intervention-claude",

  // Module 2 — Audit
  audit: "/audit",
  auditFlash: "/audit/flash",
  auditProcess: "/audit/process",
  auditStrategiquePme: "/audit/strategique-pme",
  auditStrategiqueEti: "/audit/strategique-eti",
  auditDemande: "/audit/demande",

  // Module 3 — Implémentation
  implementation: "/implementation",
  implementationIaCustom: "/implementation/ia-custom",
  implementationChatbot: "/implementation/chatbot",
  implementationProcessus: "/implementation/processus",
  implementationStructuration: "/implementation/structuration",
  implementationCrmErp: "/implementation/crm-erp",
  implementationDocuments: "/implementation/documents",
  implementationAgents: "/implementation/agents",
  implementationIntegrations: "/implementation/integrations",
  implementationNoCode: "/implementation/no-code",
  implementationParTechno: "/implementation/par-techno",

  // pSEO Implantations + cas concrets
  locations: "/implantations",
  caseStudies: "/cas-concrets",

  // Légales
  legalNotice: "/mentions-legales",
  terms: "/conditions-generales",
  privacy: "/politique-confidentialite",
  cookies: "/cookies",
  rgpd: "/rgpd",
  travelPolicy: "/politique-deplacement",
  accessibility: "/accessibilite",
  cookiePreferences: "/preferences-cookies",
  myData: "/mes-donnees",

  // Tunnel utilisateur
  confirmation: "/confirmation",
  unsubscribe: "/desabonnement",

  // ROI calculator
  roi: "/roi",
} as const satisfies Record<string, RouteKey>;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
