// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Jobs list V2 — utilise AdminPageShell + AdminPageHeader + AdminCard.
// Filtres status + type + template + secteur + ville + search préservés.
// SP-04 P1 — prev/next pagination buttons.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>,
// badge statut → <AdminBadge>. Filtres / pagination / KPIs / server actions
// inchangés.

import Link from "next/link";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminBadge,
  AdminEmptyState,
  AdminPagination,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { listJobs, retryAllFailed, deleteFailedJobs } from "@/server/actions/content-gen/jobs";
import { formatDateFr } from "@/lib/format-date-fr";
import { listTemplates } from "@/server/actions/content-gen/templates";
import {
  JOB_STATUS_LABELS_FR,
  JOB_STATUS_TONE,
  contentTypeLabelFr,
} from "@/server/content-gen/shared/admin-labels";
import {
  SERVICE_SECTOR_LABELS,
  SERVICE_SECTORS,
} from "@/server/content-gen/shared/editorial-mix-rules";
import type {
  ContentGenJobStatus,
  ContentType,
  ServiceSector,
} from "../../../../../../../../prisma/generated/client";

const STATUSES: ReadonlyArray<ContentGenJobStatus> = [
  "queued",
  "running",
  "quality_improving",
  "needs_review",
  "publishing",
  "published",
  "failed",
  "cancelled",
];

const TYPES: ReadonlyArray<ContentType> = [
  "landing_ville",
  "blog_article",
  "blog_from_title",
  "blog_from_keywords",
  "blog_from_rss",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
];

// Libellés FR + tonalités : centralisés dans `admin-labels.ts` (SSOT, exhaustif
// sur les enums Prisma, testé). On n'affiche plus jamais un slug technique.

interface Props {
  adminPrefix: string;
  searchParams: Record<string, string | undefined>;
}

