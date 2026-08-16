// Vue partagée par la liste générale des QR et par les trois sous-onglets
// « Catalogue » de la barre latérale.
//
// Pourquoi une vue extraite plutôt qu'un simple `?category=` : le surlignage de
// la barre latérale compare `usePathname()` à `item.href`, et `usePathname()` ne
// contient jamais la query string. Trois entrées en `?category=…` n'auraient
// donc jamais été surlignées. Chaque sous-onglet a donc sa propre route, et
// cette vue porte tout le rendu commun.
import { QrCode } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui/AdminTable";
import { qrCategoryLabel, type QrCategory } from "@/features/admin-qr-codes/categories";

interface Props {
  locale: string;
  adminPrefix: string;
  /** absent = toutes catégories confondues */
  category?: QrCategory;
  title: string;
  description: string;
}

export async function QrCodesView({ locale, adminPrefix, category, title, description }: Props) {
  const rows = await prisma.qrLink.findMany({
    ...(category ? { where: { category } } : {}),
    orderBy: { createdAt: "desc" },
  });
  type Row = (typeof rows)[number];
  const base = `/${locale}/${adminPrefix}/qr-codes`;

  const fmtDate = (d: Date | null) =>
    d ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(d) : "—";

  const columns: ReadonlyArray<AdminTableColumn<Row>> = [
    {
      key: "label",
      header: "Libellé",
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium">{r.label}</div>
          <div className="truncate text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            {SITE_URL.replace(/^https?:\/\//, "")}/qr/{r.slug}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Catégorie",
      hiddenBelow: "md",
      cell: (r) => (
        <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {qrCategoryLabel(r.category)}
        </span>
      ),
    },
    {
      key: "destination",
      header: "Destination",
      cell: (r) => (
        <span
          className="block max-w-[360px] truncate text-[length:var(--text-admin-sm)]"
          title={r.destinationUrl}
        >
          {r.destinationUrl}
        </span>
      ),
    },
    {
      key: "scans",
      header: "Scans",
      align: "right",
      hiddenBelow: "sm",
      cell: (r) => (
        <span title={r.lastScanAt ? `Dernier : ${fmtDate(r.lastScanAt)}` : "Jamais scanné"}>
          {r.scanCount}
        </span>
      ),
    },
    {
      key: "status",
      header: "Statut",
      align: "center",
      cell: (r) => (r.active ? "Actif" : "Désactivé"),
    },
  ];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={title}
        description={description}
        actions={
          <a href={`${base}/new`} className="admin-button">
            + Nouveau QR
          </a>
        }
      />

      {rows.length === 0 ? (
        <AdminEmptyState
          icon={<QrCode size={28} aria-hidden="true" />}
          title="Aucun QR dans cette catégorie"
          description="Créez un QR : donnez-lui un slug stable (imprimé) et une destination (modifiable plus tard)."
          primaryAction={
            <a href={`${base}/new`} className="admin-button">
              Créer un QR
            </a>
          }
        />
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          rowAction={(r) => (
            <a href={`${base}/${r.id}`} className="admin-link">
              Éditer
            </a>
          )}
        />
      )}
    </AdminPageShell>
  );
}
