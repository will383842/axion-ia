import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";
import { getAllSlugs as getAllCaseStudySlugs, getAllIndustrySlugs } from "@/content/case-studies";
import {
  getAllBlogCategorySlugs,
  getAllBlogTagSlugs,
  getAllBlogAuthorSlugs,
  getAllFaqIds,
  getAllHelpSlugs,
  getAllHelpCategorySlugs,
} from "@/content/transversal";
import { getAllComparisonSlugs } from "@/content/comparaisons";
import { AUTOMATISATION_SLUGS_FR, AUTOMATISATION_SLUGS_EN } from "@/content/automatisations";
import { getIndexableRegions } from "@/content/regions";
import { getIndexableVilles } from "@/content/villes";
import {
  getIndexableBlogPosts,
  getAllBlogSectorSlugs,
  getAllBlogCompanySizeSlugs,
  getAllBlogServiceTypeSlugs,
} from "@/content/blog";

// Next.js 16 sitemap-index pattern via `generateSitemaps()`.
//
// Static sub-sitemaps :
//   /sitemap.xml                    = sitemap-index (auto, lists sub-sitemaps)
//   /sitemap/pages.xml              = static routes (excluding [slug] templates + dev shells)
//   /sitemap/blog.xml               = posts + categories + tags + authors (lastModified = publishedAt)
//   /sitemap/help.xml               = centre-aide + faq
//   /sitemap/cas-concrets.xml       = case studies + industry filters
//   /sitemap/comparaisons.xml       = comparison pages
//   /sitemap/implementation.xml     = /par-fonction/[slug] programmatic
//   /sitemap/implantations.xml      = hub + 12 régions indexable (Corse noindex)
//
// Dynamic sub-sitemaps (auto-paginés à 1 000 URLs max — best practice 2026) :
//   /sitemap/villes-<region>.xml         = villes indexables de la région (≤ 1 000 URLs)
//   /sitemap/villes-<region>-<n>.xml     = chunk N quand région > 500 villes indexables
//
// Why split + chunking?
//   - Google hard limit = 50 000 URLs/sitemap, mais qualité crawl dégrade > 1 000 URLs/file
//   - Search Console diagnostics granulaires (problème localisé à 1 chunk de 1K, pas 50K)
//   - Scale 100 K+ URLs sans toucher à ce fichier — `getIndexableVilles()` peut grandir
//     à 2 150 villes (V2 phase 2/3) ou plus, le chunking auto suit
//   - Crawl budget priorisé : Google peut « refresher » `pages` (weekly) sans re-crawler
//     les chunks villes (monthly)
//
// Each entry exposes `alternates.languages` per next-intl pathnames map so
// search engines pick the correct localized URL (Google ignores `priority`
// since 2017 but still uses hreflang + lastmod + changefreq for crawl budget).

/**
 * Best-practice cap par sub-sitemap : 1 000 URLs.
 * Limite hard Google = 50 000. On reste à 2 % du plafond pour garder
 * Search Console lisible et le crawl budget bien alloué.
 */
const SITEMAP_CHUNK_SIZE = 1000;

type StaticSitemapId =
  | "pages"
  | "blog"
  | "help"
  | "cas-concrets"
  | "comparaisons"
  | "implementation"
  | "implantations"
  | "services-villes-audit"
  | "services-villes-interventions"
  | "services-villes-implementation";

type ServiceVillesKey = "audit" | "interventions" | "implementation";

type PathnameKey = keyof typeof routing.pathnames;

const EXCLUDED_FROM_INDEX: ReadonlyArray<PathnameKey> = [
  "/design",
  "/components",
  "/sections",
  "/desabonnement",
  "/mes-donnees",
  "/confirmation",
  "/recherche",
  "/preferences-cookies",
];

function isSlugTemplate(key: PathnameKey): boolean {
  return /\[[^\]]+\]/.test(key as string);
}

function localizedHref(key: PathnameKey, locale: (typeof routing.locales)[number]): string {
  const def = routing.pathnames[key];
  if (typeof def === "string") return def;
  return (def as Record<string, string>)[locale] ?? (def as Record<string, string>).fr ?? key;
}

