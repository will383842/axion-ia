import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";
import { getAllSlugs as getAllCaseStudySlugs, getAllIndustrySlugs } from "@/content/case-studies";
import {
  getAllBlogSlugs,
  getAllBlogCategorySlugs,
  getAllBlogTagSlugs,
  getAllBlogAuthorSlugs,
  getAllFaqIds,
  getAllHelpSlugs,
  getAllHelpCategorySlugs,
  BLOG_POSTS,
} from "@/content/transversal";
import { getAllComparisonSlugs } from "@/content/comparaisons";
import { AUTOMATISATION_SLUGS_FR, AUTOMATISATION_SLUGS_EN } from "@/content/automatisations";

// Next.js 16 sitemap-index pattern via `generateSitemaps()`.
// `/sitemap.xml`         = sitemap-index (auto, lists sub-sitemaps)
// `/sitemap/pages.xml`   = static routes (excluding [slug] templates + dev shells)
// `/sitemap/blog.xml`    = posts + categories + tags + authors (lastModified = publishedAt)
// `/sitemap/help.xml`    = centre-aide + faq
// `/sitemap/cas-concrets.xml`  = case studies + industry filters
// `/sitemap/comparaisons.xml`  = comparison pages
// `/sitemap/implementation.xml`= /par-fonction/[slug] programmatic (G5 fix)
//
// Why split? Google limit = 50K URLs/sitemap, but signal quality also degrades
// past ~1K URLs in a single flat file. Splitting by section gives:
//   - faster crawl prioritization (blog weekly vs pages stable)
//   - clearer Search Console diagnostics per section
//   - room to scale to Sprint 15 cibles (régions ~18, villes ~1160 V1)
//     without rewriting this file again — just append `regions` + `villes-[region]` ids.
//
// Each entry exposes `alternates.languages` per next-intl pathnames map so
// search engines pick the correct localized URL (Google ignores `priority`
// since 2017 but still uses hreflang + lastmod + changefreq for crawl
// budget allocation).

type SitemapId =
  | "pages"
  | "blog"
  | "help"
  | "cas-concrets"
  | "comparaisons"
  | "implementation"
  | "implantations";

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

// `generateSitemaps` — declares the sub-sitemaps. Next.js 16 wraps these in
// an automatic sitemap-index at `/sitemap.xml` and exposes each child at
// `/sitemap/<id>.xml`. Adding a new section = one entry here + one builder
// below. No infra change needed for Sprint 15 villes/régions.
export async function generateSitemaps(): Promise<Array<{ id: SitemapId }>> {
  return [
    { id: "pages" },
    { id: "blog" },
    { id: "help" },
    { id: "cas-concrets" },
    { id: "comparaisons" },
    { id: "implementation" },
  ];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = (await props.id) as SitemapId;
  const now = new Date();
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
    default:
      return [];
  }
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
  const datesBySlug = new Map(BLOG_POSTS.map((p) => [p.slug, p.publishedAt]));
  return buildDynamic(
    [
      {
        fr: "/blog/:slug",
        slugs: getAllBlogSlugs(),
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
