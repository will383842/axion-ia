// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Jobs list V2 — utilise AdminPageShell + AdminPageHeader + AdminCard.
// Filtres status + type + template + secteur + ville + search préservés.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { listJobs, retryAllFailed } from "@/server/actions/content-gen/jobs";
import { listTemplates } from "@/server/actions/content-gen/templates";
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

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Jobs content-gen"
        description={`${result.total} job${result.total > 1 ? "s" : ""} · page ${result.page}/${result.totalPages}`}
        actions={
          <form action={retryAll}>
            <button type="submit" className="admin-button-ghost">
              Retry all failed
            </button>
          </form>
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
                    {s}
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
                    {t}
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
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Secteur</th>
                <th>Statut</th>
                <th>Ville</th>
                <th>Score</th>
                <th>Coût</th>
                <th>Durée</th>
                <th>Erreur</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="admin-table-empty">
                    Aucun job — lancez une génération depuis le dashboard.
                  </td>
                </tr>
              ) : (
                result.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`${base}/${r.id}`} className="admin-link">
                        {r.createdAt.toISOString().slice(0, 16)}
                      </Link>
                    </td>
                    <td>{r.contentType}</td>
                    <td>
                      {r.serviceSector ? (
                        <span className="admin-meta-small">
                          {SERVICE_SECTOR_LABELS[r.serviceSector]}
                        </span>
                      ) : (
                        <span className="admin-meta">—</span>
                      )}
                    </td>
                    <td>{r.status}</td>
                    <td>{r.anchorVilleSlug ?? "—"}</td>
                    <td>{r.qualityScore ?? "—"}</td>
                    <td>{r.costUsd ? `$${Number(r.costUsd).toFixed(4)}` : "—"}</td>
                    <td>{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)} s` : "—"}</td>
                    <td title={r.errorMessage ?? ""}>
                      {r.errorMessage ? r.errorMessage.slice(0, 40) : "—"}
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
