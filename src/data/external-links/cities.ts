/**
 * EXTERNAL LINKS — Villes top 200 FR
 *
 * ~200 liens cibles : 1 lien par ville (mairie .fr ou CCI).
 * Bootstrap initial : 12 mairies top 12. Le script Perplexity étend à ~200.
 *
 * Source villes : prisma seed `cities-france-5000plus.json` (225 villes seedées,
 * top 200 = priority ≤ 200).
 */

import type { ExternalLink } from "./types";

interface CitySeed {
  slug: string;
  url: string;
  name: string;
}

const CITY_SEEDS: ReadonlyArray<CitySeed> = [
  { slug: "paris", url: "https://www.paris.fr/", name: "Paris" },
  { slug: "marseille", url: "https://www.marseille.fr/", name: "Marseille" },
  { slug: "lyon", url: "https://www.lyon.fr/", name: "Lyon" },
  { slug: "toulouse", url: "https://www.toulouse.fr/", name: "Toulouse" },
  { slug: "nice", url: "https://www.nice.fr/", name: "Nice" },
  { slug: "nantes", url: "https://metropole.nantes.fr/", name: "Nantes" },
  { slug: "montpellier", url: "https://www.montpellier.fr/", name: "Montpellier" },
  { slug: "strasbourg", url: "https://www.strasbourg.eu/", name: "Strasbourg" },
  { slug: "bordeaux", url: "https://www.bordeaux.fr/", name: "Bordeaux" },
  { slug: "lille", url: "https://www.lille.fr/", name: "Lille" },
  { slug: "rennes", url: "https://metropole.rennes.fr/", name: "Rennes" },
  { slug: "reims", url: "https://www.reims.fr/", name: "Reims" },
];

export const LINKS_CITIES_TOP_200: ReadonlyArray<ExternalLink> = CITY_SEEDS.map((c) => ({
  id: `fr-city-${c.slug}-001`,
  url: c.url,
  title: `Mairie de ${c.name}`,
  organization: `Mairie de ${c.name}`,
  category: "mairie" as const,
  scope: "local" as const,
  cityIds: [c.slug],
  verticales: ["implementations", "un_a_un"],
  topics: ["collectivite-locale", "ville", "developpement-local"],
  language: "fr" as const,
  authority: 4 as const,
  verifiedAt: "2026-05-22",
  lastCheckedAt: "2026-05-22T00:00:00Z",
  status: "active" as const,
  isCompetitor: false,
  paywall: false,
  indexable: true,
  isHttps: true,
  usageCount: 0,
}));
