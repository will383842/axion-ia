/**
 * Admin — Image detail (edit metadata, publish, soft-delete).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveAdminThumbSrc } from "@/server/image-bank/utils/paths";
import { ImageDetailV2 } from "./_v2/ImageDetailV2";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Banque d'images — détail d'une image | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function ImageDetailPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const image = await prisma.imageAsset.findUnique({
    where: { id },
    include: {
      translations: true,
      category: { include: { translations: true } },
      tags: { include: { tag: { include: { translations: true } } } },
    },
  });

  if (!image) notFound();

  const base = `/${locale}/${adminPrefix}/image-bank`;
  const tr = image.translations.find((t) => t.languageCode === locale) ?? image.translations[0];

  return (
    <ImageDetailV2
      base={base}
      titleDisplay={tr?.title ?? image.slug}
      image={{
        id: image.id,
        slug: image.slug,
        fileFormat: image.fileFormat,
        width: image.width,
        height: image.height,
        licenseType: image.licenseType,
        copyrightHolder: image.copyrightHolder,
        sourceType: image.sourceType,
        aiModel: image.aiModel,
        module: image.module,
        subModule: image.subModule,
        seoScore: image.seoScore,
        requiresHumanReview: image.requiresHumanReview,
        requiresHumanTaxonomy: image.requiresHumanTaxonomy,
        publishedAt: image.publishedAt,
        thumbSrc: resolveAdminThumbSrc(image),
        lqipDataUri: image.lqipDataUri,
        translations: image.translations.map((t) => ({
          id: t.id,
          languageCode: t.languageCode,
          title: t.title,
          alt: t.alt,
          isPublished: t.isPublished,
        })),
        tags: image.tags.map(({ tag }) => ({
          id: tag.id,
          slug: tag.slug,
          name: tag.translations.find((tt) => tt.languageCode === locale)?.name ?? tag.slug,
        })),
      }}
    />
  );
}
