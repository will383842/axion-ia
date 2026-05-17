// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Categories V2 (liste) — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};
const MODULE_LABELS: Record<string, string> = {
  intervention: "Intervention",
  implementation: "Implémentation",
  audit: "Audit",
};

interface CategoryRow {
  id: string;
  slug: string;
  nameFr: string;
  module: string | null;
  parentId: string | null;
  status: string;
  displayOrder: number;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<CategoryRow>;
  total: number;
  page: number;
  totalPages: number;
}

export function CategoriesV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Catégories"
        description={`${total} catégorie${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <Link href={`/fr/${adminPrefix}/categories/new`} className="admin-button">
            + Nouvelle catégorie
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="module" className="admin-label">
                Module
              </label>
              <select
                id="module"
                name="module"
                defaultValue={sp["module"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Tous</option>
                <option value="blog">Blog (sans module)</option>
                {Object.entries(MODULE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
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
                Recherche
              </label>
              <input
                id="search"
                name="search"
                type="text"
                defaultValue={sp["search"] ?? ""}
                className="admin-input"
                placeholder="Nom, slug…"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/categories`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ordre</th>
                <th>Nom (FR)</th>
                <th>Slug</th>
                <th>Module</th>
                <th>Parent</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Aucune catégorie trouvée.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.displayOrder}</td>
                    <td>{c.nameFr}</td>
                    <td>
                      <code className="admin-meta-small">{c.slug}</code>
                    </td>
                    <td>{c.module ? MODULE_LABELS[c.module] : "Blog"}</td>
                    <td>
                      {c.parentId ? (
                        <code className="admin-meta-small">{c.parentId.slice(0, 8)}…</code>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge-${c.status}`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/fr/${adminPrefix}/categories/${c.id}`} className="admin-link">
                        Éditer →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
