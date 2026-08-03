// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// FAQ V2 (liste) — AdminPageShell + AdminPageHeader + AdminCard (filtres).
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
// Track 2 : tonalité du badge dérivée du statut (avant : `.admin-badge-${status}`
// non défini pour draft/published/archived → badge neutre non coloré).
const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  published: "success",
  draft: "warning",
  archived: "neutral",
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
  const columns: ReadonlyArray<AdminTableColumn<FAQRow>> = [
    { key: "order", header: "Ordre", cell: (f) => f.displayOrder, width: "70px" },
    {
      key: "category",
      header: "Catégorie",
      cell: (f) => CATEGORY_LABELS[f.category] ?? f.category,
    },
    { key: "question", header: "Question (FR)", cell: (f) => f.questionFr },
    {
      key: "slug",
      header: "Adresse (URL)",
      cell: (f) => <code className="admin-meta-small">{f.slug}</code>,
      hiddenBelow: "md",
    },
    {
      key: "status",
      header: "Statut",
      cell: (f) => (
        <AdminBadge tone={STATUS_TONE[f.status] ?? "neutral"}>
          {STATUS_LABELS[f.status] ?? f.status}
        </AdminBadge>
      ),
    },
    { key: "views", header: "Vues", cell: (f) => f.viewCount, align: "right", width: "80px" },
  ];

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
            <button type="submit" className="admin-button-secondary">
              Appliquer
            </button>
            <Link href={`/fr/${adminPrefix}/faq`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucune question trouvée." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(f) => f.id}
          caption="Liste des questions FAQ"
          rowAction={(f) => (
            <AdminButton
              href={`/fr/${adminPrefix}/faq/${f.id}`}
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
        baseHref={`/fr/${adminPrefix}/faq`}
        preservedParams={{
          status: sp["status"],
          search: sp["search"],
          category: sp["category"],
        }}
      />
    </AdminPageShell>
  );
}
