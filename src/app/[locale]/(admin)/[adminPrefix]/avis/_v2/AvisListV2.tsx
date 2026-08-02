// Avis clients V2 — liste + modération (AdminPageShell + AdminTable + actions inline).

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
  AdminButton,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import type { AdminReview } from "@/features/admin-reviews/actions";
import { clientSectorLabel } from "@/content/sectors";
import { serviceLineLabel } from "@/lib/reviews/service-lines";
import { publishForm, hideForm } from "../actions-form";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  published: "Publié",
  hidden: "Masqué",
  rejected: "Rejeté",
  archived: "Archivé",
};
const STATUS_TONE: Record<string, "success" | "warning" | "destructive" | "neutral"> = {
  published: "success",
  pending: "warning",
  hidden: "neutral",
  rejected: "destructive",
  archived: "neutral",
};
const STATUS_TABS = ["pending", "published", "hidden", "rejected", "archived", "all"] as const;

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<AdminReview>;
  total: number;
  page: number;
  totalPages: number;
  counts: Record<string, number>;
}

export function AvisListV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
  counts,
}: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}/avis`;
  const activeStatus = sp["status"] ?? "pending";

  const columns: ReadonlyArray<AdminTableColumn<AdminReview>> = [
    {
      key: "author",
      header: "Auteur",
      cell: (r) => (
        <>
          <div className="flex items-center gap-2">
            <span>
              {r.authorFirstName} {r.authorLastInitial}
            </span>
            {r.isVerified ? <AdminBadge tone="success">Vérifié</AdminBadge> : null}
            {r.featured ? <AdminBadge tone="neutral">★ Mis en avant</AdminBadge> : null}
          </div>
          <div className="admin-meta-small">
            {r.companyName ?? "—"}
            {r.clientSector ? ` · ${clientSectorLabel(r.clientSector)}` : ""}
            {r.cityName ? ` · ${r.cityName}` : ""}
          </div>
        </>
      ),
    },
    { key: "rating", header: "Note", cell: (r) => `${r.rating}/5 ★` },
    {
      key: "service",
      header: "Service",
      cell: (r) => (r.serviceLine ? serviceLineLabel(r.serviceLine) : "—"),
    },
    {
      key: "excerpt",
      header: "Avis",
      cell: (r) => (
        <span className="admin-meta-small" title={r.comment}>
          {r.comment.slice(0, 90)}
          {r.comment.length > 90 ? "…" : ""}
        </span>
      ),
    },
    {
      key: "status",
      header: "Statut",
      cell: (r) => (
        <AdminBadge tone={STATUS_TONE[r.status] ?? "neutral"}>
          {STATUS_LABELS[r.status] ?? r.status}
        </AdminBadge>
      ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Avis clients"
        description={`${total} avis · page ${page}/${totalPages}`}
      />

      {/* Onglets statut avec compteurs */}
      <div className="mb-[var(--space-admin-4)] flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => {
          const label = s === "all" ? "Tous" : STATUS_LABELS[s];
          const count = s === "all" ? undefined : (counts[s] ?? 0);
          const isActive = activeStatus === s;
          return (
            <Link
              key={s}
              href={`${base}?status=${s}`}
              className={isActive ? "admin-button" : "admin-button-ghost"}
            >
              {label}
              {count !== undefined ? ` (${count})` : ""}
            </Link>
          );
        })}
      </div>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <input type="hidden" name="status" value={activeStatus} />
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="search" className="admin-label">
                Recherche
              </label>
              <input
                id="search"
                name="search"
                type="text"
                defaultValue={sp["search"] ?? ""}
                className="admin-input"
                placeholder="Auteur, société, ville, texte…"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Rechercher
            </button>
            <Link href={base} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucun avis pour ce filtre." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(r) => r.id}
          caption="Liste des avis clients"
          rowAction={(r) => (
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton
                href={`${base}/${r.id}`}
                variant="ghost"
                size="sm"
                iconAfter={ArrowRight}
              >
                Voir
              </AdminButton>
              {r.status !== "published" ? (
                <form action={publishForm}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="admin-button">
                    Publier
                  </button>
                </form>
              ) : (
                <form action={hideForm}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="admin-button-ghost">
                    Masquer
                  </button>
                </form>
              )}
            </div>
          )}
        />
      )}
    </AdminPageShell>
  );
}
