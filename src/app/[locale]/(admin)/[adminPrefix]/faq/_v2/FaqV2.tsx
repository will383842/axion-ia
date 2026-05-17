// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// FAQ V2 (liste) — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

const CATEGORY_LABELS: Record<string, string> = {
  general: "Général",
  interventions: "Interventions",
  implementation: "Implémentation",
  audit: "Audit",
  pricing: "Tarifs",
  process: "Processus",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

interface FAQRow {
  id: string;
  slug: string;
  category: string;
  status: string;
  questionFr: string;
  viewCount: number;
  displayOrder: number;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<FAQRow>;
  total: number;
  page: number;
  totalPages: number;
}

export function FaqV2({
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
        title="FAQ"
        description={`${total} question${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <Link href={`/fr/${adminPrefix}/faq/new`} className="admin-button">
            + Nouvelle question
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form className="admin-filters">
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="category" className="admin-label">
                Catégorie
              </label>
              <select
                id="category"
                name="category"
                defaultValue={sp["category"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Toutes</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
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
                placeholder="Question, slug…"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/faq`} className="admin-button-ghost">
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
                <th>Catégorie</th>
                <th>Question (FR)</th>
                <th>Slug</th>
                <th>Statut</th>
                <th>Vues</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Aucune question trouvée.
                  </td>
                </tr>
              ) : (
                items.map((f) => (
                  <tr key={f.id}>
                    <td>{f.displayOrder}</td>
                    <td>{CATEGORY_LABELS[f.category] ?? f.category}</td>
                    <td>{f.questionFr}</td>
                    <td>
                      <code className="admin-meta-small">{f.slug}</code>
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge-${f.status}`}>
                        {STATUS_LABELS[f.status] ?? f.status}
                      </span>
                    </td>
                    <td>{f.viewCount}</td>
                    <td>
                      <Link href={`/fr/${adminPrefix}/faq/${f.id}`} className="admin-link">
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
