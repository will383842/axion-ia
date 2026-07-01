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
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
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

// Track 2 : tonalité du badge dérivée du statut job (labels inchangés).
// Record<string, …> volontaire (pas exhaustif sur l'enum) : le `?? "neutral"`
// au point d'usage couvre les statuts non listés (generating_*, running_qa,
// approved, …) → tonalité neutre par défaut.
const STATUS_TONE: Record<string, "success" | "warning" | "destructive" | "neutral"> = {
  queued: "warning",
  running: "warning",
  quality_improving: "warning",
  needs_review: "warning",
  publishing: "warning",
  published: "success",
  failed: "destructive",
  cancelled: "neutral",
};

// Libellés FR affichés à l'écran pour les statuts (option de filtre + badge).
// La valeur d'enum sous-jacente reste inchangée ; on ne traduit que l'affichage.
const STATUS_LABELS_FR: Record<string, string> = {
  queued: "En file",
  running: "En cours",
  quality_improving: "Amélioration qualité",
  needs_review: "À relire",
  publishing: "Publication",
  published: "Publié",
  failed: "Échec",
  cancelled: "Annulé",
};

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

  function pageUrl(p: number): string {
    const params = new URLSearchParams();
    if (sp["status"]) params.set("status", sp["status"]);
    if (sp["contentType"]) params.set("contentType", sp["contentType"]);
    if (sp["templateId"]) params.set("templateId", sp["templateId"]);
    if (sp["serviceSector"]) params.set("serviceSector", sp["serviceSector"]);
    if (sp["anchorVilleSlug"]) params.set("anchorVilleSlug", sp["anchorVilleSlug"]);
    if (sp["search"]) params.set("search", sp["search"]);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  async function retryAll() {
    "use server";
    await retryAllFailed();
  }

  type JobRow = (typeof result.rows)[number];

  const columns: ReadonlyArray<AdminTableColumn<JobRow>> = [
    {
      key: "date",
      header: "Date",
      cell: (r) => (
        <Link href={`${base}/${r.id}`} className="admin-link">
          {r.createdAt.toISOString().slice(0, 16)}
        </Link>
      ),
    },
    { key: "type", header: "Type", cell: (r) => r.contentType },
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
        <AdminBadge tone={STATUS_TONE[r.status] ?? "neutral"}>
          {STATUS_LABELS_FR[r.status] ?? r.status}
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
        title="Jobs content-gen"
        description={`${result.total} job${result.total > 1 ? "s" : ""} · page ${result.page}/${result.totalPages}`}
        actions={
          <form action={retryAll}>
            <button type="submit" className="admin-button-ghost">
              Relancer tous les échecs
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
                    {STATUS_LABELS_FR[s] ?? s}
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
        {result.totalPages > 1 && (
          <div className="mt-[var(--space-admin-5)] flex items-center justify-between">
            <p className="admin-meta">
              Page {result.page} / {result.totalPages} · {result.total} jobs
            </p>
            <div className="flex gap-[var(--space-admin-3)]">
              {result.page > 1 && (
                <Link href={pageUrl(result.page - 1)} className="admin-button-ghost">
                  ← Précédent
                </Link>
              )}
              {result.page < result.totalPages && (
                <Link href={pageUrl(result.page + 1)} className="admin-button-ghost">
                  Suivant →
                </Link>
              )}
            </div>
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
