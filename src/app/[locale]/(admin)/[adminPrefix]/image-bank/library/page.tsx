/**
 * Admin — Image bank library (list + filter).
 */

import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { resolveAdminThumbSrc } from "@/server/image-bank/utils/paths";
import { LibraryV2 } from "./_v2/LibraryV2";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Banque d'images — bibliothèque | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams?: Promise<{ status?: string; module?: string }>;
}

export default async function LibraryPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = (await searchParams) ?? {};
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const base = `/${locale}/${adminPrefix}/image-bank`;

  const where = {
    deletedAt: null,
    ...(sp.status === "published" ? { publishedAt: { not: null } } : {}),
    ...(sp.status === "draft" ? { publishedAt: null } : {}),
    ...(sp.module ? { module: sp.module } : {}),
  };

  const images = await prisma.imageAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { translations: { where: { languageCode: locale } } },
  });

  return (
    <LibraryV2
      base={base}
      status={sp.status}
      module={sp.module}
      images={images.map((img) => ({
        id: img.id,
        slug: img.slug,
        module: img.module,
        seoScore: img.seoScore,
        publishedAt: img.publishedAt,
        thumbSrc: resolveAdminThumbSrc(img),
        lqipDataUri: img.lqipDataUri,
        translations: img.translations.map((t) => ({ title: t.title })),
      }))}
    />
  );
}
