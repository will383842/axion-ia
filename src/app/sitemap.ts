import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getAllSlugs as getAllCaseStudySlugs, getAllIndustrySlugs } from "@/content/case-studies";
import {
  getAllBlogSlugs,
  getAllBlogCategorySlugs,
  getAllBlogTagSlugs,
  getAllBlogAuthorSlugs,
  getAllFaqIds,
  getAllHelpSlugs,
  getAllHelpCategorySlugs,
} from "@/content/transversal";
import { getAllComparisonSlugs } from "@/content/comparaisons";

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";

// Sitemap covers every public route declared in `routing.pathnames`, plus
// dynamic enumerations for each programmatic pattern (blog categories/tags/
// authors, FAQ entries, help articles, case-study industries, comparisons).
//
// Excluded:
//   - dev shells (`/components`, `/design`, `/sections`)
//   - private/no-index pages (`/desabonnement`, `/mes-donnees`,
//     `/confirmation`, `/recherche`, `/preferences-cookies`)
//   - dynamic [slug] templates themselves (we emit each resolved slug below).
//
// Each static entry exposes `alternates.languages` per next-intl pathnames
// map, so search engines pick the correct localized URL.
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
  return (key as string).includes("[slug]");
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
  slugs: ReadonlyArray<string>;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}

function buildDynamic(entries: ReadonlyArray<DynamicSlug>, now: Date): MetadataRoute.Sitemap {
  const out: MetadataRoute.Sitemap = [];
  for (const entry of entries) {
    for (const slug of entry.slugs) {
      out.push({
        url: `${SITE_URL}/fr${entry.fr.replace(":slug", slug)}`,
        lastModified: now,
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
        alternates: {
          languages: {
            fr: `${SITE_URL}/fr${entry.fr.replace(":slug", slug)}`,
            en: `${SITE_URL}/en${(entry.en ?? entry.fr).replace(":slug", slug)}`,
            "x-default": `${SITE_URL}/fr${entry.fr.replace(":slug", slug)}`,
          },
        },
      });
      out.push({
        url: `${SITE_URL}/en${(entry.en ?? entry.fr).replace(":slug", slug)}`,
        lastModified: now,
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
      });
    }
  }
  return out;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
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

  entries.push(
    ...buildDynamic(
      [
        {
          fr: "/cas-concrets/:slug",
          slugs: getAllCaseStudySlugs(),
          changeFrequency: "monthly",
          priority: 0.6,
        },
        {
          fr: "/blog/:slug",
          slugs: getAllBlogSlugs(),
          changeFrequency: "monthly",
          priority: 0.5,
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
        {
          fr: "/faq/:slug",
          slugs: getAllFaqIds(),
          changeFrequency: "monthly",
          priority: 0.7,
        },
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
          fr: "/cas-concrets/secteur/:slug",
          en: "/case-studies/industry/:slug",
          slugs: getAllIndustrySlugs(),
          changeFrequency: "monthly",
          priority: 0.5,
        },
        {
          fr: "/comparaisons/:slug",
          slugs: getAllComparisonSlugs(),
          changeFrequency: "monthly",
          priority: 0.5,
        },
      ],
      now,
    ),
  );

  return entries;
}
