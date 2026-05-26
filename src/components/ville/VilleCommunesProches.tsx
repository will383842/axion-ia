/**
 * VilleCommunesProches — Grille des 8-12 communes proches d'une ville, avec
 * maillage interne SEO et JSON-LD ItemList AEO.
 *
 * Sprint A — composant partagé Server. Utilisable depuis :
 *   1) Hub ville `/{locale}/implantations/{region}/{ville}` — `verticale` absent → liens vers hub ville voisin.
 *   2) Page ville × verticale `/{locale}/implantations/{region}/{ville}/{verticale}` — liens vers même verticale.
 *
 * Données : in-memory `VILLES` SSOT (`@/content/villes`) + helper `getNearbyVilles`
 * (Haversine, déjà testé). PAS de table Prisma `Ville` dans ce repo — la SSOT est TS
 * hardcodée (cf. ADR 0006). Guard `stub.invalid` (ADR 0026) néanmoins présent par
 * défensivité (early-exit no-op si jamais le composant tape un client Prisma stub
 * dans une future évolution).
 */

import { Link } from "@/i18n/navigation";
import type { Ville } from "@/content/villes";
import type { VerticaleSlug } from "@/components/services/types";
import { getNearbyVilles } from "@/lib/geo";
import { fmtPopulation } from "@/lib/intl";
import { SITE_URL } from "@/lib/seo";
import { Container } from "@/components/layout/Container";

interface VilleCommunesProchesProps {
  /** Ville source (composite TS hardcode SSOT, cf. `@/content/villes`). */
  readonly ville: Ville;
  /**
   * Verticale optionnelle. Si présente, les liens pointent vers
   * `/implantations/{region}/{slug}/{verticale}` (page service × ville).
   * Si absente, les liens pointent vers `/implantations/{region}/{slug}`
   * (hub ville générique).
   */
  readonly verticale?: VerticaleSlug;
  /** Locale active (FR canonique, EN miroir). */
  readonly isFr: boolean;
}

/** Nombre de communes proches affichées (cap supérieur — JSON-LD ItemList Google). */
const MAX_NEARBY = 12;

/**
 * Construit le JSON-LD ItemList Google/AEO listant les communes proches.
 * Format Schema.org standard : position 1-N + url + name (anti-spam).
 */
function buildItemListJsonLd(args: {
  readonly sourceName: string;
  readonly items: ReadonlyArray<{ readonly url: string; readonly name: string }>;
  readonly isFr: boolean;
}): string {
  const payload = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: args.isFr ? `Communes proches de ${args.sourceName}` : `Cities near ${args.sourceName}`,
    numberOfItems: args.items.length,
    itemListElement: args.items.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: it.url,
      name: it.name,
    })),
  };
  return JSON.stringify(payload);
}

/**
 * Server Component async — calcule les communes proches via Haversine puis
 * rend une grille responsive (2/3/4 colonnes) + JSON-LD ItemList.
 * Retourne `null` si aucune commune proche n'est trouvée (anti-section-vide).
 */
export async function VilleCommunesProches(props: VilleCommunesProchesProps) {
  const { ville, verticale, isFr } = props;

  // ADR 0026 — early-exit en build stub (no DB available). Le helper actuel
  // est in-memory donc immune, mais on garde le guard par défensivité.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    return null;
  }

  // 1) Idéal : tenter la même région (maillage SEO cohérent), trier par distance.
  // 2) Fallback automatique du helper : pas de filtre région → scan global.
  let nearby = getNearbyVilles(ville.geo, MAX_NEARBY, {
    excludeSlug: ville.slug,
    sameRegion: ville.region,
  });
  if (nearby.length === 0) {
    // Fallback : même département puis global, sans contrainte région.
    nearby = getNearbyVilles(ville.geo, MAX_NEARBY, {
      excludeSlug: ville.slug,
    });
  }

  if (nearby.length === 0) {
    return null; // anti-section-vide (spec)
  }

  const suffix = verticale ? `/${verticale}` : "";
  const sectionId = `ville-communes-proches-${ville.slug}`;
  const headingId = `${sectionId}-h`;

  // P0-04 audit E2E Sprint A 2026-05-25 — ItemList Schema.org exige des URLs
  // absolues. Les URLs relatives sont rejetées par Google AI Overviews / Perplexity
  // pour le maillage AEO (~12 900 pages impactées avant correctif).
  const localePrefix = isFr ? "fr" : "en";
  const jsonLdItems = nearby.map(({ ville: v }) => ({
    url: `${SITE_URL}/${localePrefix}/implantations/${v.region}/${v.slug}${suffix}`,
    name: v.nameFr,
  }));

  return (
    <section aria-labelledby={headingId} className="bg-bg py-12 sm:py-16">
      <Container>
        {/* Encadrement léger (Will 2026-05-26) — la liste des communes
            proches était visuellement plate. Card avec border + rounded +
            shadow-subtle pour un bloc cohérent et premium. */}
        <div className="bg-paper border-border shadow-subtle rounded-2xl border p-6 sm:p-8 lg:p-10">
          <h2
            id={headingId}
            className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? `Communes proches de ${ville.nameFr}` : `Cities near ${ville.nameFr}`}
          </h2>
          <p className="text-fg-soft mt-3 max-w-2xl text-base leading-relaxed">
            {isFr
              ? verticale
                ? `Communes éligibles aux mêmes prestations dans un rayon proche de ${ville.nameFr}, triées par distance.`
                : `Communes alentours couvertes par Axion-IA, triées par distance depuis ${ville.nameFr}.`
              : verticale
                ? `Cities eligible for the same services within close range of ${ville.nameFr}, sorted by distance.`
                : `Surrounding cities covered by Axion-IA, sorted by distance from ${ville.nameFr}.`}
          </p>
          <ul role="list" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {nearby.map(({ ville: v, distanceKm }) => (
              <li key={v.slug}>
                <Link
                  href={`/implantations/${v.region}/${v.slug}${suffix}` as never}
                  data-source-region={v.region}
                  data-source-ville={v.slug}
                  data-cta-tracking={verticale ? `ville_${verticale}_nearby` : `ville_hub_nearby`}
                  className="group hover:bg-sand focus-visible:ring-terracotta block rounded-lg px-3 py-2.5 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span
                    className="text-fg group-hover:text-terracotta block text-sm font-semibold tracking-tight transition"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {v.nameFr}
                  </span>
                  <span className="text-fg-muted mt-0.5 block text-[11px] tabular-nums">
                    {Math.round(distanceKm)} km
                    {v.population > 0
                      ? ` · ${fmtPopulation(v.population, isFr ? "fr" : "en")} ${isFr ? "hab." : "inhab."}`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* JSON-LD ItemList — AEO / Google AI Overviews maillage interne. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: buildItemListJsonLd({
                sourceName: ville.nameFr,
                items: jsonLdItems,
                isFr,
              }),
            }}
          />
        </div>
      </Container>
    </section>
  );
}
