/**
 * Admin — Salle de presse · liste des assets du kit média.
 *
 * Liste tous les assets (brouillons inclus) avec leur type, statut et fichier.
 * Lecture directe via prisma. Suppression par ligne via le server action
 * `deletePressMediaAsset`. Le bouton « Uploader » mène au formulaire d'upload.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deletePressMediaAsset } from "@/server/actions/press/media";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminTable,
  AdminBadge,
  AdminStatusBadge,
  AdminSubmitButton,
  AdminEmptyState,
  type AdminTableColumn,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salle de presse — Kit média | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const KIND_LABELS: Record<string, string> = {
  logo: "Logo",
  wordmark: "Logotype texte",
  photo: "Photo",
  brand_book: "Livret de marque",
  boilerplate: "Texte de présentation",
  color_charter: "Charte couleur",
  graphic_charter: "Charte graphique",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

interface AssetRow {
  id: string;
  kind: string;
  status: string;
  title: string;
  fileName: string | null;
}

export default async function PressMediaListPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  // try/catch : table absente (migration non appliquée) → liste vide, pas de crash.
  let rows: AssetRow[] = [];
  try {
    const assets = await prisma.pressMediaAsset.findMany({
      where: { deletedAt: null },
      include: { translations: { where: { locale: "fr" } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    rows = assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      status: a.status,
      title: a.translations[0]?.title ?? a.fileName ?? "(sans titre)",
      fileName: a.fileName,
    }));
  } catch {
    rows = [];
  }

  async function remove(formData: FormData): Promise<void> {
    "use server";
    const assetId = String(formData.get("id") ?? "");
    if (assetId) {
      await deletePressMediaAsset(assetId);
    }
    redirect(`${base}/kit-media`);
  }

  const columns: ReadonlyArray<AdminTableColumn<AssetRow>> = [
    {
      key: "title",
      header: "Titre",
      cell: (row) => (
        <Link
          href={`${base}/kit-media/${row.id}`}
          className="font-medium text-[color:var(--color-admin-fg)] underline-offset-2 hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: "kind",
      header: "Type",
      cell: (row) => <AdminBadge tone="outline">{KIND_LABELS[row.kind] ?? row.kind}</AdminBadge>,
    },
    {
      key: "fileName",
      header: "Fichier",
      cell: (row) => (
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {row.fileName ?? "—"}
        </span>
      ),
      hiddenBelow: "md",
    },
    {
      key: "status",
      header: "Statut",
      cell: (row) => <AdminStatusBadge type="image-asset" status={row.status} />,
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Kit média"
        description={`${rows.length} asset${rows.length > 1 ? "s" : ""} (logos, chartes, brand book — brouillons inclus)`}
        actions={
          <Link href={`${base}/kit-media/upload`} className="admin-button">
            + Ajouter un fichier
          </Link>
        }
      />

      <AdminTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        caption="Liste des assets du kit média"
        rowAction={(row) => (
          <div className="flex items-center gap-[var(--space-admin-3)]">
            <Link href={`${base}/kit-media/${row.id}`} className="admin-button-secondary">
              Éditer
            </Link>
            <form action={remove}>
              <input type="hidden" name="id" value={row.id} />
              <AdminSubmitButton variant="destructive" pendingLabel="…">
                Supprimer
              </AdminSubmitButton>
            </form>
          </div>
        )}
        emptyState={
          <AdminEmptyState
            title="Aucun fichier"
            description="Uploadez le premier fichier de marque (logo, charte, brand book…)."
            primaryAction={
              <Link href={`${base}/kit-media/upload`} className="admin-button">
                Uploader un fichier
              </Link>
            }
          />
        }
      />
    </AdminPageShell>
  );
}
