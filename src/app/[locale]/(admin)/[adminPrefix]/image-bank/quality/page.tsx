/**
 * Admin — Quality review queue (requiresHumanReview = true).
 */

import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { QualityV2 } from "./_v2/QualityV2";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Banque d'images — qualité | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualityPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
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
