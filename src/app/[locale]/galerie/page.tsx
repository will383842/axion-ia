/**
 * Public page — `/[locale]/galerie/page.tsx` (INDEX galerie + filtres URL)
 *
 * Affiche grid d'images avec filtres URL params (module, subModule, targetCity, etc.).
 * Server Component avec ISR `revalidate=3600`.
 * Cible : LCP ≤ 1800ms p75, INP ≤ 80ms, CLS ≤ 0.05.
 *
 * À placer dans `axionia/src/app/[locale]/galerie/page.tsx`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GalleryGrid } from "@/components/galerie/GalleryGrid";
import { buildGalleryHubGraph } from "@/server/image-bank/services/image-jsonld-graph.service";
import {
  type Module,
  isValidModule,
  getModuleLabel,
  MODULE_LABELS_FR,
  MODULE_LABELS_EN,
} from "@/server/image-bank/taxonomy";

type Filters = {
  module?: string;
  subModule?: string;
  targetCity?: string;
  targetRegion?: string;
  targetSize?: string;
  targetPersona?: string;
  targetSector?: string;
  targetTechno?: string;
  page?: string;
};

const PAGE_SIZE = 24;

// ──────────────────────────────────────────────────────────
// Metadata dynamique selon filtres
// ──────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: "fr" | "en" }>;
  searchParams: Promise<Filters>;
}): Promise<Metadata> {
  const { locale } = await params;
  const filters = await searchParams;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";

  let title = locale === "fr" ? "Banque d'images Axion-IA" : "Axion-IA Image Bank";
  const description =
    locale === "fr"
      ? "Banque d'images Axion-IA — IA opérationnelle, audits IA, implémentations Claude. Toutes sous licence CC BY 4.0."
      : "Axion-IA image bank — operational AI, AI audits, Claude implementations. All under CC BY 4.0 license.";

  if (filters.module && isValidModule(filters.module)) {
    const moduleLabel = getModuleLabel(filters.module as Module, locale);
    title =
      locale === "fr"
        ? `${moduleLabel} — Banque d'images | Axion-IA`
        : `${moduleLabel} — Image bank | Axion-IA`;
    if (filters.targetCity) {
      title =
        locale === "fr"
          ? `${moduleLabel} à ${capitalizeCity(filters.targetCity)} — Banque d'images | Axion-IA`
          : `${moduleLabel} in ${capitalizeCity(filters.targetCity)} — Image bank | Axion-IA`;
    }
  }

  const canonicalPath = `/${locale}/galerie${buildQueryString(filters)}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        "fr-FR": `${siteUrl}/fr/galerie${buildQueryString(filters)}`,
        "en-US": `${siteUrl}/en/gallery${buildQueryString(filters)}`,
        "x-default": `${siteUrl}/fr/galerie`,
      },
    },
    openGraph: {
      title,
      description,
      images: [{ url: `${siteUrl}/og/image-bank-hub.webp`, width: 1200, height: 630 }],
      locale: locale === "fr" ? "fr_FR" : "en_US",
      type: "website",
    },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  };
}

// ──────────────────────────────────────────────────────────
// Page Server Component
// ──────────────────────────────────────────────────────────

export default async function GalleryIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: "fr" | "en" }>;
  searchParams: Promise<Filters>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  const pageNum = Math.max(1, Number(filters.page ?? "1"));
  const offset = (pageNum - 1) * PAGE_SIZE;

  const where = {
    deletedAt: null,
    isActive: true,
    publishedAt: { not: null },
    ...(filters.module ? { module: filters.module } : {}),
    ...(filters.subModule ? { subModule: filters.subModule } : {}),
    ...(filters.targetCity ? { targetCity: filters.targetCity } : {}),
    ...(filters.targetRegion ? { targetRegion: filters.targetRegion } : {}),
    ...(filters.targetSize ? { targetSize: filters.targetSize } : {}),
    ...(filters.targetPersona ? { targetPersona: filters.targetPersona } : {}),
    ...(filters.targetSector ? { targetSector: filters.targetSector } : {}),
    ...(filters.targetTechno ? { targetTechno: filters.targetTechno } : {}),
    translations: { some: { languageCode: locale, isPublished: true } },
  };

  const [images, total] = await Promise.all([
    prisma.imageAsset.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { embedCount: "desc" }, { publishedAt: "desc" }],
      skip: offset,
      take: PAGE_SIZE,
      include: { translations: { where: { languageCode: locale }, take: 1 } },
    }),
    prisma.imageAsset.count({ where }),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const pageUrl = `${siteUrl}/${locale}/galerie${buildQueryString(filters)}`;

  const graph = buildGalleryHubGraph({
    locale,
    pageUrl,
    hubModule: (["interventions", "audits", "implementations"] as const).includes(
      filters.module as "interventions" | "audits" | "implementations",
    )
      ? (filters.module as "interventions" | "audits" | "implementations")
      : null,
    totalImages: total,
    images: images.map((i) => ({
      id: i.id,
      slug: i.translations[0]?.slug ?? i.id,
      width: i.width,
      height: i.height,
    })),
    breadcrumb: [
      { name: locale === "fr" ? "Accueil" : "Home", url: `${siteUrl}/${locale}` },
      {
        name: locale === "fr" ? "Banque d'images" : "Image bank",
        url: `${siteUrl}/${locale}/galerie`,
      },
    ],
  });

  return (
    <main className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />

      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          {locale === "fr" ? "Banque d'images Axion-IA" : "Axion-IA Image Bank"}
        </h1>
        <p className="text-sm text-gray-500">
          {locale === "fr"
            ? `${total} image${total > 1 ? "s" : ""} libres de droits · CC BY 4.0`
            : `${total} royalty-free image${total > 1 ? "s" : ""} · CC BY 4.0`}
        </p>
      </header>

      {/* Filtres par catégorie */}
      <GalleryFilters locale={locale} currentModule={filters.module ?? ""} />

      <GalleryGrid images={images} locale={locale} />

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <nav aria-label="Pagination" className="mt-12 flex justify-center gap-2">
          {Array.from({ length: Math.ceil(total / PAGE_SIZE) }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/${locale}/galerie?${new URLSearchParams({ ...(filters.module ? { module: filters.module } : {}), page: String(p) })}`}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${pageNum === p ? "border-terracotta bg-terracotta text-white" : "hover:border-terracotta hover:text-terracotta border-gray-200 bg-white text-gray-700"}`}
              aria-current={pageNum === p ? "page" : undefined}
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}

