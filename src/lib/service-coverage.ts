// Helper centralisé pour le `areasServed` du Service JSON-LD des pages
// services canoniques (`/audit`, `/interventions`, `/implementation`).
// Sprint 14.9 levier 2.
//
// Construit la liste des entités Schema.org couvertes par Axion-IA :
//   - Country FR (premier — racine sémantique)
//   - les régions indexables, métropole + DROM (lien vers /implantations/[region])
//
// ⛔ AUCUNE ville ici (audit du site réel, 2026-11-11). La liste portait les
// ~2 157 villes indexables, chacune avec son URL : ~248 Ko par nœud `Service`,
// 1,45 Mo de JSON-LD sur /fr/un-a-un (3 nœuds), pour des URL en majorité
// `noindex`. Le pays + les régions disent la même chose (« partout en France »)
// en ~3 Ko. Une page VILLE qui veut nommer sa ville passe `areasServed`
// explicitement à `buildServiceJsonLd`.
//
// Permet à Perplexity / Claude.ai / Google AI Overviews d'énumérer les zones
// couvertes quand un utilisateur demande « où Axion-IA opère-t-il ? ».

import { getIndexableRegions } from "@/content/regions";
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

  return out;
}
