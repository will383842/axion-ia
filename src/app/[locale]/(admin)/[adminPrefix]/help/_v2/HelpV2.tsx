// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Help V2 (liste) — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

interface HelpRow {
  id: string;
  status: string;
  publishedAt: Date | null;
  isTutorial: boolean;
  translations: ReadonlyArray<{ title: string; slug: string }>;
  category: { nameFr: string } | null;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<HelpRow>;
  total: number;
  page: number;
  totalPages: number;
}

export function HelpV2({
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
        title="Centre d'aide"
        description={`${total} article${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <Link href={`/fr/${adminPrefix}/help/new`} className="admin-button">
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
              <label htmlFor="isTutorial" className="admin-label">
                Type
              </label>
              <select
                id="isTutorial"
                name="isTutorial"
                defaultValue={sp["isTutorial"] ?? "all"}
                className="admin-input"
              >
                <option value="all">Tous</option>
                <option value="yes">Tutoriel (HowTo)</option>
                <option value="no">Article standard</option>
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
            <button type="submit" className="admin-button">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/help`} className="admin-button-ghost">
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
                <th>Date publi</th>
                <th>Titre (FR)</th>
                <th>Slug</th>
                <th>Catégorie</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Aucun article trouvé.
                  </td>
                </tr>
              ) : (
                items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : "—"}</td>
                    <td>{a.translations[0]?.title ?? "(sans titre)"}</td>
                    <td>
                      <code className="admin-meta-small">{a.translations[0]?.slug ?? "—"}</code>
                    </td>
                    <td>{a.category?.nameFr ?? "—"}</td>
                    <td>{a.isTutorial ? "📘 Tutoriel" : "Article"}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${a.status}`}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/fr/${adminPrefix}/help/${a.id}`} className="admin-link">
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
