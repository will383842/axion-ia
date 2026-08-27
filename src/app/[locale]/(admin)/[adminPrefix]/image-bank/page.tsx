/**
 * Admin — Image bank overview dashboard.
 * Counters + recent uploads + top embedded. Server Component force-dynamic.
 */

import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { resolveAdminThumbSrc } from "@/server/image-bank/utils/paths";
import { OverviewV2 } from "./_v2/OverviewV2";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Banque d'images — vue d'ensemble | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function ImageBankOverviewPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
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
        thumbSrc: resolveAdminThumbSrc(img),
        lqipDataUri: img.lqipDataUri,
        translations: img.translations.map((t) => ({ title: t.title })),
      }))}
      topEmbedded={topEmbedded.map((img) => ({
        id: img.id,
        slug: img.slug,
        module: img.module,
        seoScore: img.seoScore,
        embedCount: img.embedCount,
        downloadCount: img.downloadCount,
        thumbSrc: resolveAdminThumbSrc(img),
        lqipDataUri: img.lqipDataUri,
        translations: img.translations.map((t) => ({ title: t.title })),
      }))}
    />
  );
}
