// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Testimonials V2 (liste) — AdminPageShell + AdminPageHeader + AdminCard (filtres).
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badges → <AdminBadge>. Le formulaire de filtres garde les classes
// utilitaires admin.css (legit — pas de composant filtre dédié).

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  published: "Publié",
  refused: "Refusé",
  archived: "Archivé",
};
// Track 2 : tonalité du badge dérivée du statut (avant : `.admin-badge-${status}`).
const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  published: "success",
  pending: "warning",
  refused: "neutral",
  archived: "neutral",
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
  /**
   * Sprint v7 Phase 15 (F5) : true si le testimonial a été marqué "réel"
   * (source vérifiable + consentement RGPD) via `markAsRealTestimonial`.
   * Lu depuis `displayPages.realMeta.isReal` côté list page.
   */
  isReal?: boolean;
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
  const columns: ReadonlyArray<AdminTableColumn<TestimonialRow>> = [
    { key: "order", header: "Ordre", cell: (t) => t.displayOrder },
    {
      key: "person",
      header: "Personne",
      cell: (t) => (
        <>
          <div className="flex items-center gap-2">
            <span>
              {t.firstName} {t.lastName}
            </span>
            {t.isReal ? (
              <span title="Témoignage vérifié : source identifiable + consentement RGPD">
                <AdminBadge tone="success">✓ Authentifié</AdminBadge>
              </span>
            ) : null}
          </div>
          <code className="admin-meta-small">{t.slug}</code>
        </>
      ),
    },
    {
      key: "company",
      header: "Société",
      cell: (t) => (
        <>
          <div>{t.company ?? "—"}</div>
          <div className="admin-meta-small">{t.sector ?? ""}</div>
        </>
      ),
    },
    { key: "module", header: "Module", cell: (t) => (t.module ? MODULE_LABELS[t.module] : "—") },
    { key: "rating", header: "Note", cell: (t) => (t.rating ? `${t.rating}/5` : "—") },
    {
      key: "status",
      header: "Statut",
      cell: (t) => (
        <AdminBadge tone={STATUS_TONE[t.status] ?? "neutral"}>
          {STATUS_LABELS[t.status] ?? t.status}
        </AdminBadge>
      ),
    },
  ];

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

      {items.length === 0 ? (
        <AdminEmptyState title="Aucun témoignage trouvé." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(t) => t.id}
          caption="Liste des témoignages"
          rowAction={(t) => (
            <Link href={`/fr/${adminPrefix}/testimonials/${t.id}`} className="admin-link">
              Éditer →
            </Link>
          )}
        />
      )}
    </AdminPageShell>
  );
}