export async function JobsListV2({
  adminPrefix,
  searchParams: sp,
}: Props): Promise<React.ReactElement> {
  const page = sp["page"] ? parseInt(sp["page"], 10) : 1;
  const [result, templates] = await Promise.all([
    listJobs({
      ...(sp["status"] ? { status: sp["status"] as ContentGenJobStatus } : {}),
      ...(sp["contentType"] ? { contentType: sp["contentType"] as ContentType } : {}),
      ...(sp["templateId"] ? { templateId: sp["templateId"] } : {}),
      ...(sp["serviceSector"] ? { serviceSector: sp["serviceSector"] as ServiceSector } : {}),
      ...(sp["anchorVilleSlug"] ? { anchorVilleSlug: sp["anchorVilleSlug"] } : {}),
      ...(sp["search"] ? { search: sp["search"] } : {}),
      page,
    }),
    listTemplates({ isActive: true }),
  ]);

  const base = `/fr/${adminPrefix}/content-gen/jobs`;

  async function retryAll() {
    "use server";
    await retryAllFailed();
  }

  async function deleteFailed() {
    "use server";
    await deleteFailedJobs();
  }

  type JobRow = (typeof result.rows)[number];

  const columns: ReadonlyArray<AdminTableColumn<JobRow>> = [
    {
      key: "date",
      header: "Date",
      cell: (r) => formatDateFr(r.createdAt),
    },
    // Audit UX 2026-08-01 (Défaut 1, P0) — sans titre, impossible de savoir ce
    // qu'on suit sans ouvrir chaque ligne. Le titre porte désormais le lien de
    // détail (le champ Date, lui, redevient du texte simple ci-dessus).
    {
      key: "title",
      header: "Titre",
      cell: (r) => (
        <Link href={`${base}/${r.id}`} className="admin-link">
          {r.title ??
            (r.status === "failed" || r.status === "cancelled"
              ? "Sans titre (génération interrompue)"
              : "Génération en cours…")}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (r) => <span title={r.contentType}>{contentTypeLabelFr(r.contentType)}</span>,
    },
    {
      key: "secteur",
      header: "Secteur",
      cell: (r) =>
        r.serviceSector ? (
          <span className="admin-meta-small">{SERVICE_SECTOR_LABELS[r.serviceSector]}</span>
        ) : (
          <span className="admin-meta">—</span>
        ),
    },
    {
      key: "status",
      header: "Statut",
      cell: (r) => (
        <AdminBadge tone={JOB_STATUS_TONE[r.status] ?? "neutral"}>
          {JOB_STATUS_LABELS_FR[r.status] ?? r.status}
        </AdminBadge>
      ),
    },
    { key: "ville", header: "Ville", cell: (r) => r.anchorVilleSlug ?? "—" },
    { key: "score", header: "Score", cell: (r) => r.qualityScore ?? "—" },
    {
      key: "cost",
      header: "Coût",
      cell: (r) => (r.costUsd ? `$${Number(r.costUsd).toFixed(4)}` : "—"),
    },
    {
      key: "duration",
      header: "Durée",
      cell: (r) => (r.durationMs ? `${(r.durationMs / 1000).toFixed(1)} s` : "—"),
    },
    {
      key: "error",
      header: "Erreur",
      cell: (r) => (
        <span title={r.errorMessage ?? ""}>
          {r.errorMessage ? r.errorMessage.slice(0, 40) : "—"}
        </span>
      ),
    },
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        // Audit UX 2026-08-01 — aligné sur le libellé sidebar (admin-nav.ts,
        // route /content-gen/jobs) : « Jobs content-gen » était un intitulé
        // technique divergent de ce que Will lit dans le menu.
        title="Générations en cours"
        description={`${result.total} job${result.total > 1 ? "s" : ""} · page ${result.page}/${result.totalPages}`}
        actions={
          <div className="flex flex-wrap gap-[var(--space-admin-2)]">
            <form action={retryAll}>
              <button type="submit" className="admin-button-ghost">
                Relancer tous les échecs
              </button>
            </form>
            <form action={deleteFailed}>
              <button
                type="submit"
                className="admin-button-ghost text-[color:var(--color-admin-destructive)]"
                title="Supprime définitivement les jobs en échec/bloqués (tentatives ratées, sans contenu publié)"
              >
                Supprimer les jobs en échec
              </button>
            </form>
          </div>
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
                defaultValue={sp["status"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {JOB_STATUS_LABELS_FR[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="contentType" className="admin-label">
                Type
              </label>
              <select
                id="contentType"
                name="contentType"
                defaultValue={sp["contentType"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {contentTypeLabelFr(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="templateId" className="admin-label">
                Template
              </label>
              <select
                id="templateId"
                name="templateId"
                defaultValue={sp["templateId"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (v{t.version})
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="serviceSector" className="admin-label">
                Secteur
              </label>
              <select
                id="serviceSector"
                name="serviceSector"
                defaultValue={sp["serviceSector"] ?? ""}
                className="admin-input"
              >
                <option value="">Tous</option>
                {SERVICE_SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {SERVICE_SECTOR_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="anchorVilleSlug" className="admin-label">
                Ville (slug)
              </label>
              <input
                id="anchorVilleSlug"
                name="anchorVilleSlug"
                defaultValue={sp["anchorVilleSlug"] ?? ""}
                className="admin-input"
              />
            </div>
            <div className="admin-field">
              <label htmlFor="search" className="admin-label">
                Recherche (id / ville)
              </label>
              <input
                id="search"
                name="search"
                defaultValue={sp["search"] ?? ""}
                className="admin-input"
              />
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Filtrer
            </button>
            <Link href={base} className="admin-button-ghost">
              Réinitialiser
            </Link>
          </div>
        </form>
      </AdminCard>

      <AdminCard variant="compact">
        {result.rows.length === 0 ? (
          <AdminEmptyState title="Aucun job — lancez une génération depuis le dashboard." />
        ) : (
          <AdminTable
            columns={columns}
            rows={result.rows}
            getRowId={(r) => r.id}
            caption="Liste des jobs content-gen"
          />
        )}

        {/* Pagination P1 */}
        <AdminPagination
          page={result.page}
          totalPages={result.totalPages}
          baseHref={base}
          preservedParams={{
            status: sp["status"],
            contentType: sp["contentType"],
            templateId: sp["templateId"],
            serviceSector: sp["serviceSector"],
            anchorVilleSlug: sp["anchorVilleSlug"],
            search: sp["search"],
          }}
        />
      </AdminCard>
    </AdminPageShell>
  );
}
