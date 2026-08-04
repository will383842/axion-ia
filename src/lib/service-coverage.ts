// Helper centralisé pour le `areasServed` du Service JSON-LD des pages
// services canoniques (`/audit`, `/interventions`, `/implementation`).
// Sprint 14.9 levier 2.
//
// Construit la liste des entités Schema.org couvertes par Axion-IA :
//   - Country FR (premier — racine sémantique)
//   - 12 régions métropolitaines indexable (lien vers /implantations/[region])
//   - Top 12 villes par population indexable (V1 = Paris seul)
//
// Permet à Perplexity / Claude.ai / Google AI Overviews d'énumérer les zones
// couvertes quand un utilisateur demande « où Axion-IA opère-t-il ? ».

import { getIndexableRegions } from "@/content/regions";
import { getIndexableVilles } from "@/content/villes";
import { SITE_URL } from "@/lib/site-url";
import type { Locale } from "@/i18n/routing";

/** Liste areasServed standard pour les 3 services canoniques. */
export function buildServiceAreasServed(
  locale: Locale,
): Array<{ type: "Country" | "AdministrativeArea" | "City"; name: string; url?: string }> {
  const isFr = locale === "fr";
  const localized = (regionPath: string) =>
    `${SITE_URL}/${locale}/${isFr ? "implantations" : "locations"}${regionPath}`;

  const out: Array<{
    type: "Country" | "AdministrativeArea" | "City";
    name: string;
    url?: string;
  }> = [{ type: "Country", name: "France" }];

  for (const region of getIndexableRegions()) {
    out.push({
      type: "AdministrativeArea",
      name: region.nameFr,
      url: localized(`/${region.slug}`),
    });
  }

  for (const ville of getIndexableVilles()) {
    out.push({
      type: "City",
      name: ville.nameFr,
      url: localized(`/${ville.region}/${ville.slug}`),
    });
  }

  return out;
}
