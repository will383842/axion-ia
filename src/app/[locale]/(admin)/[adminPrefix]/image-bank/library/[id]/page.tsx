/**
 * Admin — Image detail (edit metadata, publish, soft-delete).
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveAdminThumbSrc } from "@/server/image-bank/utils/paths";
import { ImageDetailV2 } from "./_v2/ImageDetailV2";

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
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
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
