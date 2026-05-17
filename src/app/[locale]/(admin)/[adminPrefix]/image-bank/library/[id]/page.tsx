/**
 * Admin — Image detail (edit metadata, publish, soft-delete).
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { ImageDetailV2 } from "./_v2/ImageDetailV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Image detail | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function ImageDetailPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
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

  if (await isAdminV2Enabled()) {
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
          publishedAt: image.publishedAt,
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

  return (
    <main className="space-y-6 p-8">
      <Link href={`${base}/library`} className="text-fg-muted text-sm hover:underline">
        ← Retour bibliothèque
      </Link>

      <header>
        <h1 className="text-2xl font-bold">{tr?.title ?? image.slug}</h1>
        <p className="text-fg-muted text-sm">
          {image.module ?? "—"} / {image.subModule ?? "—"} · score{" "}
          <strong>{image.seoScore ?? 0}/100</strong>
        </p>
      </header>

      <section className="grid grid-cols-2 gap-8">
        <div>
          <div className="aspect-video rounded bg-gray-100" />
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="ID" value={image.id} />
            <Row label="Slug" value={image.slug} />
            <Row label="Format" value={`${image.fileFormat} · ${image.width}×${image.height}`} />
            <Row label="License" value={image.licenseType} />
            <Row label="Copyright" value={image.copyrightHolder} />
            <Row label="Source type" value={image.sourceType} />
            {image.aiModel && <Row label="AI model" value={image.aiModel} />}
            <Row
              label="Published"
              value={image.publishedAt ? image.publishedAt.toISOString() : "Non publié"}
            />
          </dl>
        </div>

        <div className="space-y-4">
          <section>
            <h2 className="font-semibold">Translations ({image.translations.length})</h2>
            <ul className="mt-2 space-y-2">
              {image.translations.map((t) => (
                <li key={t.id} className="rounded border p-3 text-sm">
                  <p className="font-medium">
                    [{t.languageCode}] {t.title}
                  </p>
                  <p className="text-fg-muted">{t.alt}</p>
                  <p className="text-fg-muted text-xs">
                    {t.isPublished ? "✓ Publié" : "Brouillon"}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-semibold">Tags ({image.tags.length})</h2>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {image.tags.map(({ tag }) => (
                <li key={tag.id} className="rounded-full bg-gray-100 px-3 py-1">
                  {tag.translations.find((tt) => tt.languageCode === locale)?.name ?? tag.slug}
                </li>
              ))}
            </ul>
          </section>

          {image.requiresHumanReview && (
            <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              ⚠ Cette image est marquée pour relecture humaine (validators automatiques échoués).
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-mono text-xs">{value}</dd>
    </div>
  );
}