function alternateLanguages(
  key: PathnameKey,
): Record<(typeof routing.locales)[number] | "x-default", string> {
  const map = Object.fromEntries(
    routing.locales.map((alt) => [alt, `${SITE_URL}/${alt}${localizedHref(key, alt)}`]),
  ) as Record<(typeof routing.locales)[number], string>;
  return {
    ...map,
    "x-default": `${SITE_URL}/${routing.defaultLocale}${localizedHref(key, routing.defaultLocale)}`,
  };
}

interface DynamicSlug {
  /** FR-canonical path with `:slug` placeholder. */
  fr: string;
  /** EN mirror path (defaults to FR). */
  en?: string;
  /** FR-canonical slugs. */
  slugs: ReadonlyArray<string>;
  /**
   * Optional EN-translated slugs aligned by index with `slugs`.
   * Use when EN slug is genuinely different (ex: `customer-service` for
   * `service-client` in `/implementation/by-function/`). Defaults to `slugs`.
   */
  slugsEn?: ReadonlyArray<string>;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
  /** Optional per-slug lastModified resolver. Defaults to `now`. */
  lastModFor?: (slug: string) => Date | string;
}

function buildDynamic(entries: ReadonlyArray<DynamicSlug>, now: Date): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  for (const entry of entries) {
    for (let i = 0; i < entry.slugs.length; i++) {
      const slugFr = entry.slugs[i]!;
      const slugEn = entry.slugsEn?.[i] ?? slugFr;
      const lastMod = entry.lastModFor?.(slugFr) ?? now;
      const frUrl = `${SITE_URL}/fr${entry.fr.replace(":slug", slugFr)}`;
      const enUrl = `${SITE_URL}/en${(entry.en ?? entry.fr).replace(":slug", slugEn)}`;
      out.push({
        url: frUrl,
        lastModified: lastMod,
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
        alternates: {
          languages: {
            fr: frUrl,
            en: enUrl,
            "x-default": frUrl,
          },
        },
      });
      out.push({
        url: enUrl,
        lastModified: lastMod,
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
        alternates: {
          languages: {
            fr: frUrl,
            en: enUrl,
            "x-default": frUrl,
          },
        },
      });
    }
  }
  return out;
}

// Liste stable des IDs villes-<region>[-<chunk>] dérivée de `getIndexableVilles()`.
// L'ordre est déterministe (par regionSlug ascendant + chunkIdx) pour que les IDs
// restent identiques entre builds — Google n'aime pas qu'un sub-sitemap apparaisse
// puis disparaisse sans raison.
function getVillesSitemapIds(): string[] {
  const ids: string[] = [];
  const indexable = getIndexableVilles();
  const regions = [...getIndexableRegions()].sort((a, b) => a.slug.localeCompare(b.slug));

  for (const region of regions) {
    const villesInRegion = indexable.filter((v) => v.region === region.slug);
    if (villesInRegion.length === 0) continue;

    // 2 locales (FR + EN) par ville → multiplie le compte d'URLs par 2
    const totalUrls = villesInRegion.length * 2;
    const chunkCount = Math.ceil(totalUrls / SITEMAP_CHUNK_SIZE);

    if (chunkCount <= 1) {
      ids.push(`villes-${region.slug}`);
    } else {
      for (let i = 1; i <= chunkCount; i++) {
        ids.push(`villes-${region.slug}-${i}`);
      }
    }
  }
  return ids;
}

