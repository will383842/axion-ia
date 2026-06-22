/**
 * Admin — Salle de presse · liste des communiqués.
 *
 * Liste tous les communiqués (brouillons inclus). Lecture directe via prisma
 * (Server Component force-dynamic). Le bouton « Nouveau » mène à l'éditeur de
 * création ; chaque ligne ouvre l'éditeur d'édition.
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
  AdminBadge,
  AdminStatusBadge,
  AdminEmptyState,
  type AdminTableColumn,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salle de presse — Communiqués | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const TAG_LABELS: Record<string, string> = {
  launch: "Lancement",
  partnership: "Partenariat",
  study: "Étude",
  product: "Produit",
  milestone: "Jalon",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

interface ReleaseRow {
  id: string;
  tag: string;
  status: string;
  title: string;
  updatedAt: Date;
}

export default async function PressReleasesListPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  const releases = await prisma.pressRelease.findMany({
    where: { deletedAt: null },
    include: { translations: { where: { locale: "fr" } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const rows: ReleaseRow[] = releases.map((r) => ({
    id: r.id,
    tag: r.tag,
    status: r.status,
    title: r.translations[0]?.title ?? "(sans titre)",
    updatedAt: r.updatedAt,
  }));

  const columns: ReadonlyArray<AdminTableColumn<ReleaseRow>> = [
    {
      key: "title",
      header: "Titre",
      cell: (row) => (
        <Link
          href={`${base}/communiques/${row.id}`}
          className="font-medium text-[color:var(--color-admin-fg)] hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: "tag",
      header: "Catégorie",
      cell: (row) => <AdminBadge tone="outline">{TAG_LABELS[row.tag] ?? row.tag}</AdminBadge>,
      hiddenBelow: "sm",
    },
    {
      key: "status",
      header: "Statut",
      cell: (row) => <AdminStatusBadge type="publication" status={row.status} />,
    },
    {
      key: "updatedAt",
      header: "Modifié le",
      cell: (row) => (
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)] tabular-nums">
          {row.updatedAt.toLocaleDateString("fr-FR")}
        </span>
      ),
      hiddenBelow: "md",
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Communiqués de presse"
        description={`${rows.length} communiqué${rows.length > 1 ? "s" : ""} (brouillons inclus)`}
        actions={
          <Link href={`${base}/communiques/nouveau`} className="admin-button">
            + Nouveau
          </Link>
        }
      />

      <AdminTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        caption="Liste des communiqués de presse"
        rowAction={(row) => (
          <Link
            href={`${base}/communiques/${row.id}`}
            className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-info)] hover:underline"
          >
            Éditer
          </Link>
        )}
        emptyState={
          <AdminEmptyState
            title="Aucun communiqué"
            description="Créez votre premier communiqué de presse."
            primaryAction={
              <Link href={`${base}/communiques/nouveau`} className="admin-button">
                Nouveau communiqué
              </Link>
            }
          />
        }
      />
    </AdminPageShell>
  );
}
