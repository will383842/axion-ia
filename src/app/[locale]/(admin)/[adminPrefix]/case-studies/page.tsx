// Listing cas concrets admin (M9 Tier 2 section 5).

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCaseStudiesAction } from "@/features/admin-case-studies/actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

export default async function CaseStudiesListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const result = await listCaseStudiesAction({
    status: sp.status as never,
    sector: sp.sector,
    search: sp.search,
    page: sp.page ? parseInt(sp.page, 10) : 1,
  });

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Cas concrets</h1>
          <p className="admin-meta">
            {result.total} cas concret{result.total > 1 ? "s" : ""} • page {result.page}/
            {result.totalPages}
          </p>
        </div>
        <a href={`/fr/${adminPrefix}/case-studies/new`} className="admin-button">
          + Nouveau cas concret
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
            <label htmlFor="sector" className="admin-label">
              Secteur
            </label>
            <input
              id="sector"
              name="sector"
              type="text"
              defaultValue={sp.sector ?? ""}
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
              defaultValue={sp.search ?? ""}
              className="admin-input"
              placeholder="Min 2 caractères"
            />
          </div>
        </form>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Appliquer
          </button>
          <a href={`/fr/${adminPrefix}/case-studies`} className="admin-button-ghost">
            Réinitialiser
          </a>
        </div>
      </div>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date publi</th>
              <th>Titre (FR)</th>
              <th>Secteur</th>
              <th>Région</th>
              <th>Taille</th>
              <th>ROI</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-table-empty">
                  Aucun cas concret trouvé.
                </td>
              </tr>
            ) : (
              result.items.map((c) => (
                <tr key={c.id}>
                  <td>{c.publishedAt ? c.publishedAt.toISOString().slice(0, 10) : "—"}</td>
                  <td>
                    <div>{c.translations[0]?.title ?? "(sans titre)"}</div>
                    <code className="admin-meta-small">{c.translations[0]?.slug ?? ""}</code>
                  </td>
                  <td>{c.sector}</td>
                  <td>{c.region ?? "—"}</td>
                  <td>{c.companySizeRange}</td>
                  <td>{c.roiWeeks ? `${c.roiWeeks} sem.` : "—"}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${c.status}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td>
                    <a href={`/fr/${adminPrefix}/case-studies/${c.id}`} className="admin-link">
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