// `generateSitemaps` — déclare tous les sub-sitemaps (statiques + dynamiques villes).
// Next.js 16 wrap ces IDs dans `/sitemap.xml` (sitemap-index auto) et expose
// chaque enfant à `/sitemap/<id>.xml`.
export async function generateSitemaps(): Promise<Array<{ id: string }>> {
  const staticIds: StaticSitemapId[] = [
    "pages",
    "blog",
    "help",
    "cas-concrets",
    "comparaisons",
    "implementation",
    "implantations",
    "services-villes-audit",
    "services-villes-interventions",
    "services-villes-implementation",
  ];
  return [...staticIds.map((id) => ({ id })), ...getVillesSitemapIds().map((id) => ({ id }))];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const now = new Date();

  // Static IDs
  switch (id) {
    case "pages":
      return buildPagesSitemap(now);
    case "blog":
      return buildBlogSitemap(now);
    case "help":
      return buildHelpSitemap(now);
    case "cas-concrets":
      return buildCasConcretsSitemap(now);
    case "comparaisons":
      return buildComparaisonsSitemap(now);
    case "implementation":
      return buildImplementationSitemap(now);
    case "implantations":
      return buildImplantationsHubSitemap(now);
    case "services-villes-audit":
      return buildServicesVillesSitemap(now, "audit");
    case "services-villes-interventions":
      return buildServicesVillesSitemap(now, "interventions");
    case "services-villes-implementation":
      return buildServicesVillesSitemap(now, "implementation");
  }

  // Dynamic IDs : `villes-<regionSlug>` ou `villes-<regionSlug>-<chunkIdx>`.
  // Les regionSlugs ne se terminent jamais par `-<chiffres>` (cf. REGIONS),
  // donc parsing structurel sans ambiguïté.
  if (id.startsWith("villes-")) {
    const rest = id.slice("villes-".length);
    const trailMatch = rest.match(/^(.+)-(\d+)$/);
    if (trailMatch) {
      return buildVillesByRegionSitemap(trailMatch[1]!, parseInt(trailMatch[2]!, 10), now);
    }
    return buildVillesByRegionSitemap(rest, 1, now);
  }

  return [];
}

// ---------- builders ----------

// Static routes — declared in `routing.pathnames` minus excluded + slug templates.
// Priority 1.0 (home) > 0.8 (depth 2) > 0.6 (depth ≥ 3). changefreq weekly.
function buildPagesSitemap(now: Date): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const key of Object.keys(routing.pathnames) as PathnameKey[]) {
    if (EXCLUDED_FROM_INDEX.includes(key)) continue;
    if (isSlugTemplate(key)) continue;
    for (const locale of routing.locales) {
      const url = `${SITE_URL}/${locale}${localizedHref(key, locale)}`;
      entries.push({
        url,
        lastModified: now,
        changeFrequency: "weekly",
        priority: key === "/" ? 1 : (key as string).split("/").length === 2 ? 0.8 : 0.6,
        alternates: { languages: alternateLanguages(key) },
      });
    }
  }
  return entries;
}

// Blog posts use real `publishedAt` for `lastModified` — Google rewards
// accurate lastmod (signal not gameable, used for crawl prioritization).
// Categories / tags / authors stay on `now` (the listing page changes when
// a new post enters the corpus).
function buildBlogSitemap(now: Date): MetadataRoute.Sitemap {
  // Anti-doorway HCU 2024 (Sprint 14.10) : seuls les articles tier-1 (validés
  // qualité + score ≥ 70 + body ≥ 800 mots + faq ≥ 4 + directAnswer 40-80 mots)
  // entrent dans le sitemap. Tier-2 (bulk en attente review) et tier-3 (drafts)
  // restent crawlable mais hors sitemap → crawl budget Google concentré.
  const indexable = getIndexableBlogPosts();
  const indexableSlugs = indexable.map((p) => p.slug);
  const datesBySlug = new Map(indexable.map((p) => [p.slug, p.publishedAt]));
  return buildDynamic(
    [
      {
        fr: "/blog/:slug",
        slugs: indexableSlugs,
        changeFrequency: "monthly",
        priority: 0.5,
        lastModFor: (slug) => datesBySlug.get(slug) ?? now,
      },
      {
        fr: "/blog/categorie/:slug",
        en: "/blog/category/:slug",
        slugs: getAllBlogCategorySlugs(),
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        fr: "/blog/tag/:slug",
        slugs: getAllBlogTagSlugs(),
        changeFrequency: "monthly",
        priority: 0.4,
      },
      {
        fr: "/blog/auteur/:slug",
        en: "/blog/author/:slug",
        slugs: getAllBlogAuthorSlugs(),
        changeFrequency: "monthly",
        priority: 0.4,
      },
      // Sprint 14.10 — pages taxonomies métier (secteur · taille · service).
      {
        fr: "/blog/secteur/:slug",
        en: "/blog/sector/:slug",
        slugs: [...getAllBlogSectorSlugs()],
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        fr: "/blog/taille/:slug",
        en: "/blog/size/:slug",
        slugs: [...getAllBlogCompanySizeSlugs()],
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        fr: "/blog/service/:slug",
        slugs: [...getAllBlogServiceTypeSlugs()],
        changeFrequency: "monthly",
        priority: 0.5,
      },
    ],
    now,
  );
}

