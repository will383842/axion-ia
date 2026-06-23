/**
 * Admin — Quality review queue (requiresHumanReview = true).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QualityV2 } from "./_v2/QualityV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Image bank — Quality | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualityPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/image-bank`;

  const images = await prisma.imageAsset.findMany({
    where: {
      deletedAt: null,
      OR: [{ requiresHumanReview: true }, { requiresHumanTaxonomy: true }],
    },
    orderBy: { createdAt: "desc" },
    include: { translations: { where: { languageCode: locale } } },
  });

  return (
    <QualityV2
      base={base}
      images={images.map((img) => ({
        id: img.id,
        slug: img.slug,
        seoScore: img.seoScore,
        requiresHumanReview: img.requiresHumanReview,
        requiresHumanTaxonomy: img.requiresHumanTaxonomy,
        translations: img.translations.map((t) => ({ title: t.title })),
      }))}
    />
  );
}
