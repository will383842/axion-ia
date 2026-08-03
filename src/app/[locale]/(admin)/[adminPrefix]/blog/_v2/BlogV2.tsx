// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Blog V2 (liste) — AdminPageShell + AdminPageHeader + AdminCard.

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
// Date affichée en FR (audit UX : ISO brut "2026-07-31" illisible pour Will).
import { formatDateFrShort } from "@/lib/format-date-fr";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};
// Track 2 : tonalité du badge dérivée du statut (avant : `.admin-badge-${status}`
// non défini pour draft/published/archived → badge neutre non coloré).
const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  published: "success",
  draft: "warning",
  archived: "neutral",
};

interface ArticleRow {
  id: string;
  status: string;
  publishedAt: Date | null;
  viewsCount: number;
  translations: ReadonlyArray<{ title: string; slug: string }>;
  category: { nameFr: string } | null;
  author: { name: string | null } | null;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<ArticleRow>;
  total: number;
  page: number;
  totalPages: number;
}

export function BlogV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
}: Props): React.ReactElement {
  const columns: ReadonlyArray<AdminTableColumn<ArticleRow>> = [
    {
      key: "publishedAt",
      header: "Date publi",
      cell: (a) => formatDateFrShort(a.publishedAt),
    },
    { key: "title", header: "Titre (FR)", cell: (a) => a.translations[0]?.title ?? "(sans titre)" },
    {
      key: "slug",
      header: "Slug",
      cell: (a) => <code className="admin-meta-small">{a.translations[0]?.slug ?? "—"}</code>,
    },
    { key: "category", header: "Catégorie", cell: (a) => a.category?.nameFr ?? "—" },
    { key: "author", header: "Auteur", cell: (a) => a.author?.name ?? "—" },
    {
      key: "status",
      header: "Statut",
      cell: (a) => (
        <AdminBadge tone={STATUS_TONE[a.status] ?? "neutral"}>
          {STATUS_LABELS[a.status] ?? a.status}
        </AdminBadge>
      ),
    },
    { key: "views", header: "Vues", cell: (a) => a.viewsCount },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Blog"
        description={`${total} article${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <Link href={`/fr/${adminPrefix}/blog/new`} className="admin-button">
            + Nouvel article
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="status" className="admin-label">
                Statut
              </label>
              <select
                id="status"
                name="status"
                defaultValue={sp["status"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Tous</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="search" className="admin-label">
                Recherche (titre)
              </label>
              <input
                id="search"
                name="search"
                type="text"
                defaultValue={sp["search"] ?? ""}
                className="admin-input"
                placeholder="Min 2 caractères"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button-secondary">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/blog`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucun article trouvé." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(a) => a.id}
          caption="Liste des articles de blog"
          rowAction={(a) => (
            <AdminButton
              href={`/fr/${adminPrefix}/blog/${a.id}`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Éditer
            </AdminButton>
          )}
        />
      )}
    </AdminPageShell>
  );
}
