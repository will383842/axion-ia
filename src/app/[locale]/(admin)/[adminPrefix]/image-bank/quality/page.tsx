/**
 * Admin — Quality review queue (requiresHumanReview = true).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
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
  if (!session?.user || session.user.role !== "admin") {
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

  if (await isAdminV2Enabled()) {
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

  return (
    <main className="space-y-6 p-8">
      <header>
        <h1 className="text-3xl font-bold">Quality review queue</h1>
        <p className="text-fg-muted">
          {images.length} image{images.length > 1 ? "s" : ""} en attente de validation humaine
          (validators auto échoués ou taxonomie incertaine).
        </p>
      </header>

      {images.length === 0 ? (
        <p className="text-fg-muted rounded border border-dashed p-12 text-center">
          ✓ File vide — toutes les images publiées passent les validators automatiques.
        </p>
      ) : (
        <ul className="space-y-3">
          {images.map((img) => {
            const tr = img.translations[0];
            return (
              <li key={img.id} className="rounded border p-4">
                <Link href={`${base}/library/${img.id}`} className="font-medium hover:underline">
                  {tr?.title ?? img.slug}
                </Link>
                <p className="text-fg-muted text-sm">
                  Score {img.seoScore ?? 0}/100 ·{" "}
                  {img.requiresHumanReview && <span className="mr-2">⚠ Validators</span>}
                  {img.requiresHumanTaxonomy && <span>⚠ Taxonomie</span>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
