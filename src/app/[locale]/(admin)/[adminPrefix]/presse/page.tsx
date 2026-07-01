/**
 * Admin — Salle de presse · vue d'ensemble.
 *
 * Compteurs communiqués / médias (total + brouillons/publiés) + liens vers les
 * deux sous-modules. Server Component force-dynamic — lit directement via prisma
 * pour inclure les brouillons (non visibles côté public).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminStatCard } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salle de presse — Vue d'ensemble | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function PressOverviewPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  const [
    releasesTotal,
    releasesPublished,
    mediaTotal,
    mediaPublished,
    coverageTotal,
    coveragePublished,
  ] = await Promise.all([
    // .catch(() => 0) : une table absente (migration non encore appliquée dans
    // cet environnement) ne doit pas crasher toute la console (cf. error.tsx →
    // « revenir au tableau de bord » perçu comme un bounce). Même garde que le
    // layout admin pour `unreadContactsCount`.
    prisma.pressRelease.count({ where: { deletedAt: null } }).catch(() => 0),
    prisma.pressRelease.count({ where: { deletedAt: null, status: "published" } }).catch(() => 0),
    prisma.pressMediaAsset.count({ where: { deletedAt: null } }).catch(() => 0),
    prisma.pressMediaAsset
      .count({ where: { deletedAt: null, status: "published" } })
      .catch(() => 0),
    prisma.mediaCoverage.count({ where: { deletedAt: null } }).catch(() => 0),
    prisma.mediaCoverage.count({ where: { deletedAt: null, status: "published" } }).catch(() => 0),
  ]);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Salle de presse"
        description="Gérez les communiqués de presse et le kit média de marque (logos, chartes, brand book) servis sur la salle de presse publique."
      />

      <div className="mb-[var(--space-admin-7)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="Communiqués"
          value={releasesTotal}
          meta={`${releasesPublished} publié${releasesPublished > 1 ? "s" : ""}`}
          tone="info"
          href={`${base}/communiques`}
        />
        <AdminStatCard
          label="Brouillons communiqués"
          value={releasesTotal - releasesPublished}
          meta="non publiés"
          tone="warning"
          href={`${base}/communiques`}
        />
        <AdminStatCard
          label="Médias (kit)"
          value={mediaTotal}
          meta={`${mediaPublished} publié${mediaPublished > 1 ? "s" : ""}`}
          tone="info"
          href={`${base}/kit-media`}
        />
        <AdminStatCard
          label="Brouillons médias"
          value={mediaTotal - mediaPublished}
          meta="non publiés"
          tone="warning"
          href={`${base}/kit-media`}
        />
        <AdminStatCard
          label="Couverture médias"
          value={coverageTotal}
          meta={`${coveragePublished} publié${coveragePublished > 1 ? "s" : ""}`}
          tone="info"
          href={`${base}/couverture`}
        />
      </div>

      <div className="grid grid-cols-1 gap-[var(--space-admin-5)] md:grid-cols-2">
        <AdminCard variant="interactive">
          <h2 className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
            Communiqués de presse
          </h2>
          <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
            Rédiger, publier et dépublier les communiqués (lancement, partenariat, étude, produit,
            jalon).
          </p>
          <div className="mt-[var(--space-admin-5)] flex gap-[var(--space-admin-3)]">
            <Link href={`${base}/communiques`} className="admin-button">
              Voir les communiqués
            </Link>
            <Link href={`${base}/communiques/nouveau`} className="admin-button-secondary">
              + Nouveau
            </Link>
          </div>
        </AdminCard>

        <AdminCard variant="interactive">
          <h2 className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
            Kit média
          </h2>
          <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
            Logos, logotypes texte, photos, chartes couleur/graphique, livret de marque et texte de
            présentation téléchargeables par la presse.
          </p>
          <div className="mt-[var(--space-admin-5)] flex gap-[var(--space-admin-3)]">
            <Link href={`${base}/kit-media`} className="admin-button">
              Voir le kit média
            </Link>
            <Link href={`${base}/kit-media/upload`} className="admin-button-secondary">
              + Uploader
            </Link>
          </div>
        </AdminCard>

        <AdminCard variant="interactive">
          <h2 className="text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
            Couverture médias
          </h2>
          <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
            Référencez les articles et interviews publiés par des médias externes (retombées presse)
            avec leur lien d&apos;origine.
          </p>
          <div className="mt-[var(--space-admin-5)] flex gap-[var(--space-admin-3)]">
            <Link href={`${base}/couverture`} className="admin-button">
              Voir la couverture
            </Link>
            <Link href={`${base}/couverture/nouveau`} className="admin-button-secondary">
              + Nouvelle
            </Link>
          </div>
        </AdminCard>
      </div>
    </AdminPageShell>
  );
}
