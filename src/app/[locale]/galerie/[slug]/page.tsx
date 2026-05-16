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
    include: { image: true },
  });
  if (!tr) return { robots: { index: false } };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const segment = locale === "fr" ? "galerie" : "gallery";
  return {
    title: tr.metaTitle ?? `${tr.title} | Axion-IA`,
    description: tr.metaDescription ?? tr.caption ?? tr.alt,
    alternates: {
      canonical: `${siteUrl}/${locale}/${segment}/${tr.slug}`,
    },
    openGraph: {
      title: tr.ogTitle ?? tr.title,
      description: tr.ogDescription ?? tr.caption ?? tr.alt,
      type: "article",
    },
    robots: { index: true, follow: true },
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

  const imgSrc = `${cdnUrl}/image-bank/${image.id}/image-lg.webp`;

  return (
    <main className="container mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />

      <nav className="text-fg-muted mb-6 text-sm">
        <Link href={`/${locale}/${segment}`} className="hover:underline">
          ← {locale === "fr" ? "Retour banque d'images" : "Back to image bank"}
        </Link>
      </nav>

      <article className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <figure>
          <div className="relative overflow-hidden rounded-lg bg-gray-100">
            <Image
              src={imgSrc}
              alt={tr.alt}
              width={image.width}
              height={image.height}
              sizes="(min-width: 1024px) 66vw, 100vw"
              priority
              {...(image.lqipDataUri
                ? { placeholder: "blur" as const, blurDataURL: image.lqipDataUri }
                : {})}
              className="h-auto w-full"
            />
          </div>
          {tr.caption && (
            <figcaption className="text-fg-muted mt-3 text-sm">{tr.caption}</figcaption>
          )}
        </figure>

        <aside className="space-y-6">
          <header>
            <h1 className="text-2xl font-bold">{tr.title}</h1>
            {tr.description && <p className="text-fg-muted mt-2 text-sm">{tr.description}</p>}
          </header>

          <dl className="space-y-1 text-sm">
            <Row label={locale === "fr" ? "License" : "License"} value={image.licenseType} />
            <Row label="Copyright" value={image.copyrightHolder} />
            {image.photographerName && (
              <Row
                label={locale === "fr" ? "Photographe" : "Photographer"}
                value={image.photographerName}
              />
            )}
            <Row
              label={locale === "fr" ? "Dimensions" : "Dimensions"}
              value={`${image.width}×${image.height}`}
            />
            {image.sourceType === "ai_generated" && image.aiModel && (
              <Row label="AI model" value={image.aiModel} />
            )}
          </dl>

          <a
            href={`/${locale}/${segment}/${tr.slug}/${downloadSegment}`}
            className="bg-terracotta block rounded px-4 py-3 text-center text-white hover:opacity-90"
            download
          >
            {locale === "fr" ? "Télécharger" : "Download"}
          </a>

          {image.tags.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Tags</h2>
              <ul className="flex flex-wrap gap-2 text-xs">
                {image.tags.map(({ tag }) => (
                  <li key={tag.id} className="rounded-full bg-gray-100 px-3 py-1">
                    {tag.translations.find((t) => t.languageCode === locale)?.name ?? tag.slug}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </article>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-1">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right font-mono text-xs">{value}</dd>
    </div>
  );
}
