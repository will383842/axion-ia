/**
 * EXTERNAL LINKS — Régions FR (13)
 *
 * ~130 liens cibles : conseil régional + agence dev éco + observatoire + CCI régionale.
 * Bootstrap initial : 13 conseils régionaux. Le script Perplexity étend à ~130.
 */

import type { ExternalLink } from "./types";

interface RegionSeed {
  slug: string;
  url: string;
  name: string;
}

const REGION_SEEDS: ReadonlyArray<RegionSeed> = [
  { slug: "ile-de-france", url: "https://www.iledefrance.fr/", name: "Île-de-France" },
  {
    slug: "auvergne-rhone-alpes",
    url: "https://www.auvergnerhonealpes.fr/",
    name: "Auvergne-Rhône-Alpes",
  },
  {
    slug: "nouvelle-aquitaine",
    url: "https://www.nouvelle-aquitaine.fr/",
    name: "Nouvelle-Aquitaine",
  },
  { slug: "occitanie", url: "https://www.laregion.fr/", name: "Occitanie" },
  { slug: "hauts-de-france", url: "https://www.hautsdefrance.fr/", name: "Hauts-de-France" },
  { slug: "grand-est", url: "https://www.grandest.fr/", name: "Grand Est" },
  {
    slug: "provence-alpes-cote-azur",
    url: "https://www.maregionsud.fr/",
    name: "Provence-Alpes-Côte d'Azur",
  },
  { slug: "pays-de-la-loire", url: "https://www.paysdelaloire.fr/", name: "Pays de la Loire" },
  { slug: "bretagne", url: "https://www.bretagne.bzh/", name: "Bretagne" },
  { slug: "normandie", url: "https://www.normandie.fr/", name: "Normandie" },
  {
    slug: "bourgogne-franche-comte",
    url: "https://www.bourgognefranchecomte.fr/",
    name: "Bourgogne-Franche-Comté",
  },
  {
    slug: "centre-val-de-loire",
    url: "https://www.centre-valdeloire.fr/",
    name: "Centre-Val de Loire",
  },
  { slug: "corse", url: "https://www.isula.corsica/", name: "Corse" },
];

export const LINKS_REGIONS: ReadonlyArray<ExternalLink> = REGION_SEEDS.map((r) => ({
  id: `fr-region-${r.slug}-001`,
  url: r.url,
  title: `Conseil régional ${r.name}`,
  organization: `Région ${r.name}`,
  category: "gov_fr" as const,
  scope: "regional" as const,
  regionSlug: r.slug,
  verticales: ["implementations", "interventions_formations", "un_a_un"],
  topics: ["region", "developpement-economique", "innovation"],
  language: "fr" as const,
  authority: 5 as const,
  verifiedAt: "2026-05-22",
  lastCheckedAt: "2026-05-22T00:00:00Z",
  status: "active" as const,
  isCompetitor: false,
  paywall: false,
  indexable: true,
  isHttps: true,
  usageCount: 0,
}));
