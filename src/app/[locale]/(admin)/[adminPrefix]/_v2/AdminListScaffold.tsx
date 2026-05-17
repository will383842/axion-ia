// Refonte admin mai 2026 — PR 6 helper interne (non exporté admin/ui/).
//
// Scaffold partagé pour les pages liste admin (reservations, devis,
// factures, paiements, echeanciers, options, submissions). Factorise
// AdminPageShell + AdminPageHeader + AdminFilterTabs + AdminTable +
// AdminPagination + AdminEmptyState pour un même squelette UX.
//
// Server Component pur. Les cellules de tableau sont des React.ReactNode
// pré-rendus par le consumer (pas de generics complexes).

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminTable,
  AdminPagination,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";

export interface AdminListScaffoldRow {
  id: string;
  cells: ReadonlyArray<React.ReactNode>;
  detailHref?: string;
}

interface AdminListScaffoldProps {
  title: string;
  /** "facture(s)" / "devis" / "réservation(s)" pour la description count. */
  itemLabel: string;
  total: number;
  page: number;
  totalPages: number;
  /** Slot zone filtres (généralement 1 ou plusieurs `<AdminFilterTabs>`). */
  filters?: React.ReactNode;
  columnHeaders: ReadonlyArray<string>;
  rows: ReadonlyArray<AdminListScaffoldRow>;
  emptyTitle?: string;
  emptyDescription?: string;
  paginationBaseHref: string;
  paginationPreservedParams?: Record<string, string | undefined>;
}

export function AdminListScaffold({
  title,
  itemLabel,
  total,
  page,
  totalPages,
  filters,
  columnHeaders,
  rows,
  emptyTitle,
  emptyDescription,
  paginationBaseHref,
  paginationPreservedParams,
}: AdminListScaffoldProps): React.ReactElement {
  const columns: ReadonlyArray<AdminTableColumn<AdminListScaffoldRow>> = columnHeaders.map(
    (header, i) => ({
      key: `col-${i}`,
      header,
      cell: (row) => row.cells[i] ?? "—",
    }),
  );

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={title}
        description={`${total} ${itemLabel} · page ${page} / ${totalPages}`}
      />
      {filters ? <div className="mb-[var(--space-admin-6)]">{filters}</div> : null}
      {rows.length === 0 ? (
        <AdminEmptyState
          title={emptyTitle ?? `Aucun ${itemLabel.replace(/\(.*\)/, "").trim()} pour ce filtre`}
          {...(emptyDescription ? { description: emptyDescription } : {})}
        />
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          rowAction={(r) =>
            r.detailHref ? (
              <Link
                href={r.detailHref}
                className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-info)] hover:underline"
              >
                Détail →
              </Link>
            ) : null
          }
        />
      )}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={paginationBaseHref}
        {...(paginationPreservedParams ? { preservedParams: paginationPreservedParams } : {})}
      />
    </AdminPageShell>
  );
}
