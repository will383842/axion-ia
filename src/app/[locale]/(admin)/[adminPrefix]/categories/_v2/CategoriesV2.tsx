// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Categories V2 (liste) — AdminPageShell + AdminPageHeader + AdminCard.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badges → <AdminBadge>. Le formulaire de filtres garde les classes
// utilitaires admin.css (legit — pas de composant filtre dédié).

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
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";

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
  /** Nom de la catégorie parente, résolu par jointure — `null` si racine. */
  parent: { nameFr: string } | null;
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
  const columns: ReadonlyArray<AdminTableColumn<CategoryRow>> = [
    { key: "order", header: "Ordre", cell: (c) => c.displayOrder },
    { key: "name", header: "Nom (FR)", cell: (c) => c.nameFr },
    {
      key: "slug",
      header: "Adresse (URL)",
      cell: (c) => <code className="admin-meta-small">{c.slug}</code>,
    },
    { key: "module", header: "Module", cell: (c) => (c.module ? MODULE_LABELS[c.module] : "Blog") },
    {
      key: "parent",
      header: "Parent",
      // Nom de la catégorie parente (audit UX : un UUID tronqué n'était pas
      // exploitable pour Will) — « — » pour une catégorie racine.
      cell: (c) => c.parent?.nameFr ?? "—",
    },
    {
      key: "status",
      header: "Statut",
      cell: (c) => (
        <AdminBadge tone={STATUS_TONE[c.status] ?? "neutral"}>
          {STATUS_LABELS[c.status] ?? c.status}
        </AdminBadge>
      ),
    },
  ];

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
            <button type="submit" className="admin-button-secondary">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/categories`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucune catégorie trouvée." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(c) => c.id}
          caption="Liste des catégories"
          rowAction={(c) => (
            <AdminButton
              href={`/fr/${adminPrefix}/categories/${c.id}`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Éditer
            </AdminButton>
          )}
        />
      )}

      {/* 🔴 Le sous-titre annonçait « page 1/N » et la page N n'existait
          nulle part à l'écran : au-delà de la première, les lignes
          n'étaient atteignables qu'en éditant l'URL. Les filtres en cours
          sont reportés dans les liens — sinon changer de page les
          effacerait, et on repartirait d'une autre liste. */}
      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={`/fr/${adminPrefix}/categories`}
        preservedParams={{
          status: sp["status"],
          search: sp["search"],
          module: sp["module"],
        }}
      />
    </AdminPageShell>
  );
}
