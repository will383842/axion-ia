/**
 * Public page — gallery image detail `/galerie/[slug]`.
 * Server Component, ISR revalidate 3600. JSON-LD @graph chained 6 entités.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { buildImageDetailGraph } from "@/server/image-bank/services/image-jsonld-graph.service";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const tr = await prisma.imageAssetTranslation.findFirst({
    where: { slug, languageCode: locale, isPublished: true },
    include: {
      image: {
        include: {
          translations: {
            where: { isPublished: true },
            select: { languageCode: true, slug: true },
          },
        },
      },
    },
  });
  if (!tr || !tr.image) return { robots: { index: false } };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const cdnUrl = process.env.IMAGE_BANK_CDN_URL ?? siteUrl;
  const segment = locale === "fr" ? "galerie" : "gallery";

  const otherLocale: "fr" | "en" = locale === "fr" ? "en" : "fr";
  const otherTr = tr.image.translations.find((t) => t.languageCode === otherLocale);
  const otherSlug = otherTr?.slug ?? tr.slug;

  // OG image: slug-based → public image, UUID-based → CDN og variant
  const isSlugBased = tr.image.filePath && !tr.image.filePath.startsWith("/image-bank");
  const ogImageUrl = isSlugBased
    ? `${siteUrl}/${tr.image.filePath.replace(/^\//, "")}`
    : `${cdnUrl}/image-bank/${tr.image.id}/og.webp`;

  return {
    title: tr.metaTitle ?? `${tr.title} | Axion-IA`,
    description: tr.metaDescription ?? tr.caption ?? tr.alt,
    alternates: {
      canonical: `${siteUrl}/${locale}/${segment}/${tr.slug}`,
      languages: {
        "fr-FR": `${siteUrl}/fr/galerie/${locale === "fr" ? tr.slug : otherSlug}`,
        "en-US": `${siteUrl}/en/gallery/${locale === "en" ? tr.slug : otherSlug}`,
        "x-default": `${siteUrl}/fr/galerie/${locale === "fr" ? tr.slug : otherSlug}`,
      },
    },
    openGraph: {
      title: tr.ogTitle ?? tr.title,
      description: tr.ogDescription ?? tr.caption ?? tr.alt,
      type: "article",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      url: `${siteUrl}/${locale}/${segment}/${tr.slug}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: tr.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: tr.ogTitle ?? tr.title,
      description: tr.ogDescription ?? tr.caption ?? tr.alt,
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  };
}

export default async function ImageDetailPublicPage({ params }: PageProps) {
  const { locale, slug } = await params;

  const tr = await prisma.imageAssetTranslation.findFirst({
    where: { slug, languageCode: locale, isPublished: true },
    include: {
      image: {
        include: {
          category: { include: { translations: true } },
          tags: { include: { tag: { include: { translations: true } } } },
        },
      },
    },
  });

  if (!tr || !tr.image) notFound();
  const image = tr.image;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const cdnUrl = process.env.IMAGE_BANK_CDN_URL ?? siteUrl;
  const segment = locale === "fr" ? "galerie" : "gallery";
  const pageUrl = `${siteUrl}/${locale}/${segment}/${tr.slug}`;
  const downloadSegment = locale === "fr" ? "telecharger" : "download";

  const graph = buildImageDetailGraph({
    image,
    translation: tr,
    locale,
    cdnUrl,
    pageUrl,
    breadcrumb: [
      { name: locale === "fr" ? "Accueil" : "Home", url: `${siteUrl}/${locale}` },
      {
        name: locale === "fr" ? "Banque d'images" : "Image bank",
        url: `${siteUrl}/${locale}/${segment}`,
      },
      { name: tr.title, url: pageUrl },
    ],
  });

  // Resolve image URL (slug-based vs UUID-based)
  const isSlugBased = image.filePath && !image.filePath.startsWith("/image-bank");
  const imgSrc = isSlugBased
    ? image.filePath.startsWith("/")
      ? image.filePath
      : `/${image.filePath}`
    : `${cdnUrl}/image-bank/${image.id}/image-lg.webp`;

  // Download URLs
  const dlBase = `/${locale}/${segment}/${tr.slug}/${downloadSegment}`;
  const dlWebp = `${dlBase}`;
  const dlJpeg = `${dlBase}?format=jpeg`;

  // Sidebar metadata
  const orientation =
    !image.width || !image.height
      ? "—"
      : image.width > image.height
        ? locale === "fr"
          ? "Paysage"
          : "Landscape"
        : image.width < image.height
          ? "Portrait"
          : locale === "fr"
            ? "Carré"
            : "Square";

  const ratioStr = image.width && image.height ? calcRatio(image.width, image.height) : "—";

  const isFr = locale === "fr";

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />

      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-gray-500">
        <Link href={`/${locale}/${segment}`} className="hover:text-terracotta transition-colors">
          ← {isFr ? "Banque d'images" : "Image bank"}
        </Link>
      </nav>

      <article className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr]">
        {/* Image principale */}
        <figure className="relative">
          <div className="bg-bg relative overflow-hidden rounded-xl border border-gray-100">
            <Image
              src={imgSrc}
              alt={tr.alt ?? tr.title ?? ""}
              width={image.width ?? 1280}
              height={image.height ?? 720}
              sizes="(min-width: 1024px) 66vw, 100vw"
              priority
              fetchPriority="high"
              {...(image.lqipDataUri
                ? { placeholder: "blur" as const, blurDataURL: image.lqipDataUri }
                : {})}
              className="h-auto w-full"
            />
            {/* Badge CC BY 4.0 */}
            <span className="absolute right-3 bottom-3 rounded bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
              CC BY 4.0
            </span>
          </div>
          {tr.caption && (
            <figcaption className="mt-3 text-sm text-gray-500 italic">{tr.caption}</figcaption>
          )}
        </figure>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          {/* Titre + description */}
          <header>
            <h1 className="text-2xl leading-snug font-bold text-gray-900">{tr.title}</h1>
            {tr.description && (
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{tr.description}</p>
            )}
          </header>

          {/* Boutons téléchargement */}
          <div className="flex flex-col gap-2.5">
            <a
              href={dlJpeg}
              download
              className="bg-terracotta focus-visible:ring-terracotta flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <DownloadIcon className="h-4 w-4" />
              {isFr ? "Télécharger JPG" : "Download JPG"}
            </a>
            <a
              href={dlWebp}
              download
              className="hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <DownloadIcon className="h-4 w-4" />
              {isFr ? "Télécharger WebP" : "Download WebP"}
            </a>
          </div>

          {/* Séparateur */}
          <hr className="border-gray-100" />

          {/* Détails */}
          <section>
            <h2 className="mb-3 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
              {isFr ? "Détails" : "Details"}
            </h2>
            <dl className="space-y-2">
              {image.width && image.height && (
                <DetailRow
                  label={isFr ? "Dimensions" : "Dimensions"}
                  value={`${image.width} × ${image.height} px`}
                />
              )}
              <DetailRow label={isFr ? "Orientation" : "Orientation"} value={orientation} />
              <DetailRow label="Format" value={image.fileFormat?.toUpperCase() ?? "WebP"} />
              <DetailRow label="Ratio" value={ratioStr} />
              <DetailRow
                label={isFr ? "Licence" : "License"}
                value={
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-terracotta hover:underline"
                  >
                    {image.licenseType ?? "CC BY 4.0"}
                  </a>
                }
              />
              {image.copyrightHolder && (
                <DetailRow label="© Copyright" value={image.copyrightHolder} />
              )}
              {image.photographerName && (
                <DetailRow
                  label={isFr ? "Photographe" : "Photographer"}
                  value={image.photographerName}
                />
              )}
            </dl>
          </section>

          {/* Localisation */}
          {image.geoPlacename && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
                {isFr ? "Lieu" : "Location"}
              </h2>
              <p className="flex items-center gap-1.5 text-sm text-gray-700">
                <PinIcon className="text-terracotta h-4 w-4 flex-shrink-0" />
                {image.geoPlacename}
              </p>
            </section>
          )}

          {/* Module / sous-module */}
          {image.module && (
            <div className="flex flex-wrap gap-2">
              <span className="bg-bg rounded-full border border-gray-200 px-3 py-1 text-[11px] text-gray-600">
                {image.module}
              </span>
              {image.subModule && (
                <span className="bg-bg rounded-full border border-gray-200 px-3 py-1 text-[11px] text-gray-500">
                  {image.subModule}
                </span>
              )}
            </div>
          )}

          {/* Tags */}
          {image.tags.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
                Tags
              </h2>
              <ul className="flex flex-wrap gap-2">
                {image.tags.map(({ tag }) => (
                  <li
                    key={tag.id}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                  >
                    {tag.translations.find((t) => t.languageCode === locale)?.name ?? tag.slug}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* AI Summary */}
          {tr.aiSummary && (
            <section className="bg-bg rounded-lg border border-gray-100 p-4">
              <p className="text-xs leading-relaxed text-gray-500 italic">{tr.aiSummary}</p>
            </section>
          )}
        </aside>
      </article>
    </main>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcRatio(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  const rw = w / d;
  const rh = h / d;
  if (rw > 20 || rh > 20) return `${(w / h).toFixed(2)}:1`;
  return `${rw}:${rh}`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-1.5">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-right text-xs font-medium text-gray-800">{value}</dd>
    </div>
  );
}

function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
