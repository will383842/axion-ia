/**
 * Admin — Salle de presse · liste des retombées (couverture médias).
 *
 * Liste toutes les retombées presse externes (brouillons inclus). Lecture
 * directe via prisma (Server Component force-dynamic). Le bouton « Nouveau »
 * mène à l'éditeur de création ; chaque ligne ouvre l'éditeur d'édition.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminTable,
  AdminStatusBadge,
  AdminEmptyState,
  type AdminTableColumn,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salle de presse — Couverture médias | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

interface CoverageRow {
  id: string;
  outlet: string;
  status: string;
  title: string;
  publishedAt: Date;
}

export default async function MediaCoverageListPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  // try/catch : table absente (migration non appliquée) → liste vide, pas de crash.
  let rows: CoverageRow[] = [];
  try {
    const coverage = await prisma.mediaCoverage.findMany({
      where: { deletedAt: null },
      include: { translations: { where: { locale: "fr" } } },
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
      take: 200,
    });
    rows = coverage.map((c) => ({
      id: c.id,
      outlet: c.outlet,
      status: c.status,
      title: c.translations[0]?.title ?? "(sans titre)",
      publishedAt: c.publishedAt,
    }));
  } catch {
    rows = [];
  }

  const columns: ReadonlyArray<AdminTableColumn<CoverageRow>> = [
    {
      key: "outlet",
      header: "Média",
      cell: (row) => (
        <Link
          href={`${base}/couverture/${row.id}`}
          className="font-medium text-[color:var(--color-admin-fg)] hover:underline"
        >
          {row.outlet}
        </Link>
      ),
    },
    {
      key: "title",
      header: "Titre (FR)",
      cell: (row) => (
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          {row.title}
        </span>
      ),
      hiddenBelow: "sm",
    },
    {
      key: "status",
      header: "Statut",
      cell: (row) => <AdminStatusBadge type="publication" status={row.status} />,
    },
    {
      key: "publishedAt",
      header: "Publié le",
      cell: (row) => (
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)] tabular-nums">
          {row.publishedAt.toLocaleDateString("fr-FR")}
        </span>
      ),
      hiddenBelow: "md",
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Couverture médias"
        description={`${rows.length} retombée${rows.length > 1 ? "s" : ""} presse (brouillons inclus)`}
        actions={
          <Link href={`${base}/couverture/nouveau`} className="admin-button">
            + Nouvelle
          </Link>
        }
      />

      <AdminTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        caption="Liste des retombées presse"
        rowAction={(row) => (
          <Link
            href={`${base}/couverture/${row.id}`}
            className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-info)] hover:underline"
          >
            Éditer
          </Link>
        )}
        emptyState={
          <AdminEmptyState
            title="Aucune retombée presse"
            description="Ajoutez un article ou une interview publié par un média externe."
            primaryAction={
              <Link href={`${base}/couverture/nouveau`} className="admin-button">
                Nouvelle retombée
              </Link>
            }
          />
        }
      />
    </AdminPageShell>
  );
}
