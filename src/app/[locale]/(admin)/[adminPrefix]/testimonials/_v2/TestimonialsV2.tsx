// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Testimonials V2 (liste) — AdminPageShell + AdminPageHeader + AdminCard.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  published: "Publié",
  refused: "Refusé",
  archived: "Archivé",
};
const MODULE_LABELS: Record<string, string> = {
  intervention: "Intervention",
  implementation: "Implémentation",
  audit: "Audit",
};

interface TestimonialRow {
  id: string;
  slug: string;
  status: string;
  firstName: string;
  lastName: string;
  company: string | null;
  sector: string | null;
  module: string | null;
  rating: number | null;
  displayOrder: number;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<TestimonialRow>;
  total: number;
  page: number;
  totalPages: number;
}

export function TestimonialsV2({
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
        title="Témoignages"
        description={`${total} témoignage${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <Link href={`/fr/${adminPrefix}/testimonials/new`} className="admin-button">
            + Nouveau témoignage
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
                {Object.entries(MODULE_LABELS).map(([k, v]) => (
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
                placeholder="Nom, société, slug…"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/testimonials`} className="admin-button-ghost">
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
                <th>Personne</th>
                <th>Société</th>
                <th>Module</th>
                <th>Note</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Aucun témoignage trouvé.
                  </td>
                </tr>
              ) : (
                items.map((t) => (
                  <tr key={t.id}>
                    <td>{t.displayOrder}</td>
                    <td>
                      <div>
                        {t.firstName} {t.lastName}
                      </div>
                      <code className="admin-meta-small">{t.slug}</code>
                    </td>
                    <td>
                      <div>{t.company ?? "—"}</div>
                      <div className="admin-meta-small">{t.sector ?? ""}</div>
                    </td>
                    <td>{t.module ? MODULE_LABELS[t.module] : "—"}</td>
                    <td>{t.rating ? `${t.rating}/5` : "—"}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${t.status}`}>
                        {STATUS_LABELS[t.status] ?? t.status}
                      </span>
                    </td>
                    <td>
                      <Link href={`/fr/${adminPrefix}/testimonials/${t.id}`} className="admin-link">
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
