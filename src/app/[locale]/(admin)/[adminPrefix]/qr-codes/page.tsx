// Admin — liste des QR codes dynamiques.
import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminTable,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui/AdminTable";
import {
  QR_CATEGORIES,
  qrCategoryLabel,
  QR_CATEGORY_VALUES,
} from "@/features/admin-qr-codes/categories";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ category?: string }>;
}

export default async function QrCodesListPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const { category } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const activeCategory = QR_CATEGORY_VALUES.includes(category as never) ? category : undefined;
  const rows = await prisma.qrLink.findMany({
    ...(activeCategory ? { where: { category: activeCategory } } : {}),
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
        title="QR codes & liens"
        description="Chaque QR imprimé encode /qr/<slug> et redirige (302) vers une destination modifiable ici — sans jamais réimprimer. Le compteur de scans mesure l'usage."
        actions={
          <a href={`${base}/new`} className="admin-button">
            + Nouveau QR
          </a>
        }
      />

      <nav
        aria-label="Filtrer par catégorie"
        className="mb-[var(--space-admin-6)] flex flex-wrap gap-2"
      >
        <a
          href={base}
          className={`rounded-full border px-3 py-1 text-[length:var(--text-admin-sm)] font-medium ${
            !activeCategory
              ? "border-transparent bg-[color:var(--color-admin-info)] text-white"
              : "border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg)]"
          }`}
        >
          Tous
        </a>
        {QR_CATEGORIES.map((c) => (
          <a
            key={c.value}
            href={`${base}?category=${c.value}`}
            className={`rounded-full border px-3 py-1 text-[length:var(--text-admin-sm)] font-medium ${
              activeCategory === c.value
                ? "border-transparent bg-[color:var(--color-admin-info)] text-white"
                : "border-[color:var(--color-admin-border)] text-[color:var(--color-admin-fg)]"
            }`}
          >
            {c.label}
          </a>
        ))}
      </nav>

      {rows.length === 0 ? (
        <AdminEmptyState
          icon={<QrCode size={28} aria-hidden="true" />}
          title="Aucun QR pour l'instant"
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
