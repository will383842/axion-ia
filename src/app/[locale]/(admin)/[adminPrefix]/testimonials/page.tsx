// Listing témoignages admin (M9 Tier 2 section 2).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listTestimonialsAction } from "@/features/admin-testimonials/actions";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { TestimonialsV2 } from "./_v2/TestimonialsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

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

export default async function TestimonialsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listTestimonialsAction({
    status: sp.status as never,
    module: sp.module as never,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  if (await isAdminV2Enabled()) {
    return (
      <TestimonialsV2
        adminPrefix={adminPrefix}
        searchParams={sp}
        items={result.items}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
      />
    );
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Témoignages</h1>
          <p className="admin-meta">
            {result.total} témoignage{result.total > 1 ? "s" : ""} • page {result.page}/
            {result.totalPages}
          </p>
        </div>
        <a href={`/fr/${adminPrefix}/testimonials/new`} className="admin-button">
          + Nouveau témoignage
        </a>
      </div>

      <div className="admin-card admin-filters">
        <form className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="status" className="admin-label">
              Statut
            </label>
            <select
              id="status"
              name="status"
              defaultValue={sp.status ?? "all"}
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
              defaultValue={sp.module ?? "all"}
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
              defaultValue={sp.search ?? ""}
              className="admin-input"
              placeholder="Nom, société, slug…"
            />
          </div>
        </form>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Appliquer
          </button>
          <a href={`/fr/${adminPrefix}/testimonials`} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
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
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-table-empty">
                  Aucun témoignage trouvé.
                </td>
              </tr>
            ) : (
              result.items.map((t) => (
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
                    <a href={`/fr/${adminPrefix}/testimonials/${t.id}`} className="admin-link">
                      Éditer →
                    </a>
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