export const revalidate = 0; // dynamique — pas de cache ISR

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function buildQueryString(filters: Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && key !== "page") params.set(key, value);
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

function capitalizeCity(slug: string): string {
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

// Filtres visuels par catégorie — liens URL (SSR, SEO-friendly, 0 JS)
const FILTER_MODULES = [
  "audits",
  "implementations",
  "interventions",
  "un-a-un",
  "graphique",
  "logo",
  "proposition",
] as const;

function GalleryFilters({ locale, currentModule }: { locale: "fr" | "en"; currentModule: string }) {
  const labels = locale === "fr" ? MODULE_LABELS_FR : MODULE_LABELS_EN;
  const base = `/${locale}/galerie`;

  const pillCn = (active: boolean) =>
    `inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
      active
        ? "border-terracotta bg-terracotta text-white"
        : "border-gray-200 bg-white text-gray-600 hover:border-terracotta hover:text-terracotta"
    }`;

  return (
    <nav
      aria-label={locale === "fr" ? "Filtrer par catégorie" : "Filter by category"}
      className="mb-8 flex flex-wrap gap-2"
    >
      <Link href={base} className={pillCn(!currentModule)}>
        {locale === "fr" ? "Toutes" : "All"}
      </Link>
      {FILTER_MODULES.map((mod) => {
        const label = isValidModule(mod) ? labels[mod as Module] : mod;
        return (
          <Link
            key={mod}
            href={`${base}?module=${mod}`}
            className={pillCn(currentModule === mod)}
            aria-current={currentModule === mod ? "true" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
