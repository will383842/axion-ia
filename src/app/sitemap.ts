import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getAllSlugs as getAllCaseStudySlugs } from "@/content/case-studies";
import { getAllBlogSlugs } from "@/content/transversal";

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";

// Sitemap covers every public route declared in `routing.pathnames`, plus
// the dynamic case-study + blog slugs from the TS content packs (Prisma
// integration arrives Sprint 15).
//
// Dev-only routes (`/components`, `/design`, `/sections`) are intentionally
// excluded — they're already disallowed in `robots.ts`.
//
// Each entry exposes `alternates.languages` per next-intl pathnames map,
// so search engines pick the correct localized URL.
type PathnameKey = keyof typeof routing.pathnames;

const EXCLUDED_FROM_INDEX: ReadonlyArray<PathnameKey> = ["/design", "/components", "/sections"];

function localizedHref(key: PathnameKey, locale: (typeof routing.locales)[number]): string {
  const def = routing.pathnames[key];
  if (typeof def === "string") return def;
  // Per-locale map (FR canonical / EN mirror).
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

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [];

  for (const key of Object.keys(routing.pathnames) as PathnameKey[]) {
    if (EXCLUDED_FROM_INDEX.includes(key)) continue;
    for (const locale of routing.locales) {
      const url = `${SITE_URL}/${locale}${localizedHref(key, locale)}`;
      staticEntries.push({
        url,
        lastModified: now,
        changeFrequency: "weekly",
        priority: key === "/" ? 1 : key.split("/").length === 2 ? 0.8 : 0.6,
        alternates: { languages: alternateLanguages(key) },
      });
    }
  }

  // Dynamic content: case studies + blog posts.
  const caseSlugs = getAllCaseStudySlugs();
  for (const slug of caseSlugs) {
    for (const locale of routing.locales) {
      staticEntries.push({
        url: `${SITE_URL}/${locale}/cas-concrets/${slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }
  const blogSlugs = getAllBlogSlugs();
  for (const slug of blogSlugs) {
    for (const locale of routing.locales) {
      staticEntries.push({
        url: `${SITE_URL}/${locale}/blog/${slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  return staticEntries;
}
