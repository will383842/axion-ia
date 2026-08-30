// Liste de secours des presets (SSOT partagé entre la page presets et le
// wizard). Utilisée tant que la table CampaignTemplate n'est pas seedée.
//
// Pure data — pas de "use server", importable côté serveur ET client.

import type { PresetConfig } from "./preset-mapping";

export interface PresetRow {
  slug: string;
  name: string;
  description: string;
  config?: PresetConfig;
}

export const FALLBACK_PRESETS: PresetRow[] = [
  {
    slug: "pme-audits",
    name: "PME audits",
    description: "Campagne audit IA pour PME - blog pilier + cas d'usage local.",
    config: {
      verticals: ["audits"],
      types: ["blog_pillar", "case_study_local"],
      batchSize: 20,
      dailyCap: 30,
    },
  },
  {
    slug: "interventions-weekly",
    name: "Interventions weekly",
    description: "Articles hebdo interventions formations PME/ETI.",
    config: {
      verticals: ["interventions_formations"],
      types: ["blog_from_title", "blog_from_rss"],
      batchSize: 10,
      dailyCap: 14,
    },
  },
  {
    slug: "pme-burst",
    name: "PME burst",
    description: "Burst articles interventions+audits PME.",
    config: {
      verticals: ["interventions_formations", "audits"],
      types: ["blog_from_keywords"],
      batchSize: 50,
      dailyCap: 50,
    },
  },
  {
    slug: "eti-pilier",
    name: "ETI pilier",
    description: "Articles pilier haute qualité ETI.",
    config: { verticals: ["implementations"], types: ["blog_pillar"], batchSize: 5, dailyCap: 5 },
  },
  {
    slug: "contenu-local-villes",
    name: "Contenu local villes",
    description: "Problème/solution, cas d'usage et FAQ ancrés ville.",
    config: {
      verticals: ["audits", "interventions_formations"],
      types: ["pain_point_solution", "case_study_local", "faq_geo"],
      batchSize: 15,
      dailyCap: 20,
    },
  },
  {
    slug: "rss-daily",
    name: "RSS daily",
    description: "Blog depuis RSS quotidien 7h.",
    config: {
      verticals: ["interventions_formations"],
      types: ["blog_from_rss"],
      batchSize: 7,
      dailyCap: 7,
    },
  },
];
