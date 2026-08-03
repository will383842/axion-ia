// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Case studies V2 (liste) — AdminPageShell + AdminPageHeader + AdminCard.

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

interface CaseStudyRow {
  id: string;
  status: string;
  publishedAt: Date | null;
  sector: string;
  region: string | null;
  companySizeRange: string;
  roiWeeks: number | null;
  translations: ReadonlyArray<{ title: string; slug: string }>;
}

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
  items: ReadonlyArray<CaseStudyRow>;
  total: number;
  page: number;
  totalPages: number;
}

export function CaseStudiesV2({
  adminPrefix,
  searchParams: sp,
  items,
  total,
  page,
  totalPages,
}: Props): React.ReactElement {
  const columns: ReadonlyArray<AdminTableColumn<CaseStudyRow>> = [
    {
      key: "publishedAt",
      header: "Publié le",
      cell: (c) => formatDateFrShort(c.publishedAt),
    },
    {
      key: "title",
      header: "Titre (FR)",
      cell: (c) => (
        <>
          <div>{c.translations[0]?.title ?? "(sans titre)"}</div>
          <code className="admin-meta-small">{c.translations[0]?.slug ?? ""}</code>
        </>
      ),
    },
    { key: "sector", header: "Secteur", cell: (c) => c.sector },
    { key: "region", header: "Région", cell: (c) => c.region ?? "—" },
    { key: "size", header: "Taille", cell: (c) => c.companySizeRange },
    { key: "roi", header: "ROI", cell: (c) => (c.roiWeeks ? `${c.roiWeeks} sem.` : "—") },
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
        title="Cas concrets"
        description={`${total} cas concret${total > 1 ? "s" : ""} · page ${page}/${totalPages}`}
        actions={
          <Link href={`/fr/${adminPrefix}/case-studies/new`} className="admin-button">
            + Nouveau cas concret
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
              <label htmlFor="sector" className="admin-label">
                Secteur
              </label>
              <input
                id="sector"
                name="sector"
                type="text"
                defaultValue={sp["sector"] ?? ""}
                className="admin-input"
                placeholder="ex: Industrie"
              />
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
            <Link href={`/fr/${adminPrefix}/case-studies`} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      {items.length === 0 ? (
        <AdminEmptyState title="Aucun cas concret trouvé." />
      ) : (
        <AdminTable
          columns={columns}
          rows={items}
          getRowId={(c) => c.id}
          caption="Liste des cas concrets"
          rowAction={(c) => (
            <AdminButton
              href={`/fr/${adminPrefix}/case-studies/${c.id}`}
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
        baseHref={`/fr/${adminPrefix}/case-studies`}
        preservedParams={{
          status: sp["status"],
          search: sp["search"],
          sector: sp["sector"],
        }}
      />
    </AdminPageShell>
  );
}
