import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";

// Sprint 5+ will append product pages and Sprint 15 will plug Prisma for blog
// + case studies. Sprint 2 ships only the routes that exist today.
const STATIC_PATHS = ["/"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return STATIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => {
      const fullPath = path === "/" ? "" : path;
      const url = `${SITE_URL}/${locale}${fullPath}`;
      const languages = Object.fromEntries(
        routing.locales.map((alt) => [alt, `${SITE_URL}/${alt}${fullPath}`]),
      ) as Record<(typeof routing.locales)[number], string>;
      return {
        url,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: path === "/" ? 1 : 0.8,
        alternates: {
          languages: {
            ...languages,
            "x-default": `${SITE_URL}/${routing.defaultLocale}${fullPath}`,
          },
        },
      };
    }),
  );
}
