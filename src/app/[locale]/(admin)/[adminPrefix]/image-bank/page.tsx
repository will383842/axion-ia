/**
 * Admin — Image bank overview dashboard.
 * Counters + recent uploads + top embedded. Server Component force-dynamic.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OverviewV2 } from "./_v2/OverviewV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Image bank — Overview | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function ImageBankOverviewPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/image-bank`;

  const [totalCount, publishedCount, pendingReviewCount, avgSeoScore, recentImages, topEmbedded] =
    await Promise.all([
      prisma.imageAsset.count({ where: { deletedAt: null } }),
      prisma.imageAsset.count({ where: { deletedAt: null, publishedAt: { not: null } } }),
      prisma.imageAsset.count({ where: { deletedAt: null, requiresHumanReview: true } }),
      prisma.imageAsset.aggregate({
        _avg: { seoScore: true },
        where: { deletedAt: null, publishedAt: { not: null } },
      }),
      prisma.imageAsset.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { translations: { where: { languageCode: locale } } },
      }),
      prisma.imageAsset.findMany({
        where: { deletedAt: null, publishedAt: { not: null } },
        orderBy: { embedCount: "desc" },
        take: 8,
        include: { translations: { where: { languageCode: locale } } },
      }),
    ]);

  return (
    <OverviewV2
      locale={locale}
      adminPrefix={adminPrefix}
      base={base}
      totalCount={totalCount}
      publishedCount={publishedCount}
      pendingReviewCount={pendingReviewCount}
      avgSeoScore={Math.round(avgSeoScore._avg.seoScore ?? 0)}
      recentImages={recentImages.map((img) => ({
        id: img.id,
        slug: img.slug,
        module: img.module,
        seoScore: img.seoScore,
        embedCount: img.embedCount,
        downloadCount: img.downloadCount,
        translations: img.translations.map((t) => ({ title: t.title })),
      }))}
      topEmbedded={topEmbedded.map((img) => ({
        id: img.id,
        slug: img.slug,
        module: img.module,
        seoScore: img.seoScore,
        embedCount: img.embedCount,
        downloadCount: img.downloadCount,
        translations: img.translations.map((t) => ({ title: t.title })),
      }))}
    />
  );
}
