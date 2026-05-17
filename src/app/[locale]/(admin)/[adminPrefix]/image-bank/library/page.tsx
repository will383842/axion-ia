/**
 * Admin — Image bank library (list + filter).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { LibraryV2 } from "./_v2/LibraryV2";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Image bank — Library | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams?: Promise<{ status?: string; module?: string }>;
}

export default async function LibraryPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = (await searchParams) ?? {};
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
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

  if (await isAdminV2Enabled()) {
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
          translations: img.translations.map((t) => ({ title: t.title })),
        }))}
      />
    );
  }

  return (
    <main className="space-y-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Library</h1>
        <Link
          href={`${base}/upload`}
          className="bg-terracotta rounded px-4 py-2 text-white hover:opacity-90"
        >
          + Upload
        </Link>
      </header>

      <nav className="flex gap-2 text-sm">
        <FilterLink href={`${base}/library`} label="Tous" active={!sp.status && !sp.module} />
        <FilterLink
          href={`${base}/library?status=published`}
          label="Publiés"
          active={sp.status === "published"}
        />
        <FilterLink
          href={`${base}/library?status=draft`}
          label="Brouillons"
          active={sp.status === "draft"}
        />
      </nav>

      {images.length === 0 ? (
        <p className="text-fg-muted rounded border border-dashed border-gray-300 p-12 text-center">
          Aucune image dans la bibliothèque pour ces critères.
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-4">
          {images.map((img) => {
            const tr = img.translations[0];
            return (
              <li key={img.id}>
                <Link
                  href={`${base}/library/${img.id}`}
                  className="block rounded border p-3 hover:shadow"
                >
                  <div className="mb-2 aspect-video bg-gray-100" />
                  <p className="truncate text-sm font-medium">{tr?.title ?? img.slug}</p>
                  <p className="text-fg-muted text-xs">
                    {img.module ?? "—"} · score {img.seoScore ?? 0} ·{" "}
                    {img.publishedAt ? "publié" : "brouillon"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded px-3 py-1.5 ${active ? "bg-fg text-white" : "border border-gray-300 hover:bg-gray-50"}`}
    >
      {label}
    </Link>
  );
}