function buildHelpSitemap(now: Date): MetadataRoute.Sitemap {
  return buildDynamic(
    [
      {
        fr: "/centre-aide/:slug",
        en: "/help/:slug",
        slugs: getAllHelpSlugs(),
        changeFrequency: "monthly",
        priority: 0.6,
      },
      {
        fr: "/centre-aide/categorie/:slug",
        en: "/help/category/:slug",
        slugs: getAllHelpCategorySlugs(),
        changeFrequency: "monthly",
        priority: 0.5,
      },
      {
        fr: "/faq/:slug",
        slugs: getAllFaqIds(),
        changeFrequency: "monthly",
        priority: 0.7,
      },
    ],
    now,
  );
}

function buildCasConcretsSitemap(now: Date): MetadataRoute.Sitemap {
  return buildDynamic(
    [
      {
        fr: "/cas-concrets/:slug",
        slugs: getAllCaseStudySlugs(),
        changeFrequency: "monthly",
        priority: 0.6,
      },
      {
        fr: "/cas-concrets/secteur/:slug",
        en: "/case-studies/industry/:slug",
        slugs: getAllIndustrySlugs(),
        changeFrequency: "monthly",
        priority: 0.5,
      },
    ],
    now,
  );
}

function buildComparaisonsSitemap(now: Date): MetadataRoute.Sitemap {
  return buildDynamic(
    [
      {
        fr: "/comparaisons/:slug",
        slugs: getAllComparisonSlugs(),
        changeFrequency: "monthly",
        priority: 0.5,
      },
    ],
    now,
  );
}

function buildImplementationSitemap(now: Date): MetadataRoute.Sitemap {
  return buildDynamic(
    [
      {
        fr: "/implementation/par-fonction/:slug",
        en: "/implementation/by-function/:slug",
        slugs: AUTOMATISATION_SLUGS_FR,
        slugsEn: AUTOMATISATION_SLUGS_EN,
        changeFrequency: "monthly",
        priority: 0.6,
      },
    ],
    now,
  );
}

// pSEO Implantations — hub + régions indexable seulement.
// Anti-doorway HCU 2024 : seules les régions `noindex: false` entrent ici.
// Les villes sont émises dans des sub-sitemaps dédiés `villes-<region>(-<n>)`
// pour rester sous SITEMAP_CHUNK_SIZE par fichier (best practice 2026).
function buildImplantationsHubSitemap(now: Date): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // Hub /implantations · /locations
  const hubFr = `${SITE_URL}/fr/implantations`;
  const hubEn = `${SITE_URL}/en/locations`;
  for (const url of [hubFr, hubEn]) {
    entries.push({
      url,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: { languages: { fr: hubFr, en: hubEn, "x-default": hubFr } },
    });
  }

  // Régions indexable (12 métropole en V1, Corse reste noindex)
  for (const region of getIndexableRegions()) {
    const frUrl = `${SITE_URL}/fr/implantations/${region.slug}`;
    const enUrl = `${SITE_URL}/en/locations/${region.slug}`;
    const langs = { fr: frUrl, en: enUrl, "x-default": frUrl };
    entries.push({
      url: frUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: langs },
    });
    entries.push({
      url: enUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: langs },
    });
  }

  return entries;
}

