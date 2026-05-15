/**
 * Content Generator — Jobs list (§ 12.1).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listJobs, retryAllFailed } from "@/server/actions/content-gen/jobs";
import { listTemplates } from "@/server/actions/content-gen/templates";
import type {
  ContentGenJobStatus,
  ContentType,
} from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

// 8 statuts effectivement écrits par les workers V1.0.2 (cf. audit
// opérationnel 2026-05-14 § 2.1). Les 4 orphelins (`generating_text`,
// `generating_image`, `running_qa`, `approved`) restent dans l'enum Prisma
// pour compatibilité V1.5+ mais sont retirés du sélecteur UI pour éviter
// de présenter des filtres qui retournent toujours 0 lignes.
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

export default async function JobsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const page = sp.page ? parseInt(sp.page, 10) : 1;
  const [result, templates] = await Promise.all([
    listJobs({
      ...(sp.status ? { status: sp.status as ContentGenJobStatus } : {}),
      ...(sp.contentType ? { contentType: sp.contentType as ContentType } : {}),
      ...(sp.templateId ? { templateId: sp.templateId } : {}),
      ...(sp.anchorVilleSlug ? { anchorVilleSlug: sp.anchorVilleSlug } : {}),
      ...(sp.search ? { search: sp.search } : {}),
      page,
    }),
    // P2-C fix audit 2026-05-15 — expose select templateId dans filtres /jobs.
    listTemplates({ isActive: true }),
  ]);

  const base = `/fr/${adminPrefix}/content-gen/jobs`;

  async function retryAll() {
    "use server";
    await retryAllFailed();
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Jobs content-gen</h1>
          <p className="admin-meta">
            {result.total} job{result.total > 1 ? "s" : ""} · page {result.page}/{result.totalPages}
          </p>
        </div>
        <form action={retryAll}>
          <button type="submit" className="admin-button-ghost">
            Retry all failed
          </button>
        </form>
      </div>

      <form className="admin-card admin-filters">
        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="status" className="admin-label">
              Statut
            </label>
            <select
              id="status"
              name="status"
              defaultValue={sp.status ?? ""}
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
              defaultValue={sp.contentType ?? ""}
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
              defaultValue={sp.templateId ?? ""}
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
            <label htmlFor="anchorVilleSlug" className="admin-label">
              Ville (slug)
            </label>
            <input
              id="anchorVilleSlug"
              name="anchorVilleSlug"
              defaultValue={sp.anchorVilleSlug ?? ""}
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
              defaultValue={sp.search ?? ""}
              className="admin-input"
            />
          </div>
        </div>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Filtrer
          </button>
          <a href={base} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </form>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
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
                <td colSpan={8}>Aucun job — lancez une génération depuis le dashboard.</td>
              </tr>
            ) : (
              result.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <a href={`${base}/${r.id}`}>{r.createdAt.toISOString().slice(0, 16)}</a>
                  </td>
                  <td>{r.contentType}</td>
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
    </section>
  );
}
