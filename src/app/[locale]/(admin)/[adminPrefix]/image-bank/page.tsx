/**
 * Admin — Image bank overview dashboard.
 * Counters + recent uploads + top embedded. Server Component force-dynamic.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
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

  if (await isAdminV2Enabled()) {
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

  return (
    <main className="space-y-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Image bank — Overview</h1>
          <p className="text-fg-muted">
            Dashboard production · {new Date().toLocaleDateString(locale)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`${base}/upload`}
            className="bg-terracotta rounded px-4 py-2 text-white hover:opacity-90"
          >
            Upload
          </Link>
          <Link
            href={`${base}/bulk-import`}
            className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-50"
          >
            Bulk import CSV
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-4 gap-4">
        <Counter label="Total images" value={totalCount} href={`${base}/library`} />
        <Counter
          label="Published"
          value={publishedCount}
          accent="green"
          href={`${base}/library?status=published`}
        />
        <Counter
          label="Needs review"
          value={pendingReviewCount}
          accent={pendingReviewCount > 0 ? "amber" : "neutral"}
          href={`${base}/quality`}
        />
        <Counter
          label="Avg SEO score"
          value={Math.round(avgSeoScore._avg.seoScore ?? 0)}
          suffix="/100"
          accent={(avgSeoScore._avg.seoScore ?? 0) >= 80 ? "green" : "amber"}
        />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Recent uploads</h2>
        <div className="grid grid-cols-4 gap-4">
          {recentImages.map((img) => {
            const tr = img.translations[0];
            return (
              <Link
                key={img.id}
                href={`${base}/library/${img.id}`}
                className="block rounded border p-3 hover:shadow"
              >
                <div className="mb-2 aspect-video bg-gray-100" />
                <p className="truncate text-sm font-medium">{tr?.title ?? img.slug}</p>
                <p className="text-fg-muted text-xs">
                  {img.module ?? "—"} · score {img.seoScore ?? "?"}
                </p>
              </Link>
            );
          })}
          {recentImages.length === 0 && (
            <p className="text-fg-muted col-span-4 text-sm">
              Aucune image — uploadez la première via le bouton ci-dessus.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Top embedded</h2>
        <div className="grid grid-cols-4 gap-4">
          {topEmbedded.map((img) => {
            const tr = img.translations[0];
            return (
              <Link
                key={img.id}
                href={`${base}/library/${img.id}`}
                className="block rounded border p-3 hover:shadow"
              >
                <div className="mb-2 aspect-video bg-gray-100" />
                <p className="truncate text-sm font-medium">{tr?.title ?? img.slug}</p>
                <p className="text-fg-muted text-xs">
                  {img.embedCount} embeds · {img.downloadCount} downloads
                </p>
              </Link>
            );
          })}
          {topEmbedded.length === 0 && (
            <p className="text-fg-muted col-span-4 text-sm">Aucune image publiée pour le moment.</p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4 rounded bg-gray-50 p-6">
        <Link href={`${base}/analytics`} className="underline">
          View detailed analytics →
        </Link>
        <Link href={`${base}/sitemap-status`} className="underline">
          Sitemap &amp; IndexNow status →
        </Link>
        <Link href={`${base}/settings`} className="underline">
          Settings →
        </Link>
      </section>
    </main>
  );
}

function Counter({
  label,
  value,
  suffix,
  accent = "neutral",
  href,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: "neutral" | "green" | "amber" | "red";
  href?: string;
}) {
  const accentClasses = {
    neutral: "text-fg border-gray-200",
    green: "text-green-700 border-green-200 bg-green-50",
    amber: "text-amber-700 border-amber-200 bg-amber-50",
    red: "text-red-700 border-red-200 bg-red-50",
  } as const;

  const inner = (
    <div className={`rounded border p-4 ${accentClasses[accent]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="mt-1 text-3xl font-bold">
        {value}
        {suffix ? <span className="ml-1 text-base font-normal opacity-60">{suffix}</span> : null}
      </p>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}