// pSEO Villes — sub-sitemap par région (chunké à SITEMAP_CHUNK_SIZE URLs).
// Anti-doorway HCU 2024 : `getIndexableVilles()` filtre déjà sur `copy` présent
// (V1 = Paris uniquement) → garantie zéro page thin dans le sitemap. Les ~2 280
// stubs structurels SSG existent physiquement mais portent `<meta robots="noindex">`
// côté page et n'apparaissent jamais ici.
//
// Ordre tri par slug ascendant pour que le découpage en chunks soit déterministe
// — un nouveau ville indexable change le contenu d'1 chunk, pas l'ordre des autres.
function buildVillesByRegionSitemap(
  regionSlug: string,
  chunkIdx: number,
  now: Date,
): MetadataRoute.Sitemap {
  const villesInRegion = [...getIndexableVilles()]
    .filter((v) => v.region === regionSlug)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  // Build all URL pairs (FR + EN) for the region, paire par paire pour qu'un
  // chunk contienne toujours une ville complète (pas FR sur chunk N + EN sur N+1).
  const allUrls: MetadataRoute.Sitemap = [];
  for (const ville of villesInRegion) {
    const frUrl = `${SITE_URL}/fr/implantations/${ville.region}/${ville.slug}`;
    const enUrl = `${SITE_URL}/en/locations/${ville.region}/${ville.slug}`;
    const langs = { fr: frUrl, en: enUrl, "x-default": frUrl };
    allUrls.push({
      url: frUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: langs },
    });
    allUrls.push({
      url: enUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: langs },
    });
  }

  // Slice par chunkIdx (1-indexed). Hors limites = array vide (sitemap ignoré).
  const start = (chunkIdx - 1) * SITEMAP_CHUNK_SIZE;
  return allUrls.slice(start, start + SITEMAP_CHUNK_SIZE);
}

// pSEO services × villes — 3 services × villes pilotes (avec copy.services).
// Sprint 14.10.1 Commit B : émet `/audit/par-ville/<ville>`,
// `/interventions/par-ville/<ville>`, `/implementation/par-ville/<ville>`
// uniquement pour les villes dont `copy.services.<service>` est présent
// (auto-promotion tier-1 dès qu'il y a un copy substantiel — décision Will
// 2026-05-08 « toutes les villes indexables »).
//
// V1 = Paris seul a copy.services → 6 URLs (3 services × 2 locales). Quand
// l'outil de génération produit les copies pour toutes les villes pilotes,
// volume cible : ~50 villes × 3 services × 2 locales = 300 URLs Phase 1,
// puis ~2150 × 3 × 2 = 12 900 URLs Phase 3 (chunking auto à activer).
// C6 cert 2026-05-08 : split en 3 sub-sitemaps par service pour anticiper
// le scale 2150 villes × 3 services × 2 locales = 12 900 URLs (chaque service
// = 4 300 URLs max, sous le cap 50 000 imposé par sitemaps.org). Search Console
// préfère des sub-sitemaps homogènes par template plutôt qu'un mega-sitemap mixte.
const SERVICE_VILLES_PATHS: Record<ServiceVillesKey, { pathFr: string; pathEn: string }> = {
  audit: { pathFr: "/audit/par-ville", pathEn: "/audit/by-city" },
  interventions: { pathFr: "/interventions/par-ville", pathEn: "/interventions/by-city" },
  implementation: { pathFr: "/implementation/par-ville", pathEn: "/implementation/by-city" },
};

function buildServicesVillesSitemap(now: Date, service: ServiceVillesKey): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const { pathFr, pathEn } = SERVICE_VILLES_PATHS[service];

  for (const ville of getIndexableVilles()) {
    if (!ville.copy?.services?.[service]) continue;
    const frUrl = `${SITE_URL}/fr${pathFr}/${ville.slug}`;
    const enUrl = `${SITE_URL}/en${pathEn}/${ville.slug}`;
    const langs = { fr: frUrl, en: enUrl, "x-default": frUrl };
    entries.push({
      url: frUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: langs },
    });
    entries.push({
      url: enUrl,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: langs },
    });
  }
  return entries;
}
